const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, readFileSync, readdirSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');

test('HTTP integration against an isolated migrated SQLite database', { timeout: 45000 }, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'cookbook-api-test-'));
  const dbPath = join(directory, 'test.db');
  const db = new Database(dbPath);
  for (const migration of readdirSync(resolve('prisma/migrations'), { withFileTypes: true }).filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    db.exec(readFileSync(resolve('prisma/migrations', migration.name, 'migration.sql'), 'utf8'));
  }
  const ingredientId = randomUUID();
  db.prepare('INSERT INTO Ingredient (id, name, category) VALUES (?, ?, ?)').run(ingredientId, 'Тестовий помідор', 'Овочі');
  db.close();
  const child = spawn(process.execPath, ['--require', './tests/gemini-stub.cjs', 'dist/src/main.js'], {
    cwd: resolve('.'), windowsHide: true,
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', DATABASE_URL: `file:${dbPath.replaceAll('\\', '/')}`, JWT_SECRET: randomBytes(32).toString('hex'), GEMINI_API_KEY: 'test-not-real' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = new Promise(resolve => child.once('exit', resolve));
  t.after(async () => {
    child.kill();
    await exited;
    rmSync(directory, { recursive: true, force: true });
  });
  let logs = '';
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`API startup timeout: ${logs}`)), 15000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`API exited ${code}: ${logs}`)); });
    const consume = chunk => {
      logs += chunk;
      const match = logs.match(/CookBook AI API: (http:\/\/[^\s]+)\/health/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    };
    child.stdout.on('data', consume); child.stderr.on('data', consume);
  });
  const request = async (path, { method = 'GET', body, token, headers = {} } = {}) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, headers: response.headers, data: await response.json().catch(() => null) };
  };
  let session, second, item;
  const credentials = { name: 'Тестовий користувач', email: 'test@example.com', password: 'Test-password-2026!' };
  await t.test('health and database connection', async () => assert.equal((await request('/health')).status, 200));
  await t.test('registration, normalized email and no password exposure', async () => {
    const result = await request('/auth/register', { method: 'POST', body: { ...credentials, email: ' TEST@example.com ' } });
    assert.equal(result.status, 201); session = result.data;
    assert.ok(session.accessToken); assert.equal(session.user.email, credentials.email); assert.equal(session.user.passwordHash, undefined);
    const storedDb = new Database(dbPath, { readonly: true });
    const stored = storedDb.prepare('SELECT passwordHash FROM User WHERE id=?').get(session.user.id);
    storedDb.close(); assert.match(stored.passwordHash, /^\$argon2/);
  });
  await t.test('duplicate email returns 409', async () => assert.equal((await request('/auth/register', { method: 'POST', body: credentials })).status, 409));
  const catalogSession=(await request('/auth/register',{method:'POST',body:{...credentials,email:'catalog@example.com'}})).data;
  const catalogDb=new Database(dbPath);catalogDb.prepare("UPDATE User SET role='MODERATOR' WHERE id=?").run(catalogSession.user.id);catalogDb.close();
  await t.test('ingredient creation requires login, validates category and rejects normalized duplicates', async () => {
    const body = { name: '  Садова   чорниця  ', category: 'Ягоди' };
    assert.equal((await request('/ingredients', { method: 'POST', body })).status, 401);
    assert.ok((await request('/ingredients/categories')).data.includes('Спеції'));
    for (const patch of [{ name: ' ' }, { category: 'invalid' }, { extra: true }]) {
      assert.equal((await request('/ingredients', { method: 'POST', token: catalogSession.accessToken, body: { ...body, ...patch } })).status, 400);
    }
    const result = await request('/ingredients', { method: 'POST', token: catalogSession.accessToken, body });
    assert.equal(result.status, 201); assert.equal(result.data.name, 'Садова чорниця'); assert.equal(result.data.category, 'Ягоди');
    assert.deepEqual(result.data.culinaryCountries, []);
    assert.ok((await request('/ingredients')).data.some(item => item.id === result.data.id));
    assert.equal((await request('/ingredients', { method: 'POST', token: catalogSession.accessToken, body: { ...body, name: 'САДОВА ЧОРНИЦЯ' } })).status, 409);
  });
  await t.test('food categories exclude geography and moderator cannot recreate regional categories', async()=>{
    const names=(await request('/ingredients/categories')).data;
    assert.ok(!names.includes('Азійські продукти'));
    for(const name of ['Азійські продукти','Європейські продукти','Японські продукти','Африка']){
      const response=await request('/ingredients/categories',{method:'POST',token:catalogSession.accessToken,body:{name}});
      assert.equal(response.status,400);assert.match(response.data.message,/регіональних/);
    }
  });
  await t.test('moderator edits catalog and renames categories without breaking links; automatic recipe uses DB ranges',async()=>{
    const created=await request('/ingredients',{method:'POST',token:catalogSession.accessToken,body:{name:'Продукт для авторозрахунку',category:'Спеції'}});
    assert.equal(created.status,201);const iid=created.data.id;
    const body={name:'Оновлений продукт для авторозрахунку',category:'Спеції',emoji:'🌿',nutritionMode:'range',kcalMin:100,kcalMax:200,proteinMin:10,proteinMax:20,fatMin:0,fatMax:10,carbsMin:20,carbsMax:40,gramsPerUnit:50,densityGramsPerMl:1.2};
    assert.equal((await request('/ingredients/'+iid,{method:'PATCH',token:session.accessToken,body})).status,403);
    assert.equal((await request('/ingredients/'+iid,{method:'PATCH',token:catalogSession.accessToken,body:{...body,kcalMin:300}})).status,400);
    const updated=await request('/ingredients/'+iid,{method:'PATCH',token:catalogSession.accessToken,body});assert.equal(updated.status,200);assert.equal(updated.data.nutritionRange.kcal.min,100);
    const recipe=await request('/recipes',{method:'POST',token:session.accessToken,body:{title:'Автоматичний рецепт',description:'Тест',instructions:'Змішати продукти',emoji:'🥗',preparationMinutes:10,servings:2,difficulty:'EASY',nutritionAuto:true,calories:999,ingredients:[{ingredientId:iid,quantity:250,unit:'г',optional:false}]}});
    assert.equal(recipe.status,201);assert.equal(recipe.data.calories,187.5);assert.equal(recipe.data.protein,18.75);
    const rename=await request('/ingredients/categories/'+encodeURIComponent('Спеції'),{method:'PATCH',token:catalogSession.accessToken,body:{name:'Прянощі тестові'}});assert.equal(rename.status,200);
    assert.ok(!(await request('/ingredients/categories')).data.includes('Спеції'));
    const after=(await request('/ingredients')).data.find(x=>x.id===iid);assert.equal(after.category,'Прянощі тестові');assert.deepEqual(after.categoryTags,['Прянощі тестові']);
    assert.equal((await request('/recipes/'+recipe.data.id,{token:session.accessToken})).data.ingredients[0].ingredientId,iid);
    assert.equal((await request('/ingredients/categories/'+encodeURIComponent('Прянощі тестові'),{method:'PATCH',token:catalogSession.accessToken,body:{name:'Спеції'}})).status,200);
  });
  await t.test('blank name, short password and unexpected fields return 400', async () => {
    for (const patch of [{ name: '   ' }, { password: 'tiny' }, { role: 'MODERATOR' }, { email: 'invalid' }]) {
      assert.equal((await request('/auth/register', { method: 'POST', body: { ...credentials, ...patch } })).status, 400);
    }
  });
  await t.test('login succeeds and wrong password fails', async () => {
    const { email, password } = credentials;
    const result = await request('/auth/login', { method: 'POST', body: { email, password } });
    assert.equal(result.status, 200); assert.ok(result.data.accessToken);
    assert.equal((await request('/auth/login', { method: 'POST', body: { email, password: 'wrong' } })).status, 401);
  });
  await t.test('protected profile rejects missing and forged tokens', async () => {
    assert.equal((await request('/users/me')).status, 401);
    assert.equal((await request('/users/me', { token: 'forged' })).status, 401);
    assert.equal((await request('/users/me', { token: session.accessToken })).data.email, credentials.email);
  });
  await t.test('CORS preflight allows the frontend origin', async () => {
    const response = await fetch(base + '/auth/login', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
    assert.equal(response.status, 204); assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  });
  await t.test('fridge requires authentication and validates quantity', async () => {
    assert.equal((await request('/fridge', { method: 'POST', body: { ingredientId } })).status, 401);
    assert.equal((await request('/fridge', { method: 'POST', token: session.accessToken, body: { ingredientId, quantity: -1 } })).status, 400);
  });
  await t.test('fridge create/update/list and recommendations', async () => {
    const result = await request('/fridge', { method: 'POST', token: session.accessToken, body: { ingredientId, quantity: 2 } });
    assert.equal(result.status, 201); item = result.data;
    assert.equal(item.ingredient.name, 'Тестовий помідор');
    await request('/fridge', { method: 'POST', token: session.accessToken, body: { ingredientId, quantity: 3 } });
    const list = await request('/fridge', { token: session.accessToken });
    assert.equal(list.data.length, 1); assert.equal(list.data[0].quantity, 3);
    assert.equal((await request('/recommendations', { token: session.accessToken })).status, 200);
  });
  await t.test('another user cannot read or delete the first user fridge item', async () => {
    second = (await request('/auth/register', { method: 'POST', body: { ...credentials, email: 'second@example.com' } })).data;
    assert.deepEqual((await request('/fridge', { token: second.accessToken })).data, []);
    assert.equal((await request(`/fridge/${item.id}`, { method: 'DELETE', token: second.accessToken })).status, 404);
  });
  await t.test('owner can delete their fridge item', async () => {
    assert.equal((await request(`/fridge/${item.id}`, { method: 'DELETE', token: session.accessToken })).status, 200);
    assert.deepEqual((await request('/fridge', { token: session.accessToken })).data, []);
  });

  const recipeData = { title: 'Мій салат', emoji: '🥗', description: 'Особистий рецепт', instructions: '1. Нарізати помідор.\n2. Подати.', preparationMinutes: 10, servings: 2, difficulty: 'EASY', calories: 125.5, protein: 5.25, fat: 0, carbs: 24.1, ingredients: [{ ingredientId, quantity: 200, unit: 'г', optional: false }] };
  let recipeId;
  await t.test('create a private recipe bound to authenticated owner; emoji and instructions persist', async () => {
    assert.equal((await request('/recipes', { method: 'POST', body: recipeData })).status, 401);
    const response = await request('/recipes', { method: 'POST', token: session.accessToken, body: recipeData });
    assert.equal(response.status, 201); recipeId = response.data.id;
    assert.equal(response.data.authorId, session.user.id); assert.equal(response.data.isPublished, false);
    const detail = await request(`/recipes/${recipeId}`, { token: session.accessToken });
    assert.equal(detail.data.emoji, '🥗'); assert.equal(detail.data.instructions, recipeData.instructions);
    assert.equal(detail.data.ingredients[0].quantity, 200);
    assert.equal(detail.data.calories, 125.5); assert.equal(detail.data.protein, 5.25); assert.equal(detail.data.fat, 0); assert.equal(detail.data.carbs, 24.1);
    assert.ok((await request('/recipes/mine', { token: session.accessToken })).data.some(r => r.id === recipeId));
    assert.ok(!(await request('/recipes')).data.some(r => r.id === recipeId));
  });
  await t.test('other user cannot list, read, update, delete or receive private recipe recommendations', async () => {
    assert.deepEqual((await request('/recipes/mine', { token: second.accessToken })).data, []);
    assert.equal((await request(`/recipes/${recipeId}`, { token: second.accessToken })).status, 404);
    assert.equal((await request(`/recipes/${recipeId}`, { method: 'PUT', token: second.accessToken, body: recipeData })).status, 404);
    assert.equal((await request(`/recipes/${recipeId}`, { method: 'DELETE', token: second.accessToken })).status, 404);
    for (const token of [session.accessToken, second.accessToken]) await request('/fridge', { method: 'POST', token, body: { ingredientId } });
    assert.ok((await request('/recommendations', { token: session.accessToken })).data.some(r => r.id === recipeId));
    assert.ok(!(await request('/recommendations', { token: second.accessToken })).data.some(r => r.id === recipeId));
  });
  await t.test('recipe validation rejects forged ownership, duplicates, missing ingredients and non-emoji', async () => {
    for (const patch of [{ calories: -1 }, { protein: 'lots' }, { fat: 1.234 }, { carbs: 10001 }, { calories: 100001 }, { isPublished: null }, { imageUrl: "javascript:alert(1)" }, { title: '   ' }, { instructions: ' ' }, { emoji: 'text' }, { ingredients: [] }, { ingredients: [...recipeData.ingredients, ...recipeData.ingredients] }, { ingredients: [{ ingredientId: randomUUID(), optional: false }] }, { ingredients: [{ ingredientId, quantity: -1, optional: false }] }]) {
      assert.equal((await request('/recipes', { method: 'POST', token: session.accessToken, body: { ...recipeData, ...patch } })).status, 400, JSON.stringify(patch));
    }
  });
  await t.test('owner updates emoji, steps and ingredients atomically, then deletes recipe', async () => {
    const updated = { ...recipeData, calories: 210.75, protein: 0, fat: null, carbs: 40.5, title: 'Запечений помідор', emoji: '🍅', instructions: 'Запекти та подати.', ingredients: [{ ingredientId, quantity: 300, unit: 'г', optional: true }] };
    assert.equal((await request(`/recipes/${recipeId}`, { method: 'PUT', token: session.accessToken, body: updated })).status, 200);
    const detail = (await request(`/recipes/${recipeId}`, { token: session.accessToken })).data;
    assert.equal(detail.emoji, '🍅'); assert.equal(detail.title, updated.title); assert.equal(detail.instructions, updated.instructions);
    assert.equal(detail.ingredients.length, 1); assert.equal(detail.ingredients[0].quantity, 300); assert.equal(detail.ingredients[0].optional, true);
    assert.equal(detail.calories, 210.75); assert.equal(detail.protein, 0); assert.equal(detail.fat, null); assert.equal(detail.carbs, 40.5);
    const { calories, protein, fat, carbs, ...withoutNutrition } = updated;
    await request(`/recipes/${recipeId}`, { method: 'PUT', token: session.accessToken, body: withoutNutrition });
    assert.equal((await request(`/recipes/${recipeId}`, { token: session.accessToken })).data.calories, 210.75);
    assert.equal((await request(`/recipes/${recipeId}`, { method: 'PUT', token: session.accessToken, body: { ...updated, emoji: 'invalid' } })).status, 400);
    assert.equal((await request(`/recipes/${recipeId}`, { token: session.accessToken })).data.emoji, '🍅');
    assert.equal((await request(`/recipes/${recipeId}`, { method: 'DELETE', token: session.accessToken })).status, 200);
    assert.equal((await request(`/recipes/${recipeId}`, { token: session.accessToken })).status, 404);
    const check = new Database(dbPath, { readonly: true });
    assert.equal(check.prepare('SELECT COUNT(*) AS count FROM RecipeIngredient WHERE recipeId=?').get(recipeId).count, 0); check.close();
  });

  await t.test('bulk fridge add is atomic and idempotent; selected and clear never affect another user', async () => {
    const extra = randomUUID();
    const setup = new Database(dbPath); setup.prepare('INSERT INTO Ingredient (id,name,category) VALUES (?,?,?)').run(extra, 'Тестове яйце', 'Яйця'); setup.close();
    assert.equal((await request('/fridge/bulk', { method: 'POST', token: session.accessToken, body: { ingredientIds: [extra, randomUUID()] } })).status, 400);
    assert.ok(!(await request('/fridge', { token: session.accessToken })).data.some(item => item.ingredientId === extra));
    for (let i = 0; i < 2; i++) assert.equal((await request('/fridge/bulk', { method: 'POST', token: session.accessToken, body: { ingredientIds: [ingredientId, extra] } })).status, 201);
    const own = (await request('/fridge', { token: session.accessToken })).data;
    assert.equal(own.length, 2);
    const foreign = (await request('/fridge', { token: second.accessToken })).data;
    assert.equal((await request('/fridge/selected', { method: 'DELETE', token: session.accessToken, body: { ids: [own[0].id, foreign[0].id] } })).data.deleted, 1);
    assert.equal((await request('/fridge', { token: second.accessToken })).data.length, 1);
    assert.equal((await request('/fridge', { method: 'DELETE', token: session.accessToken })).data.deleted, 1);
    assert.deepEqual((await request('/fridge', { token: session.accessToken })).data, []);
    assert.equal((await request('/fridge', { method: 'DELETE' })).status, 401);
    assert.equal((await request('/fridge/bulk', { method: 'POST', token: session.accessToken, body: { ingredientIds: [] } })).status, 400);
  });

  await t.test('chat uses current own fridge, preferences and history without leaking private recipes', async () => {
    await request('/recipes', { method: 'POST', token: second.accessToken, body: { ...recipeData, title: 'Секретний рецепт другого користувача' } });
    await request('/fridge', { method: 'POST', token: session.accessToken, body: { ingredientId } });
    assert.equal((await request('/assistant/history')).status, 401);
    assert.equal((await request('/assistant/messages', { method: 'POST', token: session.accessToken, body: { message: ' ' } })).status, 400);
    const answer = await request('/assistant/messages', { method: 'POST', token: session.accessToken, body: { message: '__inspect__' } });
    assert.equal(answer.status, 201);
    const payload = JSON.parse(answer.data.reply);
    assert.match(payload.systemInstruction.parts[0].text, /Тестовий помідор/);
    assert.doesNotMatch(payload.systemInstruction.parts[0].text, /Секретний рецепт другого/);
    assert.ok(new Date(answer.data.expiresAt) > new Date(Date.now() + 29 * 86400000));
    assert.equal((await request('/assistant/history', { token: session.accessToken })).data.turns.length, 1);
    assert.equal((await request('/assistant/history', { token: second.accessToken })).data.turns.length, 0);
    await request('/assistant/messages', { method: 'POST', token: session.accessToken, body: { message: 'Без молока, за 20 хвилин' } });
    const followup = await request('/assistant/messages', { method: 'POST', token: session.accessToken, body: { message: '__inspect__' } });
    assert.ok(JSON.parse(followup.data.reply).contents.some(entry => entry.parts[0].text === 'Без молока, за 20 хвилин'));
    await request('/fridge', { method: 'DELETE', token: session.accessToken });
    const refreshed = await request('/assistant/messages', { method: 'POST', token: session.accessToken, body: { message: '__inspect__' } });
    assert.match(JSON.parse(refreshed.data.reply).systemInstruction.parts[0].text, /Актуальний холодильник \(JSON\): \[\]/);
  });
  await t.test('Gemini failure does not persist fake answers; duplicate and clear during request are rejected', async () => {
    const before = (await request('/assistant/history', { token: session.accessToken })).data.turns.length;
    assert.equal((await request('/assistant/messages', { method: 'POST', token: session.accessToken, body: { message: '__error__' } })).status, 429);
    assert.equal((await request('/assistant/history', { token: session.accessToken })).data.turns.length, before);
    const slow = request('/assistant/messages', { method: 'POST', token: session.accessToken, body: { message: '__slow__' } });
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.equal((await request('/assistant/messages', { method: 'POST', token: session.accessToken, body: { message: 'duplicate' } })).status, 409);
    assert.equal((await request('/assistant/history', { method: 'DELETE', token: session.accessToken })).status, 409);
    assert.equal((await slow).status, 201);
  });
  await t.test('expired chat turns are purged and clearing affects only own history', async () => {
    await request('/assistant/messages', { method: 'POST', token: second.accessToken, body: { message: 'Привіт' } });
    const setup = new Database(dbPath); const expiredId = randomUUID();
    setup.prepare('INSERT INTO ChatTurn (id,userId,prompt,reply,createdAt,expiresAt) VALUES (?,?,?,?,?,?)').run(expiredId, session.user.id, 'expired', 'old reply', Date.now() - 31 * 86400000, Date.now() - 86400000); setup.close();
    const history = (await request('/assistant/history', { token: session.accessToken })).data;
    assert.equal(history.retentionDays, 30); assert.ok(!history.turns.some(turn => turn.id === expiredId));
    const check = new Database(dbPath); assert.equal(check.prepare('SELECT count(*) AS n FROM ChatTurn WHERE id=?').get(expiredId).n, 0); check.close();
    await request('/assistant/history', { method: 'DELETE', token: session.accessToken });
    assert.deepEqual((await request('/assistant/history', { token: session.accessToken })).data.turns, []);
    assert.equal((await request('/assistant/history', { token: second.accessToken })).data.turns.length, 1);
  });
  await t.test('only moderators publish recipes; photos persist; unpublishing hides from other users', async () => {
    const published = { ...recipeData, imageUrl: 'https://example.com/salad.jpg', isPublished: true };
    assert.equal((await request('/recipes', { method: 'POST', token: session.accessToken, body: published })).status, 403);
    const moderator = (await request('/auth/register', { method: 'POST', body: { ...credentials, email: 'moderator@example.com' } })).data;
    const adminDb = new Database(dbPath);
    adminDb.prepare("UPDATE User SET role='MODERATOR' WHERE id=?").run(moderator.user.id);
    const login = await request('/auth/login', { method: 'POST', body: { email: 'moderator@example.com', password: credentials.password } });
    assert.equal(login.data.user.role, 'MODERATOR');
    moderator.accessToken = login.data.accessToken;
    assert.equal((await request('/recipes', { method: 'POST', token: moderator.accessToken, body: { ...published, imageUrl: null } })).status, 201);
    const created = await request('/recipes', { method: 'POST', token: moderator.accessToken, body: published });
    assert.equal(created.status, 201);
    const path = `/recipes/${created.data.id}`;
    assert.equal((await request(path, { token: second.accessToken })).data.imageUrl, published.imageUrl);
    assert.equal((await request(path, { method: 'PUT', token: moderator.accessToken, body: { ...recipeData, imageUrl: null } })).status, 200);
    assert.ok((await request('/recipes')).data.some(r => r.id === created.data.id));
    assert.equal((await request(path, { method: 'PUT', token: second.accessToken, body: recipeData })).status, 404);
    assert.equal((await request(path, { method: 'DELETE', token: second.accessToken })).status, 404);
    adminDb.prepare("UPDATE User SET role='USER' WHERE id=?").run(moderator.user.id);
    assert.equal((await request('/recipes', { method: 'POST', token: moderator.accessToken, body: published })).status, 403);
    assert.equal((await request(path, { method: 'PUT', token: moderator.accessToken, body: recipeData })).status, 403);
    adminDb.prepare("UPDATE User SET role='MODERATOR' WHERE id=?").run(moderator.user.id);
    assert.equal((await request(path, { method: 'PUT', token: moderator.accessToken, body: { ...published, isPublished: false, imageUrl: null } })).status, 200);
    assert.equal((await request(path, { token: second.accessToken })).status, 404);
    assert.equal((await request(path, { token: moderator.accessToken })).data.imageUrl, null);
    adminDb.close();
  });
  await t.test('recommendations with 1000 recipes meet the 300ms local target', async () => {
    const perfDb = new Database(dbPath);
    const insert = perfDb.prepare('INSERT INTO Recipe (id,title,instructions,preparationMinutes,servings,difficulty,isPublished,updatedAt) VALUES (?,?,?,10,1,?,1,CURRENT_TIMESTAMP)');
    const link = perfDb.prepare('INSERT INTO RecipeIngredient (recipeId,ingredientId,quantity,unit,optional) VALUES (?,?,100,?,0)');
    perfDb.transaction(() => { for (let i=0;i<1000;i++) { const id = `perf-${i}`; insert.run(id, `Performance recipe ${i}`, 'Prepare ingredients and cook.', 'EASY'); link.run(id, ingredientId, 'г'); } })();
    perfDb.close();
    assert.equal((await request('/recipes')).data.filter(recipe => recipe.id.startsWith('perf-')).length, 1000);
    await request('/fridge', { method: 'POST', token: session.accessToken, body: { ingredientId } });
    const timings = [];
    for (let i=0;i<5;i++) {
      const start = performance.now();
      const result = await request('/recommendations', { token: session.accessToken });
      timings.push(performance.now() - start);
      assert.equal(result.status, 200);
      assert.ok(result.data.filter(recipe => recipe.id.startsWith('perf-')).length === 1000);
    }
    const median = timings.sort((a,b)=>a-b)[2];
    t.diagnostic(`1000 recipes, median of 5 HTTP requests including JSON: ${median.toFixed(1)} ms`);
    assert.ok(median < 300, `Median ${median.toFixed(1)}ms exceeds 300ms`);
  });

  await t.test('community privacy, profiles, categories, emoji, ratings and comment ownership', async () => {
    const category = await request('/ingredients/categories', {method:'POST',token:catalogSession.accessToken,body:{name:'Соуси тест'}});
    assert.equal(category.status,201);
    assert.ok((await request('/ingredients/categories')).data.includes('Соуси тест'));
    assert.equal((await request('/ingredients/categories',{method:'POST',token:catalogSession.accessToken,body:{name:'соуси тест'}})).status,409);
    const ingredient = await request('/ingredients',{method:'POST',token:catalogSession.accessToken,body:{name:'Песто тест',category:'Соуси тест',emoji:'🌿'}});
    assert.equal(ingredient.data.emoji,'🌿');
    const own = (await request('/recipes',{method:'POST',token:session.accessToken,body:{...recipeData,isShared:false}})).data;
    const path='/recipes/'+own.id;
    assert.equal((await request(path+'/discussion',{token:second.accessToken})).status,404);
    assert.equal((await request(path+'/favorite',{method:'PUT',token:second.accessToken})).status,404);
    assert.equal((await request(path+'/comments',{method:'POST',token:second.accessToken,body:{text:'Hidden'}})).status,404);
    assert.equal((await request(path+'/rating',{method:'PUT',token:second.accessToken,body:{value:5}})).status,404);
    await request(path,{method:'PUT',token:session.accessToken,body:{...recipeData,isShared:true}});
    assert.ok((await request('/recipes/community')).data.some(r=>r.id===own.id));
    assert.equal((await request(path+'/favorite',{method:'PUT',token:second.accessToken})).data.saved,true);
    assert.equal((await request(path+'/favorite',{token:session.accessToken})).data.saved,false);
    assert.equal((await request(path+'/favorite',{method:'DELETE',token:second.accessToken})).data.saved,false);
    const comment=(await request(path+'/comments',{method:'POST',token:second.accessToken,body:{text:'Смачно!'}})).data;
    assert.equal((await request(path+'/comments/'+comment.id,{method:'DELETE',token:session.accessToken})).status,404);
    for(const value of [1,5]) assert.equal((await request(path+'/rating',{method:'PUT',token:second.accessToken,body:{value}})).status,200);
    assert.equal((await request(path+'/rating',{method:'PUT',token:second.accessToken,body:{value:6}})).status,400);
    const discussion=(await request(path+'/discussion',{token:session.accessToken})).data;
    assert.equal(discussion.count,1); assert.equal(discussion.average,5); assert.equal(discussion.comments[0].user.email,undefined);
    assert.equal((await request('/users/'+session.user.id+'/profile',{token:second.accessToken})).data.recipes.length,0);
    const profile={name:'Кухар',bio:'**Про себе**',avatarUrl:null,coverUrl:null,showRecipes:true};
    assert.equal((await request('/users/me/profile',{method:'PUT',token:session.accessToken,body:profile})).status,200);
    const publicProfile=(await request('/users/'+session.user.id+'/profile',{token:second.accessToken})).data;
    assert.equal(publicProfile.email,undefined); assert.ok(publicProfile.recipes.some(r=>r.id===own.id));
    const ratedProfileRecipe=publicProfile.recipes.find(r=>r.id===own.id);assert.equal(ratedProfileRecipe.averageRating,5);assert.equal(ratedProfileRecipe.ratingCount,1);assert.equal(ratedProfileRecipe.ratings,undefined);
    await request(path,{method:'PUT',token:session.accessToken,body:{...recipeData,isShared:false}});
    assert.ok(!(await request('/users/'+session.user.id+'/profile',{token:second.accessToken})).data.recipes.some(r=>r.id===own.id));
    assert.equal((await request(path+'/discussion',{token:second.accessToken})).status,404);
  });

  await t.test('saved and following feeds preserve privacy, meal type and publication time', async()=>{
    const r=(await request('/recipes',{method:'POST',token:session.accessToken,body:{...recipeData,mealType:'BREAKFAST',isShared:true}})).data;
    const path='/recipes/'+r.id;
    assert.equal(r.mealType,'BREAKFAST');assert.ok(r.publishedAt);
    assert.equal((await request('/library/follow/'+session.user.id,{method:'PUT',token:second.accessToken})).status,200);
    await request('/library/follow/'+session.user.id,{method:'PUT',token:second.accessToken});
    assert.equal((await request('/library/following',{token:second.accessToken})).data.users.length,1);
    assert.ok((await request('/library/following',{token:second.accessToken})).data.recipes.some(x=>x.id===r.id));
    await request(path+'/favorite',{method:'PUT',token:second.accessToken});
    assert.ok((await request('/library/saved',{token:second.accessToken})).data.some(x=>x.id===r.id));
    assert.ok(!(await request('/library/saved',{token:session.accessToken})).data.some(x=>x.id===r.id));
    await request(path+'/rating',{method:'PUT',token:second.accessToken,body:{value:4}});
    assert.equal((await request('/library/ratings',{token:second.accessToken})).data.find(x=>x.id===r.id).average,4);
    await request(path,{method:'PUT',token:session.accessToken,body:{...recipeData,isShared:true,mealType:'DINNER'}});
    assert.equal((await request(path,{token:session.accessToken})).data.publishedAt,r.publishedAt);
    assert.equal((await request(path,{method:'PUT',token:session.accessToken,body:{...recipeData,mealType:'INVALID'}})).status,400);
    await request(path,{method:'PUT',token:session.accessToken,body:{...recipeData,isShared:false}});
    assert.ok(!(await request('/library/saved',{token:second.accessToken})).data.some(x=>x.id===r.id));
    assert.ok(!(await request('/library/following',{token:second.accessToken})).data.recipes.some(x=>x.id===r.id));
    await request('/library/follow/'+session.user.id,{method:'DELETE',token:second.accessToken});
    assert.equal((await request('/library/following',{token:second.accessToken})).data.users.length,0);
    assert.equal((await request('/library/follow/'+session.user.id,{method:'PUT',token:session.accessToken})).status,400);
  });

  await t.test('moderators manage others recipes and unused ingredients; author and dependencies preserved',async()=>{
    const moderator=(await request('/auth/register',{method:'POST',body:{...credentials,email:'manage@example.com'}})).data;
    const adminDb=new Database(dbPath);
    adminDb.prepare("UPDATE User SET role='MODERATOR' WHERE id=?").run(moderator.user.id);
    const own=(await request('/recipes',{method:'POST',token:session.accessToken,body:recipeData})).data;
    const path='/recipes/'+own.id;
    assert.equal((await request('/recipes/moderation',{token:session.accessToken})).status,403);
    assert.ok((await request('/recipes/moderation',{token:moderator.accessToken})).data.some(x=>x.id===own.id));
    const detail=(await request(path,{token:moderator.accessToken})).data;
    assert.equal(detail.author.id,session.user.id);assert.equal(detail.author.email,undefined);assert.equal(detail.author.passwordHash,undefined);
    assert.equal((await request(path,{method:'PUT',token:moderator.accessToken,body:{...recipeData,title:'Модератор відредагував'}})).status,200);
    assert.equal((await request(path,{token:session.accessToken})).data.authorId,session.user.id);
    assert.equal((await request(path,{method:'DELETE',token:second.accessToken})).status,404);
    const ingredient=(await request('/ingredients',{method:'POST',token:catalogSession.accessToken,body:{name:'Видалення тест',category:'Овочі'}})).data;
    assert.equal((await request('/ingredients/'+ingredient.id,{method:'DELETE',token:session.accessToken})).status,403);

    assert.equal((await request('/ingredients/'+ingredient.id,{method:'DELETE',token:moderator.accessToken})).status,200);
    assert.equal((await request('/ingredients/'+ingredient.id,{method:'DELETE',token:moderator.accessToken})).status,404);
    const published=(await request('/recipes',{method:'POST',token:moderator.accessToken,body:{...recipeData,isPublished:true,imageUrl:'https://example.com/food.jpg'}})).data;
    adminDb.prepare("UPDATE User SET role='USER' WHERE id=?").run(moderator.user.id);
    assert.equal((await request(path,{method:'DELETE',token:moderator.accessToken})).status,404);
    adminDb.prepare("UPDATE User SET role='MODERATOR' WHERE id=?").run(second.user.id);
    assert.equal((await request('/recipes/'+published.id,{method:'PUT',token:second.accessToken,body:{...recipeData,isPublished:true,imageUrl:'https://example.com/food.jpg'}})).status,200);
    assert.equal((await request('/recipes/'+published.id,{method:'DELETE',token:second.accessToken})).status,200);
    assert.equal((await request(path,{method:'DELETE',token:second.accessToken})).status,200);
    adminDb.close();
  });

  await t.test('moderator-only catalog, force delete dependencies, and immutable original authorship',async()=>{
    assert.equal((await request('/ingredients',{method:'POST',token:session.accessToken,body:{name:'Forbidden item',category:'Овочі'}})).status,403);
    assert.equal((await request('/ingredients/categories',{method:'POST',token:session.accessToken,body:{name:'Forbidden category'}})).status,403);
    const item=(await request('/ingredients',{method:'POST',token:catalogSession.accessToken,body:{name:'Used deletion fixture',category:'Овочі'}})).data;
    const body={...recipeData,isShared:true,ingredients:[{ingredientId:item.id,quantity:50,unit:'г',optional:false}]};
    const recipe=(await request('/recipes',{method:'POST',token:session.accessToken,body})).data;
    const path='/recipes/'+recipe.id;
    assert.equal((await request(path,{method:'PUT',token:session.accessToken,body:{...body,authorId:catalogSession.user.id}})).status,403);
    assert.equal((await request(path,{method:'PUT',token:catalogSession.accessToken,body:{...body,authorId:second.user.id}})).status,200);
    assert.equal((await request(path,{method:'PUT',token:catalogSession.accessToken,body:{...body,authorId:catalogSession.user.id}})).status,200);
    const info=(await request(path,{token:catalogSession.accessToken})).data;
    assert.equal(info.authorId,catalogSession.user.id);assert.equal(info.originalAuthorship.user.id,session.user.id);
    assert.equal((await request(path,{token:session.accessToken})).data.originalAuthorship,undefined);
    assert.equal((await request('/recipes/authors',{token:session.accessToken})).status,403);
    assert.equal((await request('/recipes/authors',{token:catalogSession.accessToken})).status,200);
    await request('/fridge',{method:'POST',token:session.accessToken,body:{ingredientId:item.id}});
    const fixtures=new Database(dbPath);fixtures.prepare('INSERT INTO ShoppingListItem (id,userId,ingredientId) VALUES (?,?,?)').run(randomUUID(),session.user.id,item.id);fixtures.close();
    const deleted=await request('/ingredients/'+item.id,{method:'DELETE',token:catalogSession.accessToken});
    assert.equal(deleted.status,200);assert.equal(deleted.data.affectedRecipes,1);assert.equal(deleted.data.affectedFridges,1);assert.equal(deleted.data.affectedShoppingItems,1);
    const remaining=(await request(path,{token:catalogSession.accessToken})).data;
    assert.equal(remaining.ingredients.length,0);assert.equal(remaining.calories,null);
    assert.ok(!(await request('/fridge',{token:session.accessToken})).data.some(x=>x.ingredientId===item.id));
  });

  await t.test('photo upload validates images and 2.5 MB then persists in recipe',async()=>{
    const png=await require('sharp')({create:{width:32,height:32,channels:3,background:{r:30,g:150,b:70}}}).png().toBuffer();
    async function upload(data,token=session.accessToken) {
      const form=new FormData();form.append('photo',new Blob([data],{type:'image/png'}),'dish.png');
      return fetch(base+'/photos',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body:form});
    }
    assert.equal((await upload(png,null)).status,401);
    assert.equal((await upload(Buffer.from('<script>fake image</script>'))).status,400);
    assert.equal((await upload(Buffer.alloc(2500001))).status,413);
    assert.equal((await upload(Buffer.concat([png,Buffer.alloc(2500000-png.length)]))).status,201);
    const response=await upload(png);assert.equal(response.status,201);
    const photo=await response.json();
    const fetched=await fetch(new URL(photo.imageUrl,base));assert.equal(fetched.status,200);assert.equal(fetched.headers.get('content-type'),'image/webp');
    assert.ok((await fetched.arrayBuffer()).byteLength>0);
    const recipe=(await request('/recipes',{method:'POST',token:session.accessToken,body:{...recipeData,imageUrl:photo.imageUrl}})).data;
    assert.equal(recipe.imageUrl,photo.imageUrl);
    assert.equal((await request('/recipes/'+recipe.id,{token:session.accessToken})).data.imageUrl,photo.imageUrl);
    assert.equal((await request('/recipes/'+recipe.id,{method:'PUT',token:session.accessToken,body:{...recipeData,imageUrl:null}})).status,200);
  });

  await t.test('personal library history, statistics and bulk removal enforce ownership and recipe privacy',async()=>{
    const visitor=(await request('/auth/register',{method:'POST',body:{...credentials,email:'library-visitor@example.com'}})).data;
    const own=(await request('/recipes',{method:'POST',token:session.accessToken,body:{...recipeData,title:'Private history target'}})).data;
    const shared=(await request('/recipes',{method:'POST',token:session.accessToken,body:{...recipeData,title:'Shared library target',isShared:true}})).data;
    assert.equal((await request('/library/history')).status,401);
    const search={query:'  Суп   з овочами  ',source:'official',recipeIds:[own.id,shared.id]};
    const logged=await request('/library/history',{method:'POST',token:visitor.accessToken,body:search});assert.equal(logged.status,201);assert.equal(logged.data.query,'Суп з овочами');
    const repeated=await request('/library/history',{method:'POST',token:visitor.accessToken,body:search});assert.equal(repeated.data.id,logged.data.id);
    const ownerHistory=(await request('/library/history',{method:'POST',token:session.accessToken,body:{query:'My private dish',source:'mine',recipeIds:[own.id]}})).data;
    const history=(await request('/library/history',{token:visitor.accessToken})).data;
    assert.equal(history.items.length,1);assert.deepEqual(history.items[0].recipes.map(x=>x.id),[shared.id]);assert.equal(history.items[0].recipes[0].author.email,undefined);
    assert.ok(!(await request('/library/history',{token:session.accessToken})).data.items.some(x=>x.id===logged.data.id));
    assert.equal((await request('/library/history?cursor='+ownerHistory.id,{token:visitor.accessToken})).status,404);
    assert.equal((await request('/library/history',{method:'DELETE',token:session.accessToken,body:{ids:[logged.data.id]}})).data.count,0);
    assert.equal((await request('/library/history',{method:'POST',token:visitor.accessToken,body:{...search,userId:session.user.id}})).status,400);
    assert.equal((await request('/library/history',{method:'POST',token:visitor.accessToken,body:{...search,source:'invalid'}})).status,400);
    for(const ids of [[],[shared.id,shared.id],Array.from({length:501},(_,i)=>String(i))])assert.equal((await request('/library/saved',{method:'DELETE',token:visitor.accessToken,body:{ids}})).status,400);
    for(const token of [session.accessToken,visitor.accessToken])await request('/recipes/'+shared.id+'/favorite',{method:'PUT',token});
    await request('/library/follow/'+session.user.id,{method:'PUT',token:visitor.accessToken});
    await request('/library/follow/'+visitor.user.id,{method:'PUT',token:session.accessToken});
    assert.equal((await request('/library/following',{method:'DELETE',token:session.accessToken,body:{ids:[session.user.id]}})).data.count,0);
    assert.equal((await request('/library/follow/'+session.user.id,{token:visitor.accessToken})).data.following,true);
    const stats=(await request('/library/stats?userId='+session.user.id,{token:visitor.accessToken})).data;
    assert.equal(stats.recipes,0);assert.equal(stats.saved,1);assert.equal(stats.following,1);assert.equal(stats.history,1);assert.equal(stats.averageRating,null);
    await request('/recipes/'+shared.id,{method:'PUT',token:session.accessToken,body:{...recipeData,title:'Shared library target',isShared:false}});
    const hidden=(await request('/library/saved-items',{token:visitor.accessToken})).data.find(x=>x.id===shared.id);assert.ok(hidden);assert.equal(hidden.recipe,null);
    assert.equal((await request('/library/history',{token:visitor.accessToken})).data.items[0].recipes.length,0);
    assert.equal((await request('/library/saved',{method:'DELETE',token:visitor.accessToken,body:{ids:[shared.id]}})).data.count,1);
    assert.equal((await request('/recipes/'+shared.id+'/favorite',{token:session.accessToken})).data.saved,true);
    assert.equal((await request('/library/following',{method:'DELETE',token:visitor.accessToken,body:{ids:[session.user.id]}})).data.count,1);
    assert.equal((await request('/library/follow/'+visitor.user.id,{token:session.accessToken})).data.following,true);
    const pages=new Database(dbPath);const insert=pages.prepare('INSERT INTO SearchHistory(id,userId,query,source,createdAt) VALUES (?,?,?,?,?)');
    for(let i=0;i<101;i++)insert.run(randomUUID(),visitor.user.id,'Page '+i,'official',new Date(Date.now()-i*1000).toISOString());pages.close();
    const first=(await request('/library/history',{token:visitor.accessToken})).data;assert.equal(first.items.length,100);assert.ok(first.nextCursor);
    const last=(await request('/library/history?cursor='+first.nextCursor,{token:visitor.accessToken})).data;assert.equal(last.items.length,2);assert.equal(last.nextCursor,null);
    const ids=[...first.items,...last.items].map(x=>x.id);assert.equal(new Set(ids).size,102);
    assert.equal((await request('/library/history',{method:'DELETE',token:visitor.accessToken,body:{ids}})).data.count,102);
    assert.ok((await request('/library/history',{token:session.accessToken})).data.items.some(x=>x.id===ownerHistory.id));
    assert.equal((await request('/recipes/'+own.id,{token:session.accessToken})).status,200);
    assert.equal((await request('/recipes/'+shared.id,{token:session.accessToken})).status,200);
  });

  await t.test('thread replies, unique handles, mention notifications and statistics respect privacy and comment ownership',async()=>{
   async function user(label,handle){const u=(await request('/auth/register',{method:'POST',body:{...credentials,email:label+'@example.com',name:label}})).data;const updated=await request('/users/me/profile',{method:'PUT',token:u.accessToken,body:{name:label,handle,bio:'',avatarUrl:null,coverUrl:null,showRecipes:true}});assert.equal(updated.status,200);return {...u,handle:updated.data.handle};}
   const owner=await user('ThreadOwner','thread_owner'),writer=await user('ThreadWriter','thread_writer'),target=await user('ThreadTarget','thread_target');
   const profile={name:'ThreadTarget',bio:'',avatarUrl:null,coverUrl:null,showRecipes:true};
   assert.equal((await request('/users/me/profile',{method:'PUT',token:target.accessToken,body:{...profile,handle:'THREAD_OWNER'}})).status,409);
   for(const handle of ['bad handle','a',null])assert.equal((await request('/users/me/profile',{method:'PUT',token:target.accessToken,body:{...profile,handle}})).status,400);
   const recipe=(await request('/recipes',{method:'POST',token:owner.accessToken,body:{...recipeData,title:'Threaded recipe',isShared:true}})).data;
   const other=(await request('/recipes',{method:'POST',token:owner.accessToken,body:{...recipeData,title:'Private thread recipe'}})).data;
   const path='/recipes/'+recipe.id;
   const suggestions=await request('/users/mention-targets?recipeId='+recipe.id+'&q=thread_target',{token:writer.accessToken});assert.equal(suggestions.status,200);assert.equal(suggestions.data[0].id,target.user.id);assert.equal(suggestions.data[0].email,undefined);
   const root=(await request(path+'/comments',{method:'POST',token:writer.accessToken,body:{text:'Привіт, @THREAD_OWNER та @thread_target! @thread_target @thread_writer'}})).data;
   assert.ok(root.id);assert.equal(root.mentions.length,2);
   const ownerNotice=(await request('/library/mentions',{token:owner.accessToken})).data;assert.equal(ownerNotice.unread,1);assert.equal(ownerNotice.items[0].comment.id,root.id);
   const targetNotice=(await request('/library/mentions',{token:target.accessToken})).data;assert.equal(targetNotice.unread,1);
   assert.equal((await request('/library/mentions/'+targetNotice.items[0].id+'/read',{method:'PUT',token:owner.accessToken})).status,404);
   assert.equal((await request('/library/mentions/'+targetNotice.items[0].id+'/read',{method:'PUT',token:target.accessToken})).status,200);
   const reply=(await request(path+'/comments',{method:'POST',token:owner.accessToken,body:{text:'Дякую за коментар',parentId:root.id}})).data;assert.equal(reply.parentId,root.id);
   const replied=(await request('/library/mentions',{token:writer.accessToken})).data;assert.equal(replied.unread,1);assert.equal(replied.items[0].kind,'reply');
   assert.equal((await request('/recipes/'+other.id+'/comments',{method:'POST',token:owner.accessToken,body:{text:'Wrong parent',parentId:root.id}})).status,404);
   assert.equal((await request(path+'/comments',{method:'POST',token:writer.accessToken,body:{text:Array.from({length:11},(_,i)=>'@unknown_'+i).join(' ')}})).status,400);
   await request('/users/me/profile',{method:'PUT',token:target.accessToken,body:{...profile,handle:'thread_target_new'}});
   const thread=(await request(path+'/discussion',{token:target.accessToken})).data;const originalMention=thread.comments.find(c=>c.id===root.id).mentions.find(m=>m.recipient.id===target.user.id);assert.equal(originalMention.handle,'thread_target');assert.equal(originalMention.recipient.handle,'thread_target_new');
   await request(path+'/rating',{method:'PUT',token:target.accessToken,body:{value:5}});
   const rated=(await request('/library/rated-recipes',{token:owner.accessToken})).data;assert.equal(rated.length,1);assert.equal(rated[0].averageRating,5);assert.equal(rated[0].ratingCount,1);
   assert.deepEqual((await request('/library/rated-recipes',{token:writer.accessToken})).data,[]);
   const mine=(await request('/library/comments/mine',{token:writer.accessToken})).data;assert.equal(mine[0].comments[0].id,root.id);
   const community=(await request('/library/comments/community',{token:owner.accessToken})).data;assert.equal(community[0].comments[0].user.id,writer.user.id);
   const stats=(await request('/library/stats',{token:owner.accessToken})).data;assert.equal(stats.myComments,1);assert.equal(stats.communityComments,1);
   const hiddenCandidates=(await request('/users/mention-targets?recipeId='+other.id+'&q=thread_target',{token:owner.accessToken})).data;assert.equal(hiddenCandidates.length,0);
   await request('/recipes/'+other.id+'/comments',{method:'POST',token:owner.accessToken,body:{text:'Приватно @thread_target_new'}});
   assert.equal((await request('/library/mentions',{token:target.accessToken})).data.items.length,1);
   assert.equal((await request(path+'/comments/'+root.id,{method:'DELETE',token:target.accessToken})).status,404);
   assert.equal((await request(path+'/comments/'+root.id,{method:'DELETE',token:writer.accessToken})).status,200);
   const after=(await request(path+'/discussion',{token:owner.accessToken})).data;assert.equal(after.comments.find(c=>c.id===root.id).text,'');assert.ok(after.comments.find(c=>c.id===root.id).deletedAt);assert.equal(after.comments.find(c=>c.id===reply.id).parentId,root.id);
   assert.equal((await request('/library/mentions',{token:target.accessToken})).data.items.length,0);
   assert.equal((await request(path+'/comments',{method:'POST',token:owner.accessToken,body:{text:'Reply to removed',parentId:root.id}})).status,404);
   await request(path,{method:'PUT',token:owner.accessToken,body:{...recipeData,title:'Threaded recipe',isShared:false}});
   assert.equal((await request('/library/mentions',{token:writer.accessToken})).data.items.length,0);
   assert.deepEqual((await request('/library/comments/mine',{token:writer.accessToken})).data,[]);
   assert.equal((await request('/library/mentions')).status,401);
  });

});

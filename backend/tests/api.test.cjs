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
  await t.test('ingredient creation requires login, validates category and rejects normalized duplicates', async () => {
    const body = { name: '  Садова   чорниця  ', category: 'Ягоди' };
    assert.equal((await request('/ingredients', { method: 'POST', body })).status, 401);
    assert.ok((await request('/ingredients/categories')).data.includes('Спеції'));
    for (const patch of [{ name: ' ' }, { category: 'invalid' }, { extra: true }]) {
      assert.equal((await request('/ingredients', { method: 'POST', token: session.accessToken, body: { ...body, ...patch } })).status, 400);
    }
    const result = await request('/ingredients', { method: 'POST', token: session.accessToken, body });
    assert.equal(result.status, 201); assert.equal(result.data.name, 'Садова чорниця'); assert.equal(result.data.category, 'Ягоди');
    assert.ok((await request('/ingredients')).data.some(item => item.id === result.data.id));
    assert.equal((await request('/ingredients', { method: 'POST', token: session.accessToken, body: { ...body, name: 'САДОВА ЧОРНИЦЯ' } })).status, 409);
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
    for (const patch of [{ calories: -1 }, { protein: 'lots' }, { fat: 1.234 }, { carbs: 10001 }, { calories: 100001 }, { authorId: second.user.id }, { isPublished: null }, { imageUrl: "javascript:alert(1)" }, { title: '   ' }, { instructions: ' ' }, { emoji: 'text' }, { ingredients: [] }, { ingredients: [...recipeData.ingredients, ...recipeData.ingredients] }, { ingredients: [{ ingredientId: randomUUID(), optional: false }] }, { ingredients: [{ ingredientId, quantity: -1, optional: false }] }]) {
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
    assert.equal((await request('/recipes', { method: 'POST', token: moderator.accessToken, body: { ...published, imageUrl: null } })).status, 400);
    const created = await request('/recipes', { method: 'POST', token: moderator.accessToken, body: published });
    assert.equal(created.status, 201);
    const path = `/recipes/${created.data.id}`;
    assert.equal((await request(path, { token: second.accessToken })).data.imageUrl, published.imageUrl);
    assert.equal((await request(path, { method: 'PUT', token: moderator.accessToken, body: { ...recipeData, imageUrl: null } })).status, 400);
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
    const category = await request('/ingredients/categories', {method:'POST',token:session.accessToken,body:{name:'Соуси тест'}});
    assert.equal(category.status,201);
    assert.ok((await request('/ingredients/categories')).data.includes('Соуси тест'));
    assert.equal((await request('/ingredients/categories',{method:'POST',token:session.accessToken,body:{name:'соуси тест'}})).status,409);
    const ingredient = await request('/ingredients',{method:'POST',token:session.accessToken,body:{name:'Песто тест',category:'Соуси тест',emoji:'🌿'}});
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
    await request(path,{method:'PUT',token:session.accessToken,body:{...recipeData,isShared:false}});
    assert.ok(!(await request('/users/'+session.user.id+'/profile',{token:second.accessToken})).data.recipes.some(r=>r.id===own.id));
    assert.equal((await request(path+'/discussion',{token:second.accessToken})).status,404);
  });

});

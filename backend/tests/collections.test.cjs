const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, readFileSync, readdirSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');

test('Private saved recipe collections and notes', { timeout: 90000 }, async t => {
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


 const register=async name=>{const r=await request('/auth/register',{method:'POST',body:{name,email:name+'@example.com',password:'Collections-test-2026!'}});assert.equal(r.status,201);return r.data;};
 const a=await register('collection_owner'),b=await register('collection_other');const token=a.accessToken,other=b.accessToken;
 const recipe=(await request('/recipes',{method:'POST',token,body:{title:'Нут із овочами',description:'Тестова страва',instructions:'1. Підготувати. 2. Подати.',emoji:'🍲',preparationMinutes:10,servings:2,difficulty:'EASY',isShared:true,ingredients:[{ingredientId,quantity:100,unit:'г',optional:false}]}})).data;assert.ok(recipe.id);
 const list=async (t=token)=>(await request('/library/collections',{token:t})).data;
 let first,second;
 await t.test('authentication, normalized unique names and private listing',async()=>{
  assert.equal((await request('/library/collections')).status,401);
  const r=await request('/library/collections',{method:'POST',token,body:{name:'  Швидкі   вечері  '}});assert.equal(r.status,201);first=r.data;assert.equal(first.name,'Швидкі вечері');
  assert.equal((await request('/library/collections',{method:'POST',token,body:{name:'швидкі вечері'}})).status,409);
  for(const name of ['','  ','x'.repeat(61)])assert.equal((await request('/library/collections',{method:'POST',token,body:{name}})).status,400);
  assert.deepEqual(await list(other),[]);second=(await request('/library/collections',{method:'POST',token,body:{name:'Спробувати'}})).data;
 });
 await t.test('cross-user writes cannot access collections',async()=>{
  for(const [path,method,body] of [[first.id,'PATCH',{name:'Нова'}],[first.id,'DELETE'],[first.id+'/items','PUT',{ids:[recipe.id]}],[first.id+'/items','DELETE',{ids:[recipe.id]}]])assert.equal((await request('/library/collections/'+path,{method,token:other,body})).status,404);
 });
 await t.test('only saved recipes, idempotence, atomic rejection and multiple collections',async()=>{
  const path='/library/collections/'+first.id+'/items';
  assert.equal((await request(path,{method:'PUT',token,body:{ids:[recipe.id]}})).status,400);
  await request('/recipes/'+recipe.id+'/favorite',{method:'PUT',token});
  assert.equal((await request(path,{method:'PUT',token,body:{ids:[recipe.id]}})).data.added,1);
  assert.equal((await request(path,{method:'PUT',token,body:{ids:[recipe.id]}})).data.added,0);
  assert.equal((await request(path,{method:'PUT',token,body:{ids:[recipe.id,randomUUID()]}})).status,400);
  assert.equal((await request('/library/collections/'+second.id+'/items',{method:'PUT',token,body:{ids:[recipe.id]}})).status,200);
  assert.ok((await list()).every(c=>c.recipeIds.length===1));
  assert.equal((await request('/library/collections/'+first.id,{method:'PATCH',token,body:{name:' СПРОБУВАТИ '}})).status,409);
 });
 await t.test('membership and collection deletion preserve saved recipes',async()=>{
  await request('/library/collections/'+first.id+'/items',{method:'DELETE',token,body:{ids:[recipe.id]}});assert.equal((await list()).find(c=>c.id===second.id).recipeIds.length,1);
  await request('/library/collections/'+first.id,{method:'DELETE',token});assert.equal((await list()).length,1);
  assert.equal((await request('/recipes/'+recipe.id+'/favorite',{token})).data.saved,true);
 });
 await t.test('un-saving cascades memberships and does not reveal hidden recipes',async()=>{
  await request('/management/recipes/'+recipe.id+'/hidden',{method:'PUT',token,body:{value:true}});assert.equal((await request('/recipes/'+recipe.id,{token:other})).status,404);
  await request('/recipes/'+recipe.id+'/favorite',{method:'DELETE',token});assert.equal((await list())[0].recipeIds.length,0);
  await request('/recipes/'+recipe.id+'/favorite',{method:'PUT',token});await request('/library/collections/'+second.id+'/items',{method:'PUT',token,body:{ids:[recipe.id]}});
  await request('/library/saved',{method:'DELETE',token,body:{ids:[recipe.id]}});assert.equal((await list())[0].recipeIds.length,0);
 });
 await t.test('private recipe notes are isolated per account, even for moderators',async()=>{
  await request('/management/recipes/'+recipe.id+'/hidden',{method:'PUT',token,body:{value:false}});
  const path='/recipes/'+recipe.id+'/note';
  assert.equal((await request(path)).status,401);assert.equal((await request(path,{method:'PUT',body:{text:'Спроба',revision:0}})).status,401);
  assert.equal((await request(path,{token})).data.revision,0);
  const saved=await request(path,{method:'PUT',token,body:{text:'Моя приватна порада',revision:0}});assert.equal(saved.status,200);assert.equal(saved.data.revision,1);
  const sql=new Database(dbPath);sql.prepare("UPDATE User SET role='MODERATOR' WHERE id=?").run(b.user.id);sql.close();
  assert.equal((await request(path,{token:other})).data.text,'');
  assert.equal((await request(path,{method:'PUT',token:other,body:{text:'Нотатка іншого користувача',revision:0}})).status,200);
  assert.equal((await request(path,{token})).data.text,'Моя приватна порада');
  assert.equal((await request(path,{method:'PUT',token,body:{text:'Спроба підміни',revision:1,userId:b.user.id}})).status,400);
 });
 await t.test('note revisions prevent silent overwrites, including after clearing text',async()=>{
  const path='/recipes/'+recipe.id+'/note';
  assert.equal((await request(path,{method:'PUT',token,body:{text:'Застарілий текст',revision:0}})).status,409);
  const empty=await request(path,{method:'PUT',token,body:{text:'',revision:1}});assert.equal(empty.status,200);assert.equal(empty.data.revision,2);
  assert.equal((await request(path,{method:'PUT',token,body:{text:'Застаріла вкладка',revision:1}})).status,409);
  assert.equal((await request(path,{token})).data.text,'');
  assert.equal((await request(path,{method:'PUT',token,body:{text:'x'.repeat(10001),revision:2}})).status,400);
 });
 await t.test('recipe removal cleans its private notes',async()=>{
  const sql=new Database(dbPath);assert.equal(sql.prepare('SELECT COUNT(*) n FROM RecipeNote WHERE recipeId=?').get(recipe.id).n,2);sql.close();
  assert.equal((await request('/recipes/'+recipe.id,{method:'DELETE',token})).status,200);
  const check=new Database(dbPath);assert.equal(check.prepare('SELECT COUNT(*) n FROM RecipeNote WHERE recipeId=?').get(recipe.id).n,0);check.close();
 });

});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, readFileSync, readdirSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');

test('Delegated administration, visibility, audit and moderation', { timeout: 90000 }, async t => {
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

  const register=async n=>{const r=await request('/auth/register',{method:'POST',body:{name:'Кухар '+n,email:n+'@example.com',password:'Testing-password-2026!'}});assert.equal(r.status,201);return r.data;};
  const owner=await register('owner'),admin=await register('admin'),outsider=await register('outsider'),moderator=await register('moderator');
  const sql=new Database(dbPath);sql.prepare("UPDATE User SET role='MODERATOR' WHERE id=?").run(moderator.user.id);sql.close();
  const tok=owner.accessToken,at=admin.accessToken,ot=outsider.accessToken,mt=moderator.accessToken;
  const recipeBody={title:'Суп автора',description:'Опис страви',instructions:'Підготувати продукти та подати.',emoji:'🍲',isShared:true,preparationMinutes:20,servings:2,difficulty:'EASY',ingredients:[{ingredientId,quantity:100,unit:'г',optional:false}]};
  const r=(await request('/recipes',{method:'POST',token:tok,body:recipeBody})).data;
  const other=(await request('/recipes',{method:'POST',token:ot,body:recipeBody})).data;
  const g={target:'@'+admin.user.handle,editRecipes:true,hideRecipes:false,manageComments:false,editProfile:false,instructions:'Не змінювати оригінальний стиль. Перевіряти одиниці виміру.'};
  const profile={name:'Автор після редагування',bio:'Оновлено адміністратором',avatarUrl:null,coverUrl:null,showRecipes:true};
  await t.test('ungranted access denied, owner cannot appoint self, no empty permissions',async()=>{
   assert.equal((await request('/management/workspace/'+owner.user.id,{token:at})).status,403);
   assert.equal((await request('/recipes/'+r.id,{method:'PUT',token:at,body:recipeBody})).status,404);
   assert.equal((await request('/management/grants',{method:'PUT',token:tok,body:{...g,target:owner.user.id}})).status,400);
   assert.equal((await request('/management/grants',{method:'PUT',token:tok,body:{...g,editRecipes:false}})).status,400);
  });
  await t.test('grant resolves unique handle, notifies full current rights and instructions',async()=>{
   const a=await request('/management/grants',{method:'PUT',token:tok,body:g});assert.equal(a.status,200);assert.equal(a.data.admin.id,admin.user.id);assert.equal(a.data.admin.email,undefined);
   const notices=(await request('/management/notices',{token:at})).data;assert.equal(notices.unread,1);assert.match(notices.items[0].text,/Редагувати рецепти/);assert.match(notices.items[0].text,/Перевіряти одиниці/);
   assert.equal((await request('/management/notices/'+notices.items[0].id+'/read',{method:'PUT',token:ot})).status,404);
   assert.equal((await request('/management/notices/'+notices.items[0].id+'/read',{method:'PUT',token:at})).status,200);
   assert.equal((await request('/management/assignments',{token:at})).data[0].owner.id,owner.user.id);
  });
  await t.test('limited edit works, no delete/author transfer/publication/hide/profile/escalation',async()=>{
   assert.equal((await request('/recipes/'+r.id,{method:'PUT',token:at,body:{...recipeBody,title:'Рецепт виправлено адміном'}})).status,200);
   assert.equal((await request('/recipes/'+other.id,{method:'PUT',token:at,body:recipeBody})).status,404);
   const official=(await request('/recipes',{method:'POST',token:mt,body:{...recipeBody,isPublished:true,authorId:owner.user.id}})).data;assert.ok(official.id);
   assert.equal((await request('/recipes/'+official.id,{method:'PUT',token:at,body:{...recipeBody,title:'Офіційний рецепт автора — виправлено'}})).status,200);
   assert.equal((await request('/recipes/'+official.id,{method:'PUT',token:at,body:{...recipeBody,isPublished:false}})).status,403);
   assert.equal((await request('/recipes/'+r.id,{method:'DELETE',token:at})).status,404);
   assert.equal((await request('/recipes/'+r.id,{method:'PUT',token:at,body:{...recipeBody,authorId:admin.user.id}})).status,403);
   assert.equal((await request('/recipes/'+r.id,{method:'PUT',token:at,body:{...recipeBody,isPublished:true}})).status,403);
   assert.equal((await request('/management/recipes/'+r.id+'/hidden',{method:'PUT',token:at,body:{value:true}})).status,403);
   assert.equal((await request('/recipes/'+r.id,{method:'PUT',token:at,body:{...recipeBody,isShared:false}})).status,403);
   assert.equal((await request('/management/profile/'+owner.user.id,{method:'PUT',token:at,body:profile})).status,403);
   assert.equal((await request('/management/grants',{method:'PUT',token:at,body:{...g,target:outsider.user.id,ownerId:owner.user.id}})).status,400);
   assert.equal((await request('/management/grants/'+admin.user.id,{method:'DELETE',token:at})).status,404);
   assert.equal((await request('/management/activity?ownerId='+owner.user.id,{token:at})).status,403);
  });
  let root,reply;
  await t.test('rights updates are effective, scoped profile edits and private recipe access',async()=>{
   assert.equal((await request('/management/grants',{method:'PUT',token:tok,body:{...g,hideRecipes:true,manageComments:true,editProfile:true}})).status,200);
   assert.equal((await request('/management/profile/'+owner.user.id,{method:'PUT',token:at,body:profile})).status,200);
   assert.equal((await request('/management/profile/'+owner.user.id,{method:'PUT',token:at,body:{...profile,handle:'steal_handle'}})).status,400);
   assert.equal((await request('/management/profile/'+owner.user.id,{method:'PUT',token:at,body:{...profile,role:'MODERATOR'}})).status,400);
   const priv=(await request('/recipes',{method:'POST',token:tok,body:{...recipeBody,isShared:false}})).data;
   assert.equal((await request('/recipes/'+priv.id,{token:at})).status,200);
   assert.equal((await request('/recipes/'+priv.id,{token:ot})).status,404);
   assert.equal((await request('/management/notices',{token:at})).data.items.length,2);
   root=(await request('/recipes/'+r.id+'/comments',{method:'POST',token:ot,body:{text:'Питання спільноти'}})).data;
   reply=(await request('/recipes/'+r.id+'/comments',{method:'POST',token:tok,body:{text:'Відповідь автора',parentId:root.id}})).data;
   const ac=(await request('/recipes/'+r.id+'/comments',{method:'POST',token:at,body:{text:'Уточнення адміністратора'}})).data;
   const discussion=(await request('/recipes/'+r.id+'/discussion',{token:ot})).data;
   assert.equal(discussion.comments.find(c=>c.id===reply.id).role,'author');assert.equal(discussion.comments.find(c=>c.id===ac.id).role,'admin');
  });
  await t.test('pin/hide/restore comments, parent text and activity do not leak hidden body',async()=>{
   assert.equal((await request('/management/comments/'+root.id+'/pinned',{method:'PUT',token:ot,body:{value:true}})).status,403);
   assert.equal((await request('/management/comments/'+root.id+'/pinned',{method:'PUT',token:at,body:{value:true}})).status,200);
   assert.ok((await request('/recipes/'+r.id+'/discussion',{token:ot})).data.comments.find(c=>c.id===root.id).pinnedAt);
   assert.equal((await request('/management/comments/'+root.id+'/hidden',{method:'PUT',token:at,body:{value:true}})).status,200);
   assert.equal((await request('/management/comments/'+root.id+'/pinned',{method:'PUT',token:at,body:{value:true}})).status,400);
   const publicD=(await request('/recipes/'+r.id+'/discussion',{token:ot})).data;
   assert.equal(publicD.comments.find(c=>c.id===root.id).text,'');assert.equal(publicD.comments.find(c=>c.id===root.id).pinnedAt,null);assert.equal(publicD.comments.find(c=>c.id===reply.id).parent.text,'');
   assert.equal((await request('/recipes/'+r.id+'/discussion',{token:tok})).data.comments.find(c=>c.id===root.id).text,'Питання спільноти');
   assert.ok(!(await request('/library/comments/mine',{token:ot})).data.some(x=>x.comments.some(c=>c.id===root.id)));
   assert.equal((await request('/recipes/'+r.id+'/comments',{method:'POST',token:ot,body:{text:'Спроба відповіді',parentId:root.id}})).status,404);
   assert.equal((await request('/management/comments/'+root.id+'/hidden',{method:'PUT',token:tok,body:{value:false}})).status,200);
  });
  await t.test('hidden recipes disappear in every public listing and direct route',async()=>{
   await request('/recipes/'+r.id+'/favorite',{method:'PUT',token:ot});await request('/library/follow/'+owner.user.id,{method:'PUT',token:ot});
   assert.equal((await request('/management/recipes/'+r.id+'/hidden',{method:'PUT',token:at,body:{value:true}})).status,200);
   assert.equal((await request('/recipes/'+r.id,{token:ot})).status,404);assert.equal((await request('/recipes/'+r.id+'/discussion',{token:ot})).status,404);
   for(const path of ['/recipes/community','/library/saved','/recommendations'])assert.ok(!(await request(path,{token:ot})).data.some(x=>x.id===r.id));
   assert.ok(!(await request('/users/'+owner.user.id+'/profile',{token:ot})).data.recipes.some(x=>x.id===r.id));
   assert.ok(!(await request('/library/following',{token:ot})).data.recipes.some(x=>x.id===r.id));
   assert.equal((await request('/library/saved-items',{token:ot})).data.find(x=>x.id===r.id).recipe,null);
   assert.equal((await request('/recipes/'+r.id,{token:tok})).status,200);assert.equal((await request('/recipes/'+r.id,{token:at})).status,200);
   assert.equal((await request('/management/recipes/'+r.id+'/hidden',{method:'PUT',token:at,body:{value:false}})).status,200);
   assert.equal((await request('/recipes/'+r.id,{token:ot})).status,200);
  });
  await t.test('owner journal has before/after, actor/action filtering and comparisons; moderator sees site and user stats',async()=>{
   const audit=(await request('/management/activity?ownerId='+owner.user.id+'&actors='+admin.user.id,{token:tok})).data;
   assert.ok(audit.total>=5);assert.ok(audit.items.every(e=>e.actorId===admin.user.id));assert.ok(audit.comparison.find(p=>p.id===admin.user.id).total>=5);
   const edits=(await request('/management/activity?ownerId='+owner.user.id+'&action=recipe.edit',{token:tok})).data;const originalEdit=edits.items.find(e=>e.targetId===r.id);assert.equal(originalEdit.details.before.title,'Суп автора');assert.equal(originalEdit.details.after.title,'Рецепт виправлено адміном');
   assert.equal((await request('/management/activity?subjectId='+admin.user.id,{token:at})).status,403);
   assert.ok((await request('/management/activity?subjectId='+admin.user.id,{token:mt})).data.items.some(e=>e.action==='recipe.edit'));
   assert.equal((await request('/moderation/overview',{token:ot})).status,403);assert.equal((await request('/moderation/users/'+owner.user.id,{token:ot})).status,403);
   assert.equal((await request('/moderation/overview',{token:mt})).data.users,4);assert.ok((await request('/moderation/users/'+owner.user.id,{token:mt})).data.recipes.length>=2);
   assert.equal((await request('/management/activity?ownerId='+owner.user.id,{token:mt})).status,200);
   assert.equal((await request('/management/comments/'+root.id+'/pinned',{method:'PUT',token:mt,body:{value:true}})).status,200);
  });
  await t.test('revocation and resignation immediately terminate rights; audit survives',async()=>{
   assert.equal((await request('/management/assignments/'+owner.user.id,{method:'DELETE',token:at})).status,200);
   assert.equal((await request('/management/workspace/'+owner.user.id,{token:at})).status,403);
   assert.equal((await request('/recipes/'+r.id,{method:'PUT',token:at,body:recipeBody})).status,404);
   await request('/management/grants',{method:'PUT',token:tok,body:g});
   assert.equal((await request('/management/grants/'+admin.user.id,{method:'DELETE',token:tok})).status,200);
   assert.equal((await request('/management/profile/'+owner.user.id,{token:at})).status,403);
   assert.ok((await request('/management/activity?ownerId='+owner.user.id+'&actors='+admin.user.id,{token:tok})).data.total>0);
  });
  await t.test('hard limit of five administrators and edits at limit',async()=>{
   const extra=[];for(let i=0;i<6;i++)extra.push(await register('limit'+i));
   for(let i=0;i<5;i++)assert.equal((await request('/management/grants',{method:'PUT',token:tok,body:{...g,target:extra[i].user.id}})).status,200);
   assert.equal((await request('/management/grants',{method:'PUT',token:tok,body:{...g,target:extra[5].user.id}})).status,400);
   assert.equal((await request('/management/grants',{method:'PUT',token:tok,body:{...g,target:extra[0].user.id,hideRecipes:true}})).status,200);
   assert.equal((await request('/management/grants',{token:tok})).data.length,5);
  });
});

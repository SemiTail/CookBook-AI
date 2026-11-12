const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, readFileSync, readdirSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');

test('Public browsing, freed handles, support cards and audit privacy', { timeout: 90000 }, async t => {
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

 const password='Public-test-2026!';const register=async name=>{const r=await request('/auth/register',{method:'POST',body:{name,email:name+'@example.com',password}});assert.equal(r.status,201);return r.data;};
 const owner=await register('public_owner'),viewer=await register('public_viewer'),mod=await register('public_mod');const ot=owner.accessToken,vt=viewer.accessToken,mt=mod.accessToken;
 const sql=new Database(dbPath);sql.prepare("UPDATE User SET role='MODERATOR' WHERE id=?").run(mod.user.id);sql.close();
 const profile={name:'Публічний кухар',handle:'available_cook',bio:'Відкритий опис',avatarUrl:'https://example.com/avatar.jpg',coverUrl:'https://example.com/cover.jpg',showRecipes:true};
 await request('/users/me/profile',{method:'PUT',token:ot,body:profile});
 const body={title:'Доступний рецепт',description:'Опис',instructions:'1. Підготувати.\n2. Подати.',emoji:'🍲',preparationMinutes:10,servings:2,difficulty:'EASY',isShared:true,ingredients:[{ingredientId,quantity:100,unit:'г',optional:false}]};
 const pub=(await request('/recipes',{method:'POST',token:ot,body})).data,priv=(await request('/recipes',{method:'POST',token:ot,body:{...body,isShared:false,title:'Приватна страва'}})).data,hidden=(await request('/recipes',{method:'POST',token:ot,body:{...body,title:'Прихована страва'}})).data;
 await request('/management/recipes/'+hidden.id+'/hidden',{method:'PUT',token:ot,body:{value:true}});
 const comment=(await request('/recipes/'+pub.id+'/comments',{method:'POST',token:vt,body:{text:'Дякую, @available_cook!'}})).data;
 await request('/recipes/'+pub.id+'/rating',{method:'PUT',token:vt,body:{value:4}});await request('/library/follow/'+owner.user.id,{method:'PUT',token:vt});await request('/library/follow/'+viewer.user.id,{method:'PUT',token:ot});
 await t.test('guests read public recipes, discussions, ratings and profiles without personal state',async()=>{
  assert.equal((await request('/recipes/'+pub.id)).status,200);for(const id of [priv.id,hidden.id]){assert.equal((await request('/recipes/'+id)).status,404);assert.equal((await request('/recipes/'+id+'/discussion')).status,404);}
  const discussion=(await request('/recipes/'+pub.id+'/discussion')).data;assert.equal(discussion.average,4);assert.equal(discussion.mine,null);assert.equal(discussion.permissions.manageComments,false);assert.equal(discussion.comments[0].text,'Дякую, @available_cook!');
  const p=(await request('/users/'+owner.user.id+'/profile')).data;assert.equal(p.name,profile.name);assert.equal(p.email,undefined);assert.equal(p.passwordHash,undefined);assert.equal(p.recipes.length,1);assert.equal((await request('/library/ratings')).data.find(r=>r.id===pub.id).average,4);
  assert.equal((await request('/recipes/'+pub.id,{token:'forged'})).status,401);
 });
 await t.test('guest access never authorizes writes or private account endpoints',async()=>{
  for(const path of ['/users/me','/recipes/mine','/fridge','/library/stats','/library/saved','/management/activity','/moderation/overview'])assert.equal((await request(path)).status,401,path);
  for(const [path,method,body] of [['/recipes/'+pub.id+'/comments','POST',{text:'Спроба'}],['/recipes/'+pub.id+'/rating','PUT',{value:5}],['/recipes/'+pub.id+'/favorite','PUT',undefined],['/library/follow/'+owner.user.id,'PUT',undefined],['/recipes/'+pub.id,'DELETE',undefined],['/management/comments/'+comment.id+'/pinned','PUT',{value:true}],['/reports','POST',{type:'USER',targetId:owner.user.id,reasons:['spam'],customReason:''}],['/users/me/profile','PUT',profile]])assert.equal((await request(path,{method,body})).status,401,path);
 });
 await t.test('profile cards expose only public live counts, cover/avatar and aggregate ratings',async()=>{
  const card=(await request('/users/profile-card?target=%40available_cook')).data;assert.equal(card.id,owner.user.id);assert.equal(card.recipeCount,1);assert.equal(card.averageRating,4);assert.equal(card.ratingCount,1);assert.equal(card.followers,1);assert.equal(card.following,1);assert.equal(card.profile.coverUrl,profile.coverUrl);assert.equal(card.profile.avatarUrl,profile.avatarUrl);for(const key of ['email','passwordHash','deletionReason','authVersion'])assert.equal(card[key],undefined);
  assert.equal((await request('/users/profile-card?target='+owner.user.id)).status,200);assert.equal((await request('/users/profile-card?target=unknown_handle')).status,404);
 });
 let guest;
 await t.test('both sides send profile cards and Markdown without leaking hidden profiles',async()=>{
  guest=(await request('/support/guest',{method:'POST',body:{name:'Гість',contactType:'EMAIL',contact:'guest@example.com',text:'**Вітаю** _модерацію_ [Профіль](https://example.com)',profileUserId:owner.user.id}})).data;assert.ok(guest.token);
  const reply=await request('/moderation/support/'+guest.id+'/messages',{method:'POST',token:mt,body:{text:'',profileUserId:owner.user.id}});assert.equal(reply.status,201);
  const chat=(await request('/support/guest/'+guest.id,{headers:{'X-Support-Token':guest.token}})).data;assert.equal(chat.messages[0].profileCard.id,owner.user.id);assert.match(chat.messages[0].text,/\*\*Вітаю\*\*/);assert.equal(chat.messages[1].profileCard.averageRating,4);
  assert.equal((await request('/support/guest/'+guest.id+'/messages',{method:'POST',headers:{'X-Support-Token':guest.token},body:{text:''}})).status,400);
  await request('/moderation/profiles/'+owner.user.id+'/hide',{method:'POST',token:mt,body:{reason:'Профіль тимчасово приховано'}});
  assert.equal((await request('/users/'+owner.user.id+'/profile')).status,404);assert.equal((await request('/users/profile-card?target='+owner.user.id)).status,404);assert.equal((await request('/recipes/'+pub.id)).status,404);
  const restricted=(await request('/support/guest/'+guest.id,{headers:{'X-Support-Token':guest.token}})).data;assert.ok(restricted.messages.every(m=>m.profileCard===null));
  assert.equal((await request('/moderation/support/'+guest.id+'/messages',{method:'POST',token:mt,body:{text:'Картка',profileUserId:owner.user.id}})).status,400);
  await request('/moderation/profiles/'+owner.user.id+'/restore',{method:'POST',token:mt,body:{reason:'Профіль перевірено та відновлено'}});
 });
 await t.test('moderation details never reach ordinary-owner audit responses, even after actor demotion',async()=>{
  const edited=await request('/recipes/'+pub.id,{method:'PUT',token:mt,body:{...body,title:'Перевірений рецепт'}});assert.equal(edited.status,200);
  const ordinary=(await request('/management/activity?ownerId='+owner.user.id,{token:ot})).data;assert.equal(ordinary.moderator,false);assert.ok(ordinary.items.filter(e=>e.actorId===mod.user.id).every(e=>e.details===null));
  const full=(await request('/management/activity?ownerId='+owner.user.id,{token:mt})).data;assert.equal(full.moderator,true);assert.ok(full.items.find(e=>e.action==='recipe.edit').details.before);
  const dbEdit=new Database(dbPath);dbEdit.prepare("UPDATE User SET role='USER' WHERE id=?").run(mod.user.id);dbEdit.close();
  assert.equal((await request('/management/activity?ownerId='+owner.user.id,{token:ot})).data.items.find(e=>e.action==='recipe.edit').details,null);
  const dbRestore=new Database(dbPath);dbRestore.prepare("UPDATE User SET role='MODERATOR' WHERE id=?").run(mod.user.id);dbRestore.close();
 });
 await t.test('moderator sets and resets handles; ordinary users cannot and occupied tags stay protected',async()=>{
  const path='/moderation/accounts/'+owner.user.id+'/handle';const change={action:'SET',handle:'@moderated_cook',reason:'Перевірене звернення власника'};
  assert.equal((await request(path,{method:'POST',token:vt,body:change})).status,403);
  assert.equal((await request(path,{method:'POST',token:mt,body:{...change,handle:'bad tag'}})).status,400);
  assert.equal((await request(path,{method:'POST',token:mt,body:{...change,handle:viewer.user.handle}})).status,409);
  assert.equal((await request(path,{method:'POST',token:mt,body:change})).data.handle,'moderated_cook');
  assert.match((await request(path,{method:'POST',token:mt,body:{...change,action:'RESET',handle:''}})).data.handle,/^user_[0-9a-f]{20}$/);
  assert.equal((await request(path,{method:'POST',token:mt,body:{...change,handle:'available_cook'}})).status,201);
 });
 await t.test('deletion releases the old handle, preserves immutable mention recipient and never reclaims it on restore',async()=>{
  assert.equal((await request('/account',{method:'DELETE',token:ot,body:{mode:'KEEP',recipeIds:[],confirmation:'ВИДАЛИТИ',password}})).status,200);
  const departed=(await request('/users/'+owner.user.id+'/profile')).data;assert.match(departed.handle,/^departed_[0-9a-f]{20}$/);assert.notEqual(departed.handle,'available_cook');assert.ok((await request('/moderation/overview?search='+encodeURIComponent(owner.user.email),{token:mt})).data.people.some(p=>p.id===owner.user.id));
  assert.equal((await request('/users/me/profile',{method:'PUT',token:vt,body:{...profile,name:'Новий власник тегу'}})).status,200);
  const matches=(await request('/support/guest/'+guest.id+'/profiles?target=%40available_cook',{headers:{'X-Support-Token':guest.token}})).data;assert.equal(matches.length,2);assert.ok(matches.find(p=>p.id===owner.user.id).previousHandles.includes('available_cook'));assert.equal((await request('/support/guest/'+guest.id+'/profiles?target=%40available_cook')).status,404);
  const discussion=(await request('/recipes/'+pub.id+'/discussion')).data;const mention=discussion.comments.find(c=>c.id===comment.id).mentions[0];assert.equal(mention.handle,'available_cook');assert.equal(mention.recipient.id,owner.user.id);assert.equal(mention.recipient.handle,departed.handle);
  assert.equal((await request('/moderation/accounts/'+owner.user.id+'/restore',{method:'POST',token:mt,body:{reason:'Власник підтвердив відновлення'}})).status,201);const restored=(await request('/auth/login',{method:'POST',body:{email:owner.user.email,password}})).data;
  assert.equal(restored.user.handle,departed.handle);assert.equal((await request('/users/profile-card?target=%40available_cook')).data.id,viewer.user.id);
  const audit=(await request('/management/activity?ownerId='+owner.user.id,{token:restored.accessToken})).data;assert.ok(audit.items.filter(e=>e.action.startsWith('account.')).every(e=>e.details===null));
 });
 await t.test('unique reposts, author statistics and moderator filter ordering',async()=>{
  const recipe=(await request('/recipes',{method:'POST',token:vt,body:{...body,title:'Пересилання для статистики'}})).data;
  assert.equal((await request('/recipes/'+recipe.id+'/repost',{method:'PUT'})).status,401);
  for(let i=0;i<3;i++)assert.equal((await request('/recipes/'+recipe.id+'/repost',{method:'PUT',token:mt})).data.count,1);
  assert.equal((await request('/recipes/'+recipe.id+'/repost',{method:'PUT',token:vt})).data.count,2);
  assert.equal((await request('/library/reposts')).data.find(r=>r.id===recipe.id).count,2);
  assert.equal((await request('/library/stats',{token:vt})).data.repostsReceived,2);
  assert.equal((await request('/library/stats',{token:mt})).data.repostsMade,1);
  const rows=(await request('/moderation/overview?sort=repostsReceived&direction=desc',{token:mt})).data.people;assert.equal(rows[0].id,viewer.user.id);
  assert.equal((await request('/moderation/overview?status=DELETED',{token:mt})).data.people.length,0);
  const alphabet=(await request('/moderation/overview?sort=name&direction=asc',{token:mt})).data.people.map(p=>p.name);assert.deepEqual(alphabet,[...alphabet].sort((a,b)=>a.localeCompare(b,'uk')));
  assert.equal((await request('/moderation/overview?sort=invalid',{token:mt})).status,400);
  assert.equal((await request('/recipes/'+priv.id+'/repost',{method:'PUT',token:vt})).status,404);
 });

 await t.test('audit categories and local-day ranges filter aggregates without weakening subject access',async()=>{
  const recipeEvents=(await request('/management/activity?category=recipe&ownerId='+viewer.user.id,{token:mt})).data;
  assert.ok(recipeEvents.total>0);assert.ok(recipeEvents.items.every(e=>e.action.startsWith('recipe.')));assert.equal(recipeEvents.comparison.reduce((sum,p)=>sum+p.total,0),recipeEvents.total);
  const comments=(await request('/management/activity?category=comment&subjectId='+viewer.user.id,{token:mt})).data;assert.ok(comments.total>0);assert.ok(comments.items.every(e=>e.action.startsWith('comment.')&&(e.actorId===viewer.user.id||e.ownerId===viewer.user.id)));
  assert.equal((await request('/management/activity?category=moderation&subjectId='+viewer.user.id,{token:vt})).status,403);
  const future=new URLSearchParams({fromAt:'2099-01-01T00:00:00.000Z',toAt:'2099-01-01T23:59:59.999Z'});assert.equal((await request('/management/activity?'+future,{token:mt})).data.total,0);
  for(const query of ['category=unknown','fromAt=invalid','fromAt=2099-01-01T00:00:00Z&toAt=2000-01-01T00:00:00Z'])assert.equal((await request('/management/activity?'+query,{token:mt})).status,400);
 });

});

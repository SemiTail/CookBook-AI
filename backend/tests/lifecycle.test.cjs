const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, readFileSync, readdirSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');

test('Account lifecycle, reporting and guest support', { timeout: 90000 }, async t => {
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

 const password='Lifecycle-password-2026!';const register=async name=>{const r=await request('/auth/register',{method:'POST',body:{name,email:name+'@example.com',password}});assert.equal(r.status,201);return r.data;};
 const mod=await register('moderation'),viewer=await register('viewer'),owner=await register('owner'),admin=await register('admin');const sql=new Database(dbPath);sql.prepare("UPDATE User SET role='MODERATOR' WHERE id=?").run(mod.user.id);sql.close();
 const mt=mod.accessToken,vt=viewer.accessToken,at=admin.accessToken,ot=owner.accessToken;
 const body={title:'Страва для збереження',description:'Опис',instructions:'Підготувати і подати.',emoji:'🍲',preparationMinutes:15,servings:2,difficulty:'EASY',isShared:false,ingredients:[{ingredientId,quantity:100,unit:'г',optional:false}]};
 const create=async(token,patch={})=>{const r=await request('/recipes',{method:'POST',token,body:{...body,...patch}});assert.equal(r.status,201);return r.data;};
 const outside=await create(vt,{isShared:true});const priv=await create(ot,{title:'Неопублікована'}),hidden=await create(ot,{title:'Прихована',isShared:true}),published=await create(ot,{title:'Опублікована',isShared:true}),unselected=await create(ot,{title:'Залишиться приватною'});
 await request('/management/recipes/'+hidden.id+'/hidden',{method:'PUT',token:ot,body:{value:true}});
 const originalComment=(await request('/recipes/'+outside.id+'/comments',{method:'POST',token:ot,body:{text:'Коментар майбутнього колишнього користувача'}})).data;
 await request('/users/me/profile',{method:'PUT',token:ot,body:{name:'Автор зі збереженим іменем',bio:'Старий опис',avatarUrl:'https://example.com/avatar.jpg',coverUrl:'https://example.com/cover.jpg',showRecipes:true}});
 await request('/management/grants',{method:'PUT',token:ot,body:{target:admin.user.id,editRecipes:true,hideRecipes:false,manageComments:false,editProfile:true,instructions:'Інструкція'}});
 await t.test('deletion preview is private, current password and explicit confirmation required',async()=>{
  const p=(await request('/account/deletion-preview',{token:ot})).data;assert.equal(p.total,4);assert.equal(p.hidden,1);assert.equal(p.unpublished,2);
  assert.equal((await request('/moderation/accounts/'+owner.user.id+'/deletion-preview',{token:at})).status,403);
  assert.equal((await request('/account',{method:'DELETE',token:ot,body:{mode:'KEEP',recipeIds:[],confirmation:'ВИДАЛИТИ',password:'wrong'}})).status,400);
  assert.equal((await request('/account',{method:'DELETE',token:ot,body:{mode:'KEEP',recipeIds:[],confirmation:'wrong',password}})).status,400);
  for(const ids of [[outside.id],[published.id],[]])assert.equal((await request('/account',{method:'DELETE',token:ot,body:{mode:'PUBLISH',recipeIds:ids,confirmation:'ВИДАЛИТИ',password}})).status,400);
  assert.equal((await request('/users/me',{token:ot})).status,200);
 });
 await t.test('publish selected private and hidden recipes, retain attribution and template, revoke sessions and grants',async()=>{
  const r=await request('/account',{method:'DELETE',token:ot,body:{mode:'PUBLISH',recipeIds:[priv.id,hidden.id],confirmation:'ВИДАЛИТИ',password}});assert.equal(r.status,200);assert.equal(r.data.publishedRecipes,2);
  for(const id of [priv.id,hidden.id,published.id]){const recipe=(await request('/recipes/'+id,{token:vt})).data;assert.equal(recipe.authorId,owner.user.id);assert.ok(recipe.author.deletedAt);assert.equal(recipe.hiddenAt,null);}
  assert.equal((await request('/recipes/'+unselected.id,{token:vt})).status,404);
  const p=(await request('/users/'+owner.user.id+'/profile',{token:vt})).data;assert.equal(p.name,'Автор зі збереженим іменем');assert.equal(p.profile.avatarUrl,'https://example.com/avatar.jpg');assert.equal(p.profile.coverUrl,null);assert.equal(p.profile.bio,'');assert.equal(p.email,undefined);assert.ok(p.deletedAt);
  assert.ok((await request('/recipes/'+priv.id+'/discussion',{token:vt})).data.authorDeleted);
  assert.ok((await request('/recipes/'+outside.id+'/discussion',{token:vt})).data.comments.find(c=>c.id===originalComment.id).user.deletedAt);
  assert.equal((await request('/users/me',{token:ot})).status,401);assert.equal((await request('/recipes',{method:'POST',token:ot,body})).status,401);
  assert.equal((await request('/auth/login',{method:'POST',body:{email:owner.user.email,password}})).status,401);
  assert.equal((await request('/management/assignments',{token:at})).data.length,0);
  const archived=(await request('/moderation/accounts/'+owner.user.id+'/deletion-preview',{token:mt})).data;assert.equal(archived.user.email,owner.user.email);
 });
 await t.test('moderator restoration keeps old tokens invalid and requires auditable reason',async()=>{
  assert.equal((await request('/moderation/accounts/'+owner.user.id+'/restore',{method:'POST',token:vt,body:{reason:'Перевірено звернення'}})).status,403);
  assert.equal((await request('/moderation/accounts/'+owner.user.id+'/restore',{method:'POST',token:mt,body:{reason:'     '}})).status,400);
  assert.equal((await request('/moderation/accounts/'+owner.user.id+'/restore',{method:'POST',token:mt,body:{reason:'Власник підтвердив звернення'}})).status,201);
  assert.equal((await request('/users/me',{token:ot})).status,401);
  const login=await request('/auth/login',{method:'POST',body:{email:owner.user.email,password}});assert.equal(login.status,200);assert.equal((await request('/users/me',{token:login.data.accessToken})).status,200);
  assert.equal((await request('/recipes/'+priv.id,{token:vt})).data.author.deletedAt,null);
 });
 await t.test('all other deletion modes affect only recipes currently authored by that account',async()=>{
  for(const mode of ['ALL','UNPUBLISHED','KEEP']){
   const actor=await register('mode_'+mode.toLowerCase());const token=actor.accessToken;
   const a=await create(token),b=await create(token,{isShared:true}),c=await create(token,{isShared:true});await request('/management/recipes/'+c.id+'/hidden',{method:'PUT',token,body:{value:true}});
   const comment=(await request('/recipes/'+outside.id+'/comments',{method:'POST',token,body:{text:'Мій коментар залишається'}})).data;
   const result=await request('/account',{method:'DELETE',token,body:{mode,recipeIds:[],confirmation:'ВИДАЛИТИ',password}});assert.equal(result.status,200);assert.equal(result.data.deletedRecipes,mode==='ALL'?3:mode==='UNPUBLISHED'?2:0);
   const dbRead=new Database(dbPath,{readonly:true});assert.equal(dbRead.prepare('SELECT COUNT(*) n FROM Recipe WHERE authorId=?').get(actor.user.id).n,mode==='ALL'?0:mode==='UNPUBLISHED'?1:3);dbRead.close();
   assert.ok((await request('/recipes/'+outside.id+'/discussion',{token:vt})).data.comments.find(x=>x.id===comment.id).user.deletedAt);
   assert.equal((await request('/recipes/'+outside.id,{token:vt})).status,200);
  }
 });
 await t.test('moderation can deactivate with reason; delegated editor cannot; last moderator protected',async()=>{
  assert.equal((await request('/moderation/accounts/'+admin.user.id+'/delete',{method:'POST',token:at,body:{mode:'KEEP',recipeIds:[],confirmation:'ВИДАЛИТИ',reason:'Порушення правил'}})).status,403);
  assert.equal((await request('/moderation/accounts/'+admin.user.id+'/delete',{method:'POST',token:mt,body:{mode:'KEEP',recipeIds:[],confirmation:'ВИДАЛИТИ',reason:'   '}})).status,400);
  assert.equal((await request('/moderation/accounts/'+admin.user.id+'/delete',{method:'POST',token:mt,body:{mode:'KEEP',recipeIds:[],confirmation:'ВИДАЛИТИ',reason:'Повторні порушення правил сервісу'}})).status,201);
  assert.equal((await request('/users/me',{token:at})).status,401);
  assert.ok((await request('/management/activity?ownerId='+admin.user.id,{token:mt})).data.items.some(e=>e.action==='account.delete'&&e.details.reason==='Повторні порушення правил сервісу'));
  assert.equal((await request('/account',{method:'DELETE',token:mt,body:{mode:'KEEP',recipeIds:[],confirmation:'ВИДАЛИТИ',password}})).status,400);
 });

 const reporter=await register('reporter'),rt=reporter.accessToken;
 await t.test('reports validate reasons, ownership and recipe access; duplicate open reports rejected',async()=>{
  const data={type:'COMMENT',targetId:originalComment.id,reasons:['harassment','privacy'],customReason:'Прошу перевірити цей коментар'};
  assert.equal((await request('/reports',{method:'POST',token:rt,body:{...data,reasons:[],customReason:''}})).status,400);
  assert.equal((await request('/reports',{method:'POST',token:rt,body:{...data,reasons:['invented']}})).status,400);
  assert.equal((await request('/reports',{method:'POST',token:rt,body:{...data,reasons:['other'],customReason:'  '}})).status,400);
  assert.equal((await request('/reports',{method:'POST',token:rt,body:{...data,type:'USER',targetId:reporter.user.id}})).status,400);
  assert.equal((await request('/reports',{method:'POST',token:rt,body:{...data,type:'RECIPE',targetId:unselected.id}})).status,404);
  const r=await request('/reports',{method:'POST',token:rt,body:data});assert.equal(r.status,201);
  assert.equal((await request('/reports',{method:'POST',token:rt,body:data})).status,409);
  assert.equal((await request('/moderation/reports',{token:rt})).status,403);
  assert.equal((await request('/moderation/reports/'+r.data.id+'/decision',{method:'POST',token:rt,body:{action:'HIDE_COMMENT',note:'Порушення підтверджено'}})).status,403);
  const list=(await request('/moderation/reports',{token:mt})).data;const row=list.items.find(x=>x.id===r.data.id);assert.equal(row.reporter.id,reporter.user.id);assert.equal(row.reporter.email,undefined);assert.match(row.snapshot.text,/колишнього/);
  assert.equal((await request('/moderation/reports/'+r.data.id+'/decision',{method:'POST',token:mt,body:{action:'HIDE_COMMENT',note:'Підтверджено порушення приватності'}})).status,201);
  const c=(await request('/recipes/'+outside.id+'/discussion',{token:rt})).data.comments.find(x=>x.id===originalComment.id);assert.equal(c.text,'');assert.ok(c.hiddenAt);
  assert.equal((await request('/moderation/reports/'+r.data.id+'/decision',{method:'POST',token:mt,body:{action:'DISMISS',note:'Друге рішення'}})).status,409);
  assert.ok((await request('/management/notices',{token:rt})).data.items.some(n=>n.title==='Вашу скаргу розглянуто'));
 });
 await t.test('quick report decisions hide recipes/profiles consistently and dismiss with logged reason',async()=>{
  const r=(await request('/reports',{method:'POST',token:rt,body:{type:'RECIPE',targetId:outside.id,reasons:['misleading'],customReason:''}})).data;
  assert.equal((await request('/moderation/reports/'+r.id+'/decision',{method:'POST',token:mt,body:{action:'HIDE_RECIPE',note:'Вміст потребує перевірки'}})).status,201);assert.equal((await request('/recipes/'+outside.id,{token:rt})).status,404);
  await request('/management/recipes/'+outside.id+'/hidden',{method:'PUT',token:mt,body:{value:false}});
  const profile=(await request('/reports',{method:'POST',token:rt,body:{type:'PROFILE',targetId:viewer.user.id,reasons:['inappropriate'],customReason:''}})).data;
  assert.equal((await request('/moderation/reports/'+profile.id+'/decision',{method:'POST',token:mt,body:{action:'HIDE_PROFILE',note:'Профіль порушує правила спільноти'}})).status,201);
  assert.equal((await request('/users/'+viewer.user.id+'/profile',{token:rt})).status,404);assert.equal((await request('/recipes/'+outside.id,{token:rt})).status,404);assert.equal((await request('/recipes/'+outside.id,{token:mt})).status,200);
  assert.ok(!(await request('/recipes/community')).data.some(x=>x.id===outside.id));assert.ok(!(await request('/library/ratings',{token:rt})).data.some(x=>x.id===outside.id));
  assert.equal((await request('/moderation/profiles/'+viewer.user.id+'/restore',{method:'POST',token:mt,body:{reason:'Порушення усунуто власником'}})).status,201);assert.equal((await request('/recipes/'+outside.id,{token:rt})).status,200);
  const dismiss=(await request('/reports',{method:'POST',token:rt,body:{type:'USER',targetId:viewer.user.id,reasons:['spam'],customReason:''}})).data;
  assert.equal((await request('/moderation/reports/'+dismiss.id+'/decision',{method:'POST',token:mt,body:{action:'DISMISS',note:'Не виявлено порушення правил'}})).status,201);
  assert.ok((await request('/moderation/reports?status=DISMISSED',{token:mt})).data.items.some(x=>x.id===dismiss.id));
 });
 let guest;
 await t.test('guest contact validation, secret-only chat access, moderator-only queue and no external-delivery claims',async()=>{
  const data={name:'Гість перевірки',contactType:'EMAIL',contact:'Guest@Example.com',text:'Потрібна допомога з відновленням акаунта'};
  for(const patch of [{contact:'bad'},{contactType:'PHONE',contact:'letters'},{text:'   '}])assert.equal((await request('/support/guest',{method:'POST',body:{...data,...patch}})).status,400);
  const response=await request('/support/guest',{method:'POST',body:data});assert.equal(response.status,201);guest=response.data;assert.match(guest.token,/^[0-9a-f]{64}$/);
  assert.equal((await request('/support/guest/'+guest.id)).status,404);assert.equal((await request('/support/guest/'+guest.id,{headers:{'X-Support-Token':'a'.repeat(64)}})).status,404);
  const chat=(await request('/support/guest/'+guest.id,{headers:{'X-Support-Token':guest.token}})).data;assert.equal(chat.contact,'guest@example.com');assert.equal(chat.tokenHash,undefined);assert.equal(chat.ipHash,undefined);assert.equal(chat.externalDeliveryAvailable,false);
  assert.equal((await request('/moderation/support')).status,401);assert.equal((await request('/moderation/support',{token:rt})).status,403);
  const queue=(await request('/moderation/support',{token:mt})).data;assert.equal(queue.items[0].contact,'guest@example.com');assert.equal(queue.items[0].tokenHash,undefined);
  assert.equal((await request('/moderation/support/'+guest.id+'/messages',{method:'POST',token:rt,body:{text:'Несправжня відповідь'}})).status,403);
 });
 await t.test('moderator and guest exchange messages; unread reply queued, read or manual transmission clears it',async()=>{
  const reply=await request('/moderation/support/'+guest.id+'/messages',{method:'POST',token:mt,body:{text:'Перевірте контактні дані для відновлення'}});assert.equal(reply.status,201);assert.equal(reply.data.deliveryStatus,'QUEUED');
  assert.equal((await request('/moderation/support?status=QUEUE',{token:mt})).data.queued,1);
  const received=(await request('/support/guest/'+guest.id,{headers:{'X-Support-Token':guest.token}})).data;assert.ok(received.messages.some(m=>m.id===reply.data.id&&m.deliveryStatus==='READ'));assert.equal((await request('/moderation/support?status=QUEUE',{token:mt})).data.queued,0);
  const reply2=(await request('/moderation/support/'+guest.id+'/messages',{method:'POST',token:mt,body:{text:'Додаткова відповідь на контакт'}})).data;
  assert.equal((await request('/moderation/support/'+guest.id+'/messages/'+reply2.id+'/delivered',{method:'POST',token:rt})).status,403);
  assert.equal((await request('/moderation/support/'+guest.id+'/messages/'+reply2.id+'/delivered',{method:'POST',token:mt})).status,201);
  assert.equal((await request('/moderation/support?status=QUEUE',{token:mt})).data.queued,0);
  assert.equal((await request('/moderation/support/'+guest.id+'/status',{method:'POST',token:mt,body:{status:'CLOSED'}})).status,201);
  assert.equal((await request('/support/guest/'+guest.id+'/messages',{method:'POST',headers:{'X-Support-Token':guest.token},body:{text:'Дякую, ще одне уточнення'}})).status,201);
  assert.equal((await request('/moderation/support/'+guest.id,{token:mt})).data.status,'OPEN');
 });
 await t.test('guest spam limits and validated phone contact persist in isolated database',async()=>{
  const data={name:'Телефонний гість',contactType:'PHONE',contact:'+380 (67) 123-45-67',text:'Потрібна допомога'};
  const phone=(await request('/support/guest',{method:'POST',body:data})).data;assert.ok(phone.id);assert.equal((await request('/support/guest/'+phone.id,{headers:{'X-Support-Token':phone.token}})).data.contact,'+380671234567');
  assert.equal((await request('/support/guest',{method:'POST',body:data})).status,201);assert.equal((await request('/support/guest',{method:'POST',body:data})).status,400);
  for(let i=0;i<28;i++)assert.equal((await request('/support/guest/'+guest.id+'/messages',{method:'POST',headers:{'X-Support-Token':guest.token},body:{text:'Уточнення '+i}})).status,201);
  assert.equal((await request('/support/guest/'+guest.id+'/messages',{method:'POST',headers:{'X-Support-Token':guest.token},body:{text:'Понад ліміт'}})).status,400);
 });
});

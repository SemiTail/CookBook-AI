// Read-only collection verification in an isolated database copy.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {spawn}=require('node:child_process');
const {mkdtempSync,mkdirSync,rmSync,readFileSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join,resolve}=require('node:path');
const {randomBytes}=require('node:crypto');
const {createServer}=require('node:net');
const assert=require('node:assert/strict');
const Database=require('../../backend/node_modules/better-sqlite3');
const root=resolve(__dirname,'../..'),directory=mkdtempSync(join(tmpdir(),'cookbook-collection-')),children=[],exits=[];
const data=JSON.parse(readFileSync(join(__dirname,'official-recipes.json'),'utf8'));
let browser;
async function port(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
function launch(args,cwd,env){const p=spawn(process.execPath,args,{cwd,env:{...process.env,...env},windowsHide:true,stdio:['ignore','pipe','pipe']});let out='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>out+=d);children.push(p);exits.push(new Promise(r=>p.once('exit',r)));return ()=>out;}
async function ready(url,logs){for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,150));}throw Error(logs());}
async function main(){
 const dbPath=join(directory,'copy.db');const db=new Database(join(root,'backend/dev.db'),{readonly:true});await db.backup(dbPath);db.close();const showcaseDb=new Database(dbPath);showcaseDb.prepare('UPDATE Profile SET showRecipes=1 WHERE userId=?').run(data.recipes[0].authorId);showcaseDb.close();
 const apiPort=await port(),uiPort=await port();
 const apiLog=launch(['dist/src/main.js'],join(root,'backend'),{PORT:String(apiPort),HOST:'127.0.0.1',DATABASE_URL:'file:'+dbPath.replaceAll('\\','/'),JWT_SECRET:randomBytes(32).toString('hex')});
 const uiLog=launch(['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(uiPort),'--strictPort'],join(root,'frontend'),{API_PROXY_TARGET:'http://127.0.0.1:'+apiPort});
 await ready('http://127.0.0.1:'+apiPort+'/api/v1/health',apiLog);const url='http://127.0.0.1:'+uiPort;await ready(url,uiLog);
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('cookbook-theme','dark'));
 await page.goto(url+'/register');await page.getByLabel('Ім’я',{exact:true}).fill('Перевірка каталогу');await page.getByLabel('Email',{exact:true}).fill('collection-'+Date.now()+'@example.com');await page.getByLabel('Пароль',{exact:true}).fill('Collection-test-2026!');await page.getByLabel('Підтвердження пароля',{exact:true}).fill('Collection-test-2026!');await page.getByRole('button',{name:'Зареєструватися',exact:true}).click();await page.waitForURL('**/dashboard');
 await page.getByRole('tab',{name:'Офіційні',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.recipe-card').length===250);
 const output=join(root,'tmp/browser-smoke');mkdirSync(output,{recursive:true});
 for(const meal of ['BREAKFAST','LUNCH','DINNER','SNACK','DESSERT']){
  await page.getByLabel('Прийом їжі',{exact:true}).selectOption(meal);assert.equal(await page.locator('.recipe-card').count(),50);
  const cardNames=await page.locator('.recipe-card h3').allTextContents();assert.equal(new Set(cardNames).size,50);
 }
 await page.locator('.recipes-section').scrollIntoViewIfNeeded();await page.screenshot({path:join(output,'official-collection-desktop.png')});
 for(const meal of ['BREAKFAST','LUNCH','DINNER','SNACK','DESSERT']){
  const recipe=data.recipes.find(x=>x.mealType===meal);await page.goto(url+'/recipes/'+recipe.id);await page.getByRole('heading',{name:recipe.title,exact:true}).waitFor();
  assert.equal(await page.locator('.ingredients-list li').count(),recipe.ingredients.length);
  assert.ok(await page.locator('.panel .markdown ol li').count()>=4);
  await page.getByRole('link',{name:'Профіль автора CookBook AI',exact:true}).waitFor();
 }

 const session=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('cookbook-demo-session')));
 const rating=await page.request.put(url+'/api/v1/recipes/'+data.recipes[10].id+'/rating',{headers:{Authorization:'Bearer '+session.accessToken},data:{value:5}});assert.equal(rating.status(),200);
 await page.goto(url+'/users/'+data.recipes[0].authorId);await page.getByRole('heading',{name:'Вітрина рецептів',exact:true}).waitFor();
 const publicRecipes=await (await page.request.get(url+'/api/v1/users/'+data.recipes[0].authorId+'/profile',{headers:{Authorization:'Bearer '+session.accessToken}})).json();
 assert.equal(await page.locator('.recipe-card').count(),publicRecipes.recipes.length);
 await page.getByLabel('Сортування рецептів користувача',{exact:true}).selectOption('rating');
 const ratedCard=page.locator('.recipe-card').filter({has:page.getByRole('heading',{name:data.recipes[10].title,exact:true})});assert.equal(await ratedCard.locator('.recipe-meta strong').first().textContent(),'★ 5.0');assert.equal(await page.locator('.profile-recipe-rating').count(),0);const ratingOrder=await page.locator('.recipe-card h3').allTextContents();const unrated=publicRecipes.recipes.find(r=>!r.ratingCount);assert.ok(ratingOrder.indexOf(data.recipes[10].title)<ratingOrder.indexOf(unrated.title));
 await page.getByLabel('Пошук рецептів користувача',{exact:true}).fill('неіснуючий рецепт');assert.equal(await page.locator('.recipe-card').count(),0);
 await page.getByRole('button',{name:'Скинути фільтри вітрини',exact:true}).click();
 await page.getByLabel('Пошук рецептів користувача',{exact:true}).fill('ВІВСЯНКА');assert.ok(await page.locator('.recipe-card').count()>0);
 await page.getByRole('button',{name:'Скинути фільтри вітрини',exact:true}).click();
 await page.getByLabel('Прийом їжі у вітрині',{exact:true}).selectOption('DESSERT');assert.equal(await page.locator('.recipe-card').count(),publicRecipes.recipes.filter(r=>r.mealType==='DESSERT').length);
 await page.getByLabel('Сортування рецептів користувача',{exact:true}).selectOption('time');
 await page.locator('.profile-recipe-controls').scrollIntoViewIfNeeded();await page.screenshot({path:join(output,'profile-showcase-desktop.png')});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:join(output,'profile-showcase-mobile.png')});const hiddenDb=new Database(dbPath);hiddenDb.prepare('UPDATE Profile SET showRecipes=0 WHERE userId=?').run(data.recipes[0].authorId);hiddenDb.close();await page.reload();await page.getByText('Користувач приховав свою вітрину рецептів.',{exact:true}).waitFor();assert.equal(await page.getByLabel('Пошук рецептів користувача',{exact:true}).count(),0);assert.equal(await page.locator('.recipe-card').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS: 250 official recipes; 50 per meal; five detailed recipes, authors, ingredients, Markdown, mobile fit.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();for(const p of children)p.kill();await Promise.all(exits);rmSync(directory,{recursive:true,force:true});});

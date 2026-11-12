const fs=require('node:fs');
let source=fs.readFileSync('scripts/reposts-browser-smoke.cjs','utf8');
source=source.replace(" const modPage=",` await page.context().route('https://card-preview.test/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#244535"/><circle cx="650" cy="140" r="240" fill="#657e3e"/><path d="M0 340 Q250 60 800 340 V400 H0Z" fill="#344f2c"/></svg>'}));
 await page.request.put(url+'/api/v1/users/me/profile',{headers,data:{name:session.user.name,bio:'',avatarUrl:null,coverUrl:'https://card-preview.test/cover.svg',showRecipes:true}});
 const modPage=`);
source=source.replace("await modPage.screenshot({path:join(output,'moderation-repost-filters-desktop.png')});", "await modPage.waitForFunction(()=>[...document.querySelectorAll('.moderation-user-portrait img')].every(i=>i.complete),{},{timeout:20000});await modPage.locator('.moderation-users-grid').screenshot({path:join(output,'moderation-user-cards-desktop.png')});");
source=source.replace("await modPage.screenshot({path:join(output,'moderation-filters-mobile.png')});", "await modPage.locator('.moderation-users-grid').screenshot({path:join(output,'moderation-user-cards-mobile.png')});");
const Module=require('node:module');const path=require('node:path');const filename=path.resolve('scripts/reposts-browser-smoke.cjs');const task=new Module(filename,module);task.filename=filename;task.paths=Module._nodeModulePaths(path.dirname(filename));task._compile(source,filename);

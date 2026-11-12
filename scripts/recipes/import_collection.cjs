// Original official collection: inspect by default, add with --apply. Existing recipes are never overwritten.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const Database=require('../../backend/node_modules/better-sqlite3');
const {calculateNutrition}=require('../../backend/dist/src/recipes/nutrition.js');
const root=path.resolve(__dirname,'../..');
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'official-recipes.json'),'utf8').replace(/^\uFEFF/,''));
const apply=process.argv.includes('--apply');
const databaseArg=process.argv.indexOf('--database');
const database=databaseArg<0?path.join(root,'backend/dev.db'):path.resolve(process.argv[databaseArg+1]);
const db=new Database(database,{readonly:!apply,fileMustExist:true});
db.pragma('foreign_keys=ON');db.pragma('busy_timeout=30000');
const digest=rows=>crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const protectedTables=['User','Profile','FridgeItem','Favorite','ShoppingListItem','ChatTurn','Comment','Rating','Follow','RecipePhoto'];
const before=Object.fromEntries(protectedTables.map(name=>[name,digest(db.prepare('SELECT * FROM "'+name+'" ORDER BY rowid').all())]));
const originals=db.prepare('SELECT * FROM Recipe ORDER BY id').all();
const originalLinks=db.prepare('SELECT * FROM RecipeIngredient ORDER BY recipeId,ingredientId').all();
const originalAuthors=db.prepare('SELECT * FROM RecipeAuthorship ORDER BY recipeId').all();
const ingredients=db.prepare('SELECT * FROM Ingredient').all().map(x=>({...x,nutritionRange:x.nutritionRange?JSON.parse(x.nutritionRange):null}));
const byName=new Map(ingredients.map(x=>[x.name,x]));
const counts={BREAKFAST:0,LUNCH:0,DINNER:0,SNACK:0,DESSERT:0};
const existingIds=new Set(originals.map(x=>x.id));
const newRecipes=[];
let approximate=0;
for(const recipe of source.recipes){
 assert.ok(recipe.mealType in counts);counts[recipe.mealType]++;
 assert.equal(recipe.isPublished,true);assert.equal(recipe.nutritionAuto,true);
 const author=db.prepare('SELECT id,role FROM User WHERE id=?').get(recipe.authorId);assert.equal(author?.role,'MODERATOR','Official author missing');
 const resolved=recipe.ingredients.map(x=>{const ingredient=byName.get(x.name);assert.ok(ingredient,'Missing ingredient: '+x.name);assert.ok(x.quantity>0&&x.unit==='г');return {...x,ingredientId:ingredient.id};});
 assert.equal(new Set(resolved.map(x=>x.ingredientId)).size,resolved.length);
 const nutrition=calculateNutrition(resolved.map(x=>({...x,quantity:String(x.quantity)})),ingredients,recipe.servings);
 for(const value of Object.values(nutrition))assert.ok(Number.isFinite(Number(value))&&Number(value)>=0);
 if(resolved.some(x=>byName.get(x.name).nutritionStatus!=='verified'))approximate++;
 if(existingIds.has(recipe.id))continue;
 assert.ok(!originals.some(x=>x.title.toLocaleLowerCase('uk')===recipe.title.toLocaleLowerCase('uk')),'Existing recipe has same title: '+recipe.title);
 newRecipes.push({...recipe,ingredients:resolved,...Object.fromEntries(Object.entries(nutrition).map(([k,v])=>[k,Number(v)]))});
}
assert.deepEqual(Object.values(counts),[50,50,50,50,50]);
assert.equal(new Set(source.recipes.map(x=>x.id)).size,250);
console.log(JSON.stringify({mode:apply?'apply':'review',counts,newRecipes:newRecipes.length,alreadyPresent:250-newRecipes.length,withReferenceRangeNutrition:approximate}));
console.log('Nutrition sample:',JSON.stringify(newRecipes.slice(0,3).map(x=>({title:x.title,servings:x.servings,kcal:x.calories,protein:x.protein,fat:x.fat,carbs:x.carbs}))));
async function main(){
 if(!apply||!newRecipes.length){db.close();return;}
 const backupDirectory=path.join(root,'tmp/nutrition/backups');fs.mkdirSync(backupDirectory,{recursive:true});
 const backup=path.join(backupDirectory,'pre-official-recipes-'+new Date().toISOString().replace(/[:.]/g,'-')+'.db');
 await db.backup(backup);console.log('Backup:',backup);
 const insert=db.prepare('INSERT INTO Recipe(id,title,emoji,description,imageUrl,instructions,preparationMinutes,servings,difficulty,calories,protein,fat,carbs,nutritionAuto,mealType,isShared,isPublished,authorId,publishedAt,createdAt,updatedAt) VALUES (@id,@title,@emoji,@description,@imageUrl,@instructions,@preparationMinutes,@servings,@difficulty,@calories,@protein,@fat,@carbs,1,@mealType,0,1,@authorId,@publishedAt,@createdAt,@updatedAt)');
 const link=db.prepare('INSERT INTO RecipeIngredient(recipeId,ingredientId,quantity,unit,optional) VALUES (?,?,?,?,0)');
 const author=db.prepare('INSERT INTO RecipeAuthorship(recipeId,userId) VALUES (?,?)');
 const stamp=new Date().toISOString();
 db.transaction(()=>{
  for(const recipe of newRecipes){
   insert.run({...recipe,publishedAt:stamp,createdAt:stamp,updatedAt:stamp});
   for(const item of recipe.ingredients)link.run(recipe.id,item.ingredientId,item.quantity,item.unit);
   author.run(recipe.id,recipe.authorId);
  }
  for(const original of originals)assert.deepEqual(db.prepare('SELECT * FROM Recipe WHERE id=?').get(original.id),original);
  for(const original of originalLinks)assert.deepEqual(db.prepare('SELECT * FROM RecipeIngredient WHERE recipeId=? AND ingredientId=?').get(original.recipeId,original.ingredientId),original);
  for(const original of originalAuthors)assert.deepEqual(db.prepare('SELECT * FROM RecipeAuthorship WHERE recipeId=?').get(original.recipeId),original);
  for(const name of protectedTables)assert.equal(digest(db.prepare('SELECT * FROM "'+name+'" ORDER BY rowid').all()),before[name],name+' changed');
  assert.equal(db.pragma('foreign_key_check').length,0);
  assert.equal(db.pragma('integrity_check',{simple:true}),'ok');
 })();
 console.log('Inserted',newRecipes.length,'official recipes; existing recipes and personal data unchanged.');
 db.close();
}
main().catch(error=>{console.error(error);db.close();process.exitCode=1;});

import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateNutrition } from "./nutrition.ts";

const catalog = [{ id: "tomato", name: "Помідор", category: "Овочі", caloriesPer100g: 18, proteinPer100g: 0.9, fatPer100g: 0.2, carbsPer100g: 3.9 }];
test("nutrition converts kg, divides portions, and rounds values", () => {
  assert.deepEqual(calculateNutrition([{ ingredientId: "tomato", quantity: "0.25", unit: "кг" }], catalog, 2), { calories: "22.5", protein: "1.13", fat: "0.25", carbs: "4.88" });
});
test("nutrition rejects missing data, units and portions instead of guessing", () => {
  const row = { ingredientId: "tomato", quantity: "100", unit: "г" };
  assert.throws(() => calculateNutrition([row], catalog, 0));
  assert.throws(() => calculateNutrition([row], [{ ...catalog[0], fatPer100g: null }], 1));
  assert.throws(() => calculateNutrition([{ ...row, unit: "шт." }], catalog, 1));
  assert.throws(() => calculateNutrition([{ ...row, quantity: "" }], catalog, 1));
  assert.throws(() => calculateNutrition([{ ...row, quantity: "-1" }], catalog, 1));
  assert.throws(() => calculateNutrition([], catalog, 1));
});
test("nutrition preserves known zero values", () => {
  assert.deepEqual(calculateNutrition([{ ingredientId: "tomato", quantity: "0", unit: "г" }], catalog, 1), { calories: "0", protein: "0", fat: "0", carbs: "0" });
});

test("serving accessories are excluded; unresolved food never uses old unverified numbers", () => {
  const skewer = { id: "skewer", name: "Шпажка", category: "Подача", nutritionStatus: "not_food" };
  const rows = [{ ingredientId: "tomato", quantity: "100", unit: "г" }, { ingredientId: "skewer", quantity: "2", unit: "шт." }];
  assert.equal(calculateNutrition(rows, [...catalog, skewer], 1).calories, "18");
  assert.throws(() => calculateNutrition([rows[0]], [{ ...catalog[0], nutritionStatus: "needs_review", nutritionNote: "Уточніть стан продукту" }], 1), /уточнення КБЖВ/);
});

import {compareIngredients,ingredientTags,ingredientRegions,ingredientCountries,matchesIngredientFilters,nutrientValue} from "./ingredientSorting.ts";
test("ingredient sorting puts unknown last in both directions and uses clearly separate range values",()=>{
 const known={...catalog[0],nutritionStatus:"verified"};
 const unknown={...known,id:"unknown",nutritionStatus:"needs_review"};
 assert.equal(nutrientValue(known,"kcal"),18);
 assert.equal(nutrientValue(unknown,"kcal"),null);
 assert.ok(compareIngredients(known,unknown,"kcal:desc")<0);
 assert.ok(compareIngredients(known,unknown,"kcal:asc")<0);
 const estimated={...unknown,nutritionRange:{kcal:{min:10,max:30},protein:{min:1,max:2},fat:{min:0,max:3},carbs:{min:0,max:5},kind:"family",source:"USDA",sourceUrl:"https://fdc.nal.usda.gov/",note:"",sampleCount:2,sourceIds:[]}};
 assert.equal(nutrientValue(estimated,"kcal"),20);
 assert.equal(ingredientTags({...known,categoryTags:["Овочі","Рослинні продукти"]}).length,2);
 assert.deepEqual(ingredientRegions(known),["Універсальні"]);
});


import type {Ingredient} from "./types.ts";
test("food categories exclude geography while preserving actual food types",()=>{
 const mixed={...catalog[0],category:"Азійські продукти",categoryTags:["Азійські продукти","Європейські продукти","Африка","Соуси та заправки","Рослинні продукти","Соуси та заправки"]};
 assert.deepEqual(ingredientTags(mixed),["Соуси та заправки","Рослинні продукти"]);
 assert.deepEqual(ingredientTags({...catalog[0],categoryTags:undefined}),["Овочі"]);
});
test("country codes normalize and deduplicate without inventing countries for universal products",()=>{
 assert.deepEqual(ingredientCountries({...catalog[0],culinaryCountries:["jp","JP"," IT ","XX-invalid"]}),["JP","IT"]);
 assert.deepEqual(ingredientCountries(catalog[0]),[]);
 assert.deepEqual(ingredientCountries({...catalog[0],culinaryCountries:[null,42,"",{}]} as unknown as Ingredient),[]);
 assert.deepEqual(ingredientRegions({...catalog[0],culinaryRegions:[" ","Європа","Європа"]}),["Європа"]);
});
test("country multi-selection includes either country and combines with food categories",()=>{
 const japan={...catalog[0],id:"japan",category:"Соуси та заправки",culinaryCountries:["JP"],culinaryRegions:["Азія"]};
 const italy={...japan,id:"italy",culinaryCountries:["IT"],culinaryRegions:["Європа"]};
 const france={...japan,id:"france",culinaryCountries:["FR"],culinaryRegions:["Європа"]};
 const pantry={...catalog[0],id:"pantry",culinaryCountries:[]};
 const foods=[japan,italy,france,pantry];
 assert.deepEqual(foods.filter(x=>matchesIngredientFilters(x,[],[],["JP","IT"])).map(x=>x.id),["japan","italy"]);
 assert.deepEqual(foods.filter(x=>matchesIngredientFilters(x,["Овочі"],[],["JP","IT"])),[]);
 assert.deepEqual(foods.filter(x=>matchesIngredientFilters(x,["Овочі","Соуси та заправки"],[],["JP","IT"])).map(x=>x.id),["japan","italy"]);
 assert.deepEqual(foods.filter(x=>matchesIngredientFilters(x,[],["Європа"],["JP"])).map(x=>x.id),["japan","italy","france"]);
 assert.deepEqual(foods.filter(x=>matchesIngredientFilters(x,[],[],["AQ"])),[]);
 assert.deepEqual(foods.filter(x=>matchesIngredientFilters(x,[],[],[])),foods);
 assert.equal(matchesIngredientFilters(pantry,[],["Універсальні"],[]),true);
});
test('automatic nutrition uses interval midpoints, exact values per field and weight conversions',()=>{
 const food={id:'range',name:'Продукт',nutritionStatus:'needs_review',nutritionRange:{kcal:{min:100,max:200},protein:{min:10,max:20},fat:{min:0,max:10},carbs:{min:20,max:40}},gramsPerUnit:50,densityGramsPerMl:1.2};
 const rows=[{ingredientId:'range',quantity:'0.1',unit:'кг'},{ingredientId:'range',quantity:'2',unit:'шт.'},{ingredientId:'range',quantity:'100',unit:'мл'}];
 assert.deepEqual(calculateNutrition(rows,[food],2),{calories:'240',protein:'24',fat:'8',carbs:'48'});
 assert.equal(calculateNutrition([{ingredientId:'range',quantity:'1',unit:'л'}],[food],1).calories,'1800');
 assert.equal(calculateNutrition([rows[0]],[{...food,nutritionStatus:'verified',caloriesPer100g:0}],1).calories,'0');
 assert.throws(()=>calculateNutrition(rows,[{...food,gramsPerUnit:null}],2),/масу/);
 assert.throws(()=>calculateNutrition(rows,[{...food,nutritionRange:{...food.nutritionRange,kcal:{min:200,max:100}}}],2),/діапазону/);
 assert.equal(calculateNutrition([{ingredientId:'range',quantity:'0',unit:'г'}],[{...food,nutritionRange:null}],1).calories,'0');
});

import {filterProfileRecipes} from './profileRecipes.ts';
import type {Recipe} from './types.ts';
test('profile recipes search, meal filter and sorting preserve source data and put unrated last',()=>{
 const base={title:'Яблучний пиріг',description:'Ніжний десерт',createdAt:'2026-01-01',publishedAt:null,preparationMinutes:30,calories:200,mealType:'DESSERT'};
 const recipes=[{...base,id:'a',averageRating:4,ratingCount:2},{...base,id:'b',title:'М’ятний чай',description:'Напій',preparationMinutes:5,calories:null,mealType:'SNACK',publishedAt:'2026-03-01',averageRating:5,ratingCount:1},{...base,id:'c',title:'Банановий крем',description:'Ніжний десерт',preparationMinutes:15,calories:100,createdAt:'2026-02-01',averageRating:null,ratingCount:0}] as Recipe[];
 const ids=(query:string,sort:string,meal='')=>filterProfileRecipes(recipes,query,sort,meal).map(r=>r.id);
 assert.deepEqual(ids('  ЯБЛУЧНИЙ  ','title'),['a']);
 assert.deepEqual(ids('м’ятний','title'),['b']);assert.deepEqual(ids("м'ятний",'title'),['b']);
 assert.deepEqual(ids('ніжний','title','DESSERT'),['c','a']);
 assert.deepEqual(ids('','rating'),['b','a','c']);assert.deepEqual(ids('','time'),['b','c','a']);
 assert.deepEqual(ids('','newest'),['b','c','a']);assert.deepEqual(ids('','oldest'),['a','c','b']);
 assert.deepEqual(ids('','calories'),['c','a','b']);assert.deepEqual(ids('відсутній','rating'),[]);
 assert.deepEqual(filterProfileRecipes([],'','newest'),[]);assert.deepEqual(recipes.map(r=>r.id),['a','b','c']);
});

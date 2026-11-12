import type {Ingredient} from './types';
// Geography belongs exclusively to regional filters, including legacy catalog tags.
export function isGeographicCategory(value:string):boolean{return /азі[йя]|європ|африк|америк|океан|австрал|антаркт|середземномор|регіон|країн|япон|китай|корей|індій|тайськ|україн|італій|француз|мексик|кавказ|близько[ -]?схід|східно[ -]?азі/i.test(value);}
export function ingredientTags(x:Ingredient):string[]{return [...new Set([x.category,...(Array.isArray(x.categoryTags)?x.categoryTags.filter(v=>typeof v==='string'):[])])].filter(v=>!isGeographicCategory(v));}
export function ingredientRegions(x:Ingredient):string[]{const values=Array.isArray(x.culinaryRegions)?x.culinaryRegions.filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim()):[];return values.length?[...new Set(values)]:['Універсальні'];}
export function ingredientCountries(x:Ingredient):string[]{return [...new Set((Array.isArray(x.culinaryCountries)?x.culinaryCountries:[]).filter(v=>typeof v==='string').map(v=>v.trim().toUpperCase()).filter(v=>/^[A-Z]{2}$/.test(v)))];}
export function matchesIngredientFilters(x:Ingredient,categories:string[],regions:string[],countries:string[]):boolean{
 return (!categories.length||categories.some(c=>ingredientTags(x).includes(c)))&&(!regions.length&&!countries.length||regions.some(r=>ingredientRegions(x).includes(r))||countries.some(c=>ingredientCountries(x).includes(c)));
}
export function nutrientValue(x:Ingredient,key:string):number|null{
 if(x.nutritionStatus==='not_food')return null;
 const field={kcal:'caloriesPer100g',protein:'proteinPer100g',fat:'fatPer100g',carbs:'carbsPer100g'}[key] as 'caloriesPer100g'|'proteinPer100g'|'fatPer100g'|'carbsPer100g'|undefined;
 const exact=field?x[field]:null;
 if(x.nutritionStatus==='verified'&&typeof exact==='number'&&Number.isFinite(exact))return exact;
 const range=x.nutritionRange?.[key as 'kcal'|'protein'|'fat'|'carbs'];
 return range&&Number.isFinite(range.min)&&Number.isFinite(range.max)?(range.min+range.max)/2:null;
}
export function compareIngredients(a:Ingredient,b:Ingredient,sort:string):number{
 const [key,direction]=sort.split(':');const byName=a.name.localeCompare(b.name,'uk');
 if(key==='name')return direction==='desc'?-byName:byName;
 const av=nutrientValue(a,key),bv=nutrientValue(b,key);
 if(av===null)return bv===null?byName:1;if(bv===null)return -1;
 return (av-bv)*(direction==='desc'?-1:1)||byName;
}

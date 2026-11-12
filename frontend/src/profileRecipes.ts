import {matchesSearch} from './search.ts';
import type {Recipe} from './types';
export function filterProfileRecipes(recipes:Recipe[],search:string,sort:string,meal=''):Recipe[]{
 const timestamp=(r:Recipe)=>{const n=Date.parse(r.publishedAt||r.createdAt);return Number.isFinite(n)?n:0;};
 const calories=(r:Recipe)=>typeof r.calories==='number'&&Number.isFinite(r.calories)?r.calories:Infinity;
 return recipes.filter(r=>(!meal||r.mealType===meal)&&matchesSearch(r.title+' '+(r.description??''),search)).sort((a,b)=>{
  let diff=0;
  if(sort==='reposts')diff=(b.repostCount??0)-(a.repostCount??0);
  else if(sort==='newest')diff=timestamp(b)-timestamp(a);
  else if(sort==='oldest')diff=timestamp(a)-timestamp(b);
  else if(sort==='rating')diff=(b.averageRating??-1)-(a.averageRating??-1)||(b.ratingCount??0)-(a.ratingCount??0);
  else if(sort==='time')diff=a.preparationMinutes-b.preparationMinutes;
  else if(sort==='calories')diff=calories(a)-calories(b);
  return diff||a.title.localeCompare(b.title,'uk');
 });
}

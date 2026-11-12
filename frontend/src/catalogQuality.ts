import type {FoodNutrition} from './nutrition.ts';
export function catalogQuality(items:(FoodNutrition&{category:string})[]){
 const normalize=(s:string)=>s.normalize('NFKC').toLocaleLowerCase('uk').replace(/[’'`ʼ]/g,'').replace(/[-\s]+/g,' ').trim();
 const names=new Map<string,number>();for(const x of items){const k=normalize(x.name);names.set(k,(names.get(k)??0)+1);}
 return items.flatMap(x=>{const reasons:string[]=[];if((names.get(normalize(x.name))??0)>1)reasons.push('Можливий дублікат назви');if(!x.category?.trim())reasons.push('Немає категорії');
 if(x.nutritionStatus!=='not_food'){
 const fields=[['kcal','caloriesPer100g'],['protein','proteinPer100g'],['fat','fatPer100g'],['carbs','carbsPer100g']] as const;
 const missing=fields.filter(([key,field])=>{const exact=x[field],r=(x.nutritionRange as Record<string,{min:number;max:number}>|null)?.[key];return !((x.nutritionStatus===undefined||x.nutritionStatus==='verified')&&typeof exact==='number'&&Number.isFinite(exact)&&exact>=0)&&!(r&&Number.isFinite(r.min)&&Number.isFinite(r.max)&&r.min>=0&&r.max>=r.min);});
 if(missing.length)reasons.push('Неповні КБЖВ: '+missing.map(([k])=>({kcal:'ккал',protein:'білки',fat:'жири',carbs:'вуглеводи'}[k])).join(', '));
 }return reasons.length?[{id:x.id,name:x.name,reasons}]:[];}).sort((a,b)=>a.name.localeCompare(b.name,'uk'));
}

export type FoodNutrition={id:string;name:string;nutritionStatus?:string;nutritionNote?:string|null;nutritionRange?:unknown;caloriesPer100g?:number|null;proteinPer100g?:number|null;fatPer100g?:number|null;carbsPer100g?:number|null;gramsPerUnit?:number|null;densityGramsPerMl?:number|null};
export function calculateNutrition(rows:{ingredientId:string;quantity:string;unit:string}[],catalog:FoodNutrition[],servings:number){
 if(!Number.isInteger(servings)||servings<1)throw new Error('Вкажіть кількість порцій');
 if(!rows.length)throw new Error('Додайте інгредієнти');
 const totals={calories:0,protein:0,fat:0,carbs:0};
 const fields={calories:'caloriesPer100g',protein:'proteinPer100g',fat:'fatPer100g',carbs:'carbsPer100g'} as const;
 for(const row of rows){
  const food=catalog.find(x=>x.id===row.ingredientId);if(!food)throw new Error('Оберіть усі інгредієнти');if(food.nutritionStatus==='not_food')continue;
  const amount=Number(row.quantity.replace(',','.'));if(!row.quantity.trim()||!Number.isFinite(amount)||amount<0)throw new Error('Вкажіть кількість для «'+food.name+'»');if(amount===0)continue;
  const unit=row.unit.trim().toLowerCase().replace(/\.$/,'');
  const factor=['г','g','гр'].includes(unit)?1:['кг','kg'].includes(unit)?1000:['шт','штучка','pcs'].includes(unit)?food.gramsPerUnit:['мл','ml'].includes(unit)?food.densityGramsPerMl:['л','l'].includes(unit)?(food.densityGramsPerMl?food.densityGramsPerMl*1000:null):null;
  if(typeof factor!=='number'||!Number.isFinite(factor)||factor<=0)throw new Error('Для «'+food.name+'» вкажіть масу в грамах/кг або задайте в каталозі масу штуки чи густину для мл/л');
  for(const key of Object.keys(fields) as (keyof typeof fields)[]){
   const exact=food[fields[key]],rangeKey=key==='calories'?'kcal':key;
   const range=(food.nutritionRange as Record<string,{min:number;max:number}>|null)?.[rangeKey];
   const trusted=food.nutritionStatus===undefined||food.nutritionStatus==='verified';
   const value=trusted&&typeof exact==='number'&&Number.isFinite(exact)&&exact>=0?exact:range&&Number.isFinite(range.min)&&Number.isFinite(range.max)&&range.min>=0&&range.max>=range.min?(range.min+range.max)/2:null;
   if(value===null)throw new Error('Для «'+food.name+'» потрібне уточнення КБЖВ: немає показника або коректного діапазону');
   totals[key]+=value*amount*factor/100/servings;
  }
 }
 return Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,String(Math.round(v*100)/100)])) as Record<keyof typeof totals,string>;
}

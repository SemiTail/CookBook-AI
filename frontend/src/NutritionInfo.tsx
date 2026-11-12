import type { Ingredient } from "./types";

export function NutritionInfo({ingredient,link=false}:{ingredient:Ingredient;link?:boolean}) {
 const title=[ingredient.nutritionSourceFood,ingredient.nutritionNote].filter(Boolean).join(" · ");
 if(ingredient.nutritionStatus==="not_food")return <small className="nutrition-label" title={title}>КБЖВ не застосовується · нехарчова позиція</small>;
 if(ingredient.nutritionStatus!=="verified"&&ingredient.nutritionRange){const r=ingredient.nutritionRange;const text=(key:"kcal"|"protein"|"fat"|"carbs")=>r[key].min+"–"+r[key].max;return <span className="nutrition-reference nutrition-estimate" title={r.note+" Джерело: "+r.source+(r.sampleCount?", варіантів: "+r.sampleCount:"")}><small className="nutrition-label">≈ {r.kind==="category"?"Діапазон категорії":r.kind==="product"?"Діапазон продукту":"Довідникові варіанти"} / 100 г: {text("kcal")} ккал · Б {text("protein")} · Ж {text("fat")} · В {text("carbs")}</small><small className="nutrition-label">Автоматичний розрахунок використовує середину діапазону.</small>{link&&r.sourceUrl&&<a href={r.sourceUrl} target="_blank" rel="noreferrer">Джерело діапазону</a>}</span>;}
 if(ingredient.nutritionStatus!=="verified")return <small className="nutrition-label nutrition-unverified" title={title||"Потрібно уточнити продукт, жирність або спосіб приготування"}>КБЖВ потребує уточнення</small>;
 return <span className="nutrition-reference" title={title}><small className="nutrition-label">На 100 г: {ingredient.caloriesPer100g} ккал · Б {ingredient.proteinPer100g} · Ж {ingredient.fatPer100g} · В {ingredient.carbsPer100g}</small>{link&&ingredient.nutritionSourceUrl&&<a href={ingredient.nutritionSourceUrl} target="_blank" rel="noreferrer">{ingredient.nutritionSource||"Джерело"}</a>}</span>;
}

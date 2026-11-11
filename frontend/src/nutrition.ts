import type { Ingredient } from "./types";

export function calculateNutrition(rows: { ingredientId: string; quantity: string; unit: string }[], catalog: Ingredient[], servings: number) {
  if (!Number.isInteger(servings) || servings < 1) throw new Error("Вкажіть кількість порцій");
  if (!rows.length) throw new Error("Додайте інгредієнти");
  const totals = { calories: 0, protein: 0, fat: 0, carbs: 0 };
  const fields = { calories: "caloriesPer100g", protein: "proteinPer100g", fat: "fatPer100g", carbs: "carbsPer100g" } as const;
  for (const row of rows) {
    const ingredient = catalog.find(item => item.id === row.ingredientId);
    if (!ingredient) throw new Error("Оберіть усі інгредієнти");
    const unit = row.unit.trim().toLowerCase();
    const multiplier = ["г", "g"].includes(unit) ? 1 : ["кг", "kg"].includes(unit) ? 1000 : null;
    const quantity = Number(row.quantity);
    if (multiplier === null || !row.quantity.trim() || !Number.isFinite(quantity) || quantity < 0) {
      throw new Error(`Для «${ingredient.name}» вкажіть масу в грамах або кілограмах`);
    }
    for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
      const value = ingredient[fields[key]];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`Для «${ingredient.name}» немає повних даних КБЖВ. Вкажіть значення на порцію вручну.`);
      totals[key] += value * quantity * multiplier / 100 / servings;
    }
  }
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, String(Math.round(value * 100) / 100)])) as Record<keyof typeof totals, string>;
}

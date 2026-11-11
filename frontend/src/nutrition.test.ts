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

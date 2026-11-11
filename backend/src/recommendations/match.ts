export type MatchIngredient = { ingredientId: string; optional: boolean };

/** Availability only: quantities and optional ingredients do not affect the score. */
export function ingredientMatch(ingredients: readonly MatchIngredient[], ownedIds: ReadonlySet<string>) {
  if (!Array.isArray(ingredients) || ingredients.some(item =>
    !item || typeof item.ingredientId !== "string" || !item.ingredientId.trim() || typeof item.optional !== "boolean")) {
    throw new TypeError("Invalid recipe ingredients");
  }
  const requiredIds = [...new Set(ingredients.filter(item => !item.optional).map(item => item.ingredientId))];
  const missingIds = requiredIds.filter(id => !ownedIds.has(id));
  const have = requiredIds.length - missingIds.length;
  return {
    matchPercent: requiredIds.length ? Math.round(100 * have / requiredIds.length) : 0,
    // Compare the exact ratio: rounding 69.6% to 70% must not admit a recipe.
    eligible: requiredIds.length > 0 && have * 100 >= requiredIds.length * 70,
    missingIds,
  };
}

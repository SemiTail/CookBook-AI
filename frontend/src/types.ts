export type User = { id: string; name: string; email: string; role: "USER" | "MODERATOR" };
export type Session = { accessToken: string; user: User };
export type Ingredient = { id: string; name: string; category: string; emoji?: string | null; caloriesPer100g?: number | null; proteinPer100g?: number | null; fatPer100g?: number | null; carbsPer100g?: number | null };
export type RecipeIngredient = { ingredientId: string; quantity: number | null; unit: string | null; optional: boolean; ingredient: Ingredient };
export type Recipe = {
  id: string; title: string; emoji: string; imageUrl: string | null; authorId: string | null; isPublished: boolean; isShared: boolean; description: string | null; instructions: string;
  preparationMinutes: number; difficulty: "EASY" | "MEDIUM" | "HARD"; servings: number;
  calories: number | null; protein: number | null; fat: number | null; carbs: number | null;
  ingredients: RecipeIngredient[]; matchPercent?: number; missingIngredients?: Ingredient[];
};
export type FridgeItem = { id: string; ingredientId: string; ingredient: Ingredient; quantity: number | null; unit: string | null };

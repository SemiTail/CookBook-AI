/**
 * CookBook AI — local SQLite test data, Prisma 7.
 * Includes ingredient catalog and sample recipes. Run `npx.cmd prisma db seed` from backend.
 * Put cookbook_ingredients.json next to this seed.ts file.
 * This is for local development only: it creates two demo accounts.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import argon2 from "argon2";
import { PrismaClient } from "../generated/prisma/client";

if (process.env.NODE_ENV === "production") {
  throw new Error("Demo seed must not run with NODE_ENV=production");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !databaseUrl.startsWith("file:")) {
  throw new Error("DATABASE_URL must be a SQLite file URL, e.g. file:./dev.db");
}

const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

type IngredientGeography = {name:string;category:string;categoryTags:string[];culinaryRegions:string[];culinaryCountries:string[]};
type CatalogIngredient = { name: string; category: string; emoji: string;categoryTags:string[];culinaryRegions:string[];culinaryCountries:string[] };

/**
 * Reads the catalog from backend/prisma/cookbook_ingredients.json.
 * When used with `npx prisma db seed`, the working directory is backend/.
 */
function loadCatalog(): CatalogIngredient[] {
  const filePath = resolve(process.cwd(), "prisma", "cookbook_ingredients.json");
  const geographyRows=JSON.parse(readFileSync(resolve(process.cwd(),"prisma","ingredient-geography.json"),"utf8")) as IngredientGeography[];
  const geography=new Map(geographyRows.map(row=>[row.name,row]));
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read ingredient catalog at ${filePath}. Put cookbook_ingredients.json into backend/prisma/.`, { cause: error });
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Ingredient catalog should be a non-empty JSON array");
  }
  const names = new Set<string>();
  return parsed.map((item: unknown, index: number): CatalogIngredient => {
    if (item === null || typeof item !== "object") {
      throw new Error(`Invalid catalog record at index ${index}`);
    }
    const record = item as Record<string, unknown>;
    if (typeof record.name !== "string" || !record.name.trim()
      || typeof record.category !== "string" || !record.category.trim()
      || typeof record.emoji !== "string" || !record.emoji.trim()) {
      throw new Error(`Catalog record ${index} must contain name, category, emoji`);
    }
    const name = record.name.trim();
    if (names.has(name)) throw new Error(`Duplicate catalog ingredient: ${name}`);
    names.add(name);
    const metadata=geography.get(name);
    const category=metadata?.category??record.category.trim();
    return { name, category, emoji: record.emoji.trim(),categoryTags:metadata?.categoryTags??[category],culinaryRegions:metadata?.culinaryRegions??['Універсальні'],culinaryCountries:metadata?.culinaryCountries??[] };
  });
}

// Approximate values per 100 g. For grains and legumes, use dry weight.
const ingredients = [
  { name: "Яйце", category: "Яйця", kcal: 143, protein: 12.6, fat: 9.5, carbs: 0.7 },
  { name: "Помідор", category: "Овочі", kcal: 18, protein: 0.9, fat: 0.2, carbs: 3.9 },
  { name: "Огірок", category: "Овочі", kcal: 15, protein: 0.7, fat: 0.1, carbs: 3.6 },
  { name: "Цибуля", category: "Овочі", kcal: 40, protein: 1.1, fat: 0.1, carbs: 9.3 },
  { name: "Часник", category: "Овочі", kcal: 149, protein: 6.4, fat: 0.5, carbs: 33.1 },
  { name: "Морква", category: "Овочі", kcal: 41, protein: 0.9, fat: 0.2, carbs: 9.6 },
  { name: "Картопля", category: "Овочі", kcal: 77, protein: 2.0, fat: 0.1, carbs: 17.0 },
  { name: "Капуста", category: "Овочі", kcal: 25, protein: 1.3, fat: 0.1, carbs: 5.8 },
  { name: "Перець солодкий", category: "Овочі", kcal: 31, protein: 1.0, fat: 0.3, carbs: 6.0 },
  { name: "Перець гострий", category: "Овочі", kcal: 40, protein: 1.9, fat: 0.4, carbs: 8.8 },
  { name: "Гарбуз", category: "Овочі", kcal: 26, protein: 1.0, fat: 0.1, carbs: 6.5 },
  { name: "Гриби печериці", category: "Гриби", kcal: 22, protein: 3.1, fat: 0.3, carbs: 3.3 },
  { name: "Броколі", category: "Овочі", kcal: 34, protein: 2.8, fat: 0.4, carbs: 6.6 },
  { name: "Буряк", category: "Овочі", kcal: 43, protein: 1.6, fat: 0.2, carbs: 10.0 },
  { name: "Кріп", category: "Зелень", kcal: 43, protein: 3.5, fat: 1.1, carbs: 7.0 },
  { name: "Петрушка", category: "Зелень", kcal: 36, protein: 3.0, fat: 0.8, carbs: 6.3 },
  { name: "Листя салату", category: "Зелень", kcal: 15, protein: 1.4, fat: 0.2, carbs: 2.9 },
  { name: "Гречка", category: "Крупи", kcal: 343, protein: 13.3, fat: 3.4, carbs: 71.5 },
  { name: "Рис", category: "Крупи", kcal: 365, protein: 7.1, fat: 0.7, carbs: 80.0 },
  { name: "Макарони", category: "Макаронні вироби", kcal: 371, protein: 13.0, fat: 1.5, carbs: 74.7 },
  { name: "Сочевиця", category: "Бобові", kcal: 352, protein: 24.6, fat: 1.1, carbs: 63.4 },
  { name: "Горох сухий", category: "Бобові", kcal: 341, protein: 24.6, fat: 1.2, carbs: 60.4 },
  { name: "Куряче філе", category: "М'ясо", kcal: 120, protein: 22.5, fat: 2.6, carbs: 0.0 },
  { name: "Молоко", category: "Молочні продукти", kcal: 61, protein: 3.2, fat: 3.3, carbs: 4.8 },
  { name: "Сир кисломолочний", category: "Молочні продукти", kcal: 121, protein: 17.0, fat: 5.0, carbs: 1.8 },
  { name: "Сметана", category: "Молочні продукти", kcal: 206, protein: 2.8, fat: 20.0, carbs: 3.2 },
  { name: "Сир твердий", category: "Молочні продукти", kcal: 350, protein: 25.0, fat: 27.0, carbs: 1.3 },
  { name: "Банан", category: "Фрукти", kcal: 89, protein: 1.1, fat: 0.3, carbs: 22.8 },
  { name: "Яблуко", category: "Фрукти", kcal: 52, protein: 0.3, fat: 0.2, carbs: 13.8 },
  { name: "Мед", category: "Інше", kcal: 304, protein: 0.3, fat: 0.0, carbs: 82.4 },
  { name: "Томатна паста", category: "Консерви", kcal: 82, protein: 4.3, fat: 0.5, carbs: 18.9 },
  { name: "Олія соняшникова", category: "Олії", kcal: 884, protein: 0, fat: 100, carbs: 0 },
  { name: "Сіль", category: "Спеції", kcal: 0, protein: 0, fat: 0, carbs: 0 },
  { name: "Перець чорний", category: "Спеції", kcal: 251, protein: 10.4, fat: 3.3, carbs: 64.0 },
] as const;

type RecipeIngredientSeed = { name: string; grams: number; optional?: boolean };
type RecipeSeed = {
  id: string;
  title: string;
  description: string;
  instructions: string;
  minutes: number;
  servings: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  items: RecipeIngredientSeed[];
};

const recipes: RecipeSeed[] = [
  {
    id: "demo-omelet", title: "Омлет із помідорами",
    description: "Швидкий сніданок із яєць та овочів.",
    instructions: "1. Наріжте помідор.\n2. Збийте яйця із дрібкою солі.\n3. Розігрійте олію та обсмажте помідор 2 хвилини.\n4. Додайте яйця, накрийте кришкою та готуйте 5–7 хвилин до готовності.",
    minutes: 15, servings: 1, difficulty: "EASY",
    items: [{ name: "Яйце", grams: 120 }, { name: "Помідор", grams: 120 }, { name: "Олія соняшникова", grams: 5 }, { name: "Сіль", grams: 1, optional: true }],
  },
  {
    id: "demo-buckwheat-mushrooms", title: "Гречка з печерицями",
    description: "Ситна гречана каша з грибами та цибулею.",
    instructions: "1. Промийте гречку та відваріть у воді до готовності.\n2. Подрібніть цибулю й гриби.\n3. Обсмажте цибулю на олії, додайте печериці та тушкуйте 8–10 хвилин.\n4. Змішайте з гречкою та приправте.",
    minutes: 30, servings: 2, difficulty: "EASY",
    items: [{ name: "Гречка", grams: 160 }, { name: "Гриби печериці", grams: 200 }, { name: "Цибуля", grams: 80 }, { name: "Олія соняшникова", grams: 15 }, { name: "Сіль", grams: 2, optional: true }],
  },
  {
    id: "demo-salad", title: "Овочевий салат",
    description: "Свіжий салат із помідорів, огірків та перцю.",
    instructions: "1. Вимийте овочі.\n2. Наріжте огірок, помідор і перець.\n3. Додайте подрібнену цибулю.\n4. Заправте олією, посоліть за смаком.",
    minutes: 10, servings: 2, difficulty: "EASY",
    items: [{ name: "Помідор", grams: 200 }, { name: "Огірок", grams: 200 }, { name: "Перець солодкий", grams: 100 }, { name: "Цибуля", grams: 40 }, { name: "Олія соняшникова", grams: 10 }, { name: "Сіль", grams: 2, optional: true }],
  },
  {
    id: "demo-potato-soup", title: "Картопляний суп",
    description: "Простий домашній суп із картоплею та морквою.",
    instructions: "1. Наріжте картоплю й моркву.\n2. Доведіть приблизно 1 л води до кипіння.\n3. Додайте картоплю, моркву та цибулю.\n4. Варіть 20–25 хвилин до м'якості овочів, посоліть.",
    minutes: 35, servings: 3, difficulty: "EASY",
    items: [{ name: "Картопля", grams: 450 }, { name: "Морква", grams: 120 }, { name: "Цибуля", grams: 80 }, { name: "Сіль", grams: 3, optional: true }, { name: "Кріп", grams: 10, optional: true }],
  },
  {
    id: "demo-pasta", title: "Макарони в томатному соусі",
    description: "Паста з часником, помідорами й томатною пастою.",
    instructions: "1. Відваріть макарони до готовності.\n2. Обсмажте цибулю та часник на олії.\n3. Додайте нарізані помідори й томатну пасту, тушкуйте 5–7 хвилин.\n4. Перемішайте з макаронами.",
    minutes: 25, servings: 2, difficulty: "EASY",
    items: [{ name: "Макарони", grams: 180 }, { name: "Помідор", grams: 200 }, { name: "Томатна паста", grams: 30 }, { name: "Цибуля", grams: 60 }, { name: "Часник", grams: 8 }, { name: "Олія соняшникова", grams: 12 }],
  },
  {
    id: "demo-lentils", title: "Тушкована сочевиця",
    description: "Бюджетна білкова страва з морквою і цибулею.",
    instructions: "1. Промийте сочевицю й відваріть відповідно до інструкції на упаковці.\n2. Обсмажте цибулю та моркву на олії.\n3. Змішайте зі звареною сочевицею, додайте спеції.\n4. Тушкуйте ще 5 хвилин.",
    minutes: 35, servings: 2, difficulty: "EASY",
    items: [{ name: "Сочевиця", grams: 180 }, { name: "Морква", grams: 120 }, { name: "Цибуля", grams: 80 }, { name: "Олія соняшникова", grams: 12 }, { name: "Сіль", grams: 2, optional: true }],
  },
  {
    id: "demo-chicken-rice", title: "Рис із куркою",
    description: "Основна страва з курячого філе, рису та овочів.",
    instructions: "1. Промийте рис.\n2. Наріжте курку невеликими шматочками.\n3. Обсмажте курку до зміни кольору, додайте моркву і цибулю.\n4. Додайте рис і воду, тушкуйте під кришкою до готовності рису й повного приготування курки.",
    minutes: 45, servings: 3, difficulty: "MEDIUM",
    items: [{ name: "Рис", grams: 210 }, { name: "Куряче філе", grams: 350 }, { name: "Морква", grams: 120 }, { name: "Цибуля", grams: 100 }, { name: "Олія соняшникова", grams: 18 }, { name: "Сіль", grams: 3, optional: true }],
  },
  {
    id: "demo-pumpkin-stew", title: "Овочеве рагу з гарбузом",
    description: "Легке осіннє рагу з гарбуза й солодкого перцю.",
    instructions: "1. Очистьте й наріжте гарбуз, перець, помідори та цибулю.\n2. Обсмажте цибулю на олії.\n3. Додайте решту овочів і невелику кількість води.\n4. Тушкуйте 20–25 хвилин до м'якості гарбуза.",
    minutes: 35, servings: 2, difficulty: "EASY",
    items: [{ name: "Гарбуз", grams: 400 }, { name: "Перець солодкий", grams: 160 }, { name: "Помідор", grams: 180 }, { name: "Цибуля", grams: 80 }, { name: "Олія соняшникова", grams: 15 }],
  },
  {
    id: "demo-cottage-banana", title: "Сир із бананом та медом",
    description: "Простий солодкий сніданок без випікання.",
    instructions: "1. Викладіть кисломолочний сир у миску.\n2. Наріжте банан та змішайте з сиром.\n3. За бажанням додайте трохи меду.",
    minutes: 5, servings: 1, difficulty: "EASY",
    items: [{ name: "Сир кисломолочний", grams: 180 }, { name: "Банан", grams: 120 }, { name: "Мед", grams: 10, optional: true }],
  },
  {
    id: "demo-pea-soup", title: "Гороховий суп",
    description: "Домашній суп із сухого гороху, картоплі та моркви.",
    instructions: "1. Промийте горох та за потреби замочіть відповідно до упаковки.\n2. Варіть горох у воді до майже повної м'якості.\n3. Додайте нарізані картоплю, моркву та цибулю.\n4. Доведіть усі інгредієнти до готовності, посоліть.",
    minutes: 75, servings: 4, difficulty: "MEDIUM",
    items: [{ name: "Горох сухий", grams: 240 }, { name: "Картопля", grams: 350 }, { name: "Морква", grams: 120 }, { name: "Цибуля", grams: 100 }, { name: "Сіль", grams: 3, optional: true }],
  },
];

const recipeEmojis: Record<string, string> = {
  "demo-omelet": "🍳", "demo-buckwheat-mushrooms": "🍄", "demo-salad": "🥗",
  "demo-potato-soup": "🥔", "demo-pasta": "🍝", "demo-lentils": "🫘",
  "demo-chicken-rice": "🍗", "demo-pumpkin-stew": "🎃", "demo-cottage-banana": "🍌", "demo-pea-soup": "🍲",
};

async function ensureUser(name: string, email: string, role: "USER" | "MODERATOR") {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return existing;
  }
  const password = randomBytes(15).toString("base64url");
  const user = await prisma.user.create({
    data: {
      name,
      email,
      role,
      passwordHash: await argon2.hash(password),
      profile: { create: {} },
    },
  });
  console.log(`NEW local demo account: ${email}  password: ${password}`);
  console.log("Save the password now; it will not be printed on subsequent runs.");
  return user;
}

async function main() {
  const user = await ensureUser("Тестовий користувач", "demo@cookbook.test", "USER");
  const moderator = await ensureUser("Модератор", "moderator@cookbook.test", "MODERATOR");

  // Import all catalog ingredients and the legacy demo ingredients.
  // Existing IDs and recipe/fridge links are preserved. No tables are cleared.
  const catalog = loadCatalog();
  const catalogByName = new Map(catalog.map((item) => [item.name, item]));
  const categoryNames = new Set(catalog.map((item) => item.category));
  for (const value of ingredients) {
    categoryNames.add(catalogByName.get(value.name)?.category ?? value.category);
  }
  for (const name of categoryNames) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }

  // Import general catalog without wiping nutritional values stored in the database.
  for (const item of catalog) {
    const data = { category: item.category, emoji: item.emoji,categoryTags:item.categoryTags,culinaryRegions:item.culinaryRegions,culinaryCountries:item.culinaryCountries };
    await prisma.ingredient.upsert({
      where: { name: item.name },
      update: data,
      create: { name: item.name, ...data },
    });
  }

  // Preserve the known approximate nutrition data needed by the 10 demo recipes.
  for (const value of ingredients) {
    const catalogRecord = catalogByName.get(value.name);
    const data = {
      category: catalogRecord?.category ?? value.category,
      emoji: catalogRecord?.emoji ?? "🍽️",
      caloriesPer100g: value.kcal,
      proteinPer100g: value.protein,
      fatPer100g: value.fat,
      carbsPer100g: value.carbs,
    };
    await prisma.ingredient.upsert({
      where: { name: value.name },
      update: data,
      create: { name: value.name, ...data },
    });
  }

  const ingredientRecords = await prisma.ingredient.findMany();
  const idByName = new Map(ingredientRecords.map((i) => [i.name, i.id]));
  const macrosByName = new Map(ingredients.map((i) => [i.name, i]));

  for (const recipe of recipes) {
    const recipeIngredientRows = recipe.items.map(({ name, grams, optional }) => {
      const id = idByName.get(name);
      if (!id) throw new Error(`Missing ingredient: ${name}`);
      return { ingredient: { connect: { id } }, quantity: grams, unit: "г", optional: optional ?? false };
    });
    const totals = recipe.items.reduce((totals, { name, grams }) => {
      const i = macrosByName.get(name);
      if (!i) throw new Error(`Missing macro data: ${name}`);
      totals.calories += (i.kcal * grams) / 100;
      totals.protein += (i.protein * grams) / 100;
      totals.fat += (i.fat * grams) / 100;
      totals.carbs += (i.carbs * grams) / 100;
      return totals;
    }, { calories: 0, protein: 0, fat: 0, carbs: 0 });
    const perServing = Object.fromEntries(
      Object.entries(totals).map(([key, value]) => [key, Math.round((value / recipe.servings) * 10) / 10]),
    ) as typeof totals;
    const data = {
      title: recipe.title,
      emoji: recipeEmojis[recipe.id] ?? "🍽️",
      description: recipe.description,
      instructions: recipe.instructions,
      preparationMinutes: recipe.minutes,
      servings: recipe.servings,
      difficulty: recipe.difficulty,
      isPublished: true,
      ...perServing,
    };
    await prisma.recipe.upsert({
      where: { id: recipe.id },
      update: {
        ...data,
        ingredients: {
          deleteMany: {},
          create: recipeIngredientRows,
        },
      },
      create: {
        id: recipe.id,
        ...data,
        author: { connect: { id: moderator.id } },
        ingredients: { create: recipeIngredientRows },
      },
    });
  }

  for (const name of ["Яйце", "Помідор", "Гречка", "Картопля", "Цибуля", "Морква"]) {
    const ingredientId = idByName.get(name);
    if (!ingredientId) throw new Error(`Missing fridge ingredient: ${name}`);
    await prisma.fridgeItem.upsert({
      where: { userId_ingredientId: { userId: user.id, ingredientId } },
      update: {},
      create: { userId: user.id, ingredientId, quantity: 200, unit: "г" },
    });
  }
  await prisma.favorite.upsert({
    where: { userId_recipeId: { userId: user.id, recipeId: "demo-omelet" } },
    update: {},
    create: { userId: user.id, recipeId: "demo-omelet" },
  });
  console.log("CookBook AI seed finished:");
  console.log(`  users: ${await prisma.user.count()}`);
  console.log(`  categories: ${await prisma.category.count()}`);
  console.log(`  catalog items: ${catalog.length}`);
  console.log(`  ingredients: ${await prisma.ingredient.count()}`);
  console.log(`  recipes: ${await prisma.recipe.count()}`);
  console.log(`  recipe ingredient links: ${await prisma.recipeIngredient.count()}`);
  console.log(`  fridge items: ${await prisma.fridgeItem.count()}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

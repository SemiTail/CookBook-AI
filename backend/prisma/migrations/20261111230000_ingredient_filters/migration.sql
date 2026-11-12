ALTER TABLE "Ingredient" ADD COLUMN "categoryTags" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Ingredient" ADD COLUMN "culinaryRegions" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Ingredient" ADD COLUMN "nutritionRange" JSONB;

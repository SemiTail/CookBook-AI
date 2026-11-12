ALTER TABLE "Ingredient" ADD COLUMN "nutritionStatus" TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE "Ingredient" ADD COLUMN "nutritionSource" TEXT;
ALTER TABLE "Ingredient" ADD COLUMN "nutritionSourceUrl" TEXT;
ALTER TABLE "Ingredient" ADD COLUMN "nutritionSourceFood" TEXT;
ALTER TABLE "Ingredient" ADD COLUMN "nutritionNote" TEXT;
ALTER TABLE "Ingredient" ADD COLUMN "nutritionUpdatedAt" DATETIME;

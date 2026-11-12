CREATE TABLE "RecipeAuthorship" ("recipeId" TEXT NOT NULL PRIMARY KEY,"userId" TEXT,FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE,FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE);
INSERT INTO "RecipeAuthorship" ("recipeId","userId") SELECT "id","authorId" FROM "Recipe";

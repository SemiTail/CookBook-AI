CREATE TABLE "RecipeCollection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecipeCollection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RecipeCollection_userId_nameKey_key" ON "RecipeCollection"("userId", "nameKey");
CREATE UNIQUE INDEX "RecipeCollection_id_userId_key" ON "RecipeCollection"("id", "userId");
CREATE TABLE "CollectionItem" (
    "collectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("collectionId", "recipeId"),
    CONSTRAINT "CollectionItem_collectionId_userId_fkey" FOREIGN KEY ("collectionId", "userId") REFERENCES "RecipeCollection" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CollectionItem_userId_recipeId_fkey" FOREIGN KEY ("userId", "recipeId") REFERENCES "Favorite" ("userId", "recipeId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CollectionItem_userId_recipeId_idx" ON "CollectionItem"("userId", "recipeId");

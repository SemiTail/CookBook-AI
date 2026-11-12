ALTER TABLE "Recipe" ADD COLUMN "mealType" TEXT NOT NULL DEFAULT 'ANY';
ALTER TABLE "Recipe" ADD COLUMN "publishedAt" DATETIME;
UPDATE "Recipe" SET "publishedAt" = "createdAt" WHERE "isShared"=1 OR "isPublished"=1;
CREATE TABLE "Follow" ("followerId" TEXT NOT NULL,"followingId" TEXT NOT NULL,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY ("followerId","followingId"),FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

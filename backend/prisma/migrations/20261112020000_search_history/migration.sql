CREATE TABLE "SearchHistory" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL,
 "query" TEXT NOT NULL,
 "source" TEXT NOT NULL DEFAULT 'official',
 "profileUserId" TEXT,
 "recipeIds" JSONB NOT NULL DEFAULT '[]',
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SearchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SearchHistory_userId_createdAt_id_idx" ON "SearchHistory"("userId","createdAt","id");

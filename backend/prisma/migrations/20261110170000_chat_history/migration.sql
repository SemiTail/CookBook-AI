CREATE TABLE "ChatTurn" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "reply" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" DATETIME NOT NULL,
  CONSTRAINT "ChatTurn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ChatTurn_userId_createdAt_idx" ON "ChatTurn"("userId", "createdAt");
CREATE INDEX "ChatTurn_expiresAt_idx" ON "ChatTurn"("expiresAt");

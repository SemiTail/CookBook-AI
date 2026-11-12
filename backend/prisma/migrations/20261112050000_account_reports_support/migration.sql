ALTER TABLE User ADD COLUMN deletedAt DATETIME;
ALTER TABLE User ADD COLUMN deletionReason TEXT;
ALTER TABLE User ADD COLUMN authVersion INTEGER NOT NULL DEFAULT 0;
ALTER TABLE User ADD COLUMN profileHiddenAt DATETIME;
CREATE TABLE Report (
 id TEXT NOT NULL PRIMARY KEY, reporterId TEXT NOT NULL, targetUserId TEXT NOT NULL, targetType TEXT NOT NULL, targetId TEXT NOT NULL, commentId TEXT, recipeId TEXT,
 snapshot JSONB NOT NULL, reasons JSONB NOT NULL, customReason TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'OPEN', decision TEXT, resolutionNote TEXT, resolvedById TEXT, resolvedAt DATETIME,
 createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL
);
CREATE INDEX Report_status_createdAt_idx ON Report(status,createdAt);
CREATE INDEX Report_reporterId_createdAt_idx ON Report(reporterId,createdAt);
CREATE TABLE SupportThread (
 id TEXT NOT NULL PRIMARY KEY, tokenHash TEXT NOT NULL, contact TEXT NOT NULL, contactType TEXT NOT NULL, guestName TEXT NOT NULL, ipHash TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'OPEN', lastSeenAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, lastGuestAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, lastModeratorAt DATETIME,
 createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL
);
CREATE UNIQUE INDEX SupportThread_tokenHash_key ON SupportThread(tokenHash);
CREATE INDEX SupportThread_status_updatedAt_idx ON SupportThread(status,updatedAt);
CREATE INDEX SupportThread_ipHash_createdAt_idx ON SupportThread(ipHash,createdAt);
CREATE TABLE SupportMessage (
 id TEXT NOT NULL PRIMARY KEY, threadId TEXT NOT NULL, text TEXT NOT NULL, authorId TEXT, authorName TEXT NOT NULL,
 isModerator BOOLEAN NOT NULL DEFAULT false, deliveryStatus TEXT NOT NULL DEFAULT 'IN_CHAT', createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(threadId) REFERENCES SupportThread(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX SupportMessage_threadId_createdAt_idx ON SupportMessage(threadId,createdAt);
CREATE INDEX SupportMessage_deliveryStatus_createdAt_idx ON SupportMessage(deliveryStatus,createdAt);

ALTER TABLE Recipe ADD COLUMN hiddenAt DATETIME;
ALTER TABLE Comment ADD COLUMN hiddenAt DATETIME;
ALTER TABLE Comment ADD COLUMN pinnedAt DATETIME;
CREATE TABLE BlogGrant (
 id TEXT NOT NULL PRIMARY KEY, ownerId TEXT NOT NULL, adminId TEXT NOT NULL,
 editRecipes BOOLEAN NOT NULL DEFAULT false, hideRecipes BOOLEAN NOT NULL DEFAULT false,
 manageComments BOOLEAN NOT NULL DEFAULT false, editProfile BOOLEAN NOT NULL DEFAULT false,
 instructions TEXT NOT NULL DEFAULT '', createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL,
 FOREIGN KEY(ownerId) REFERENCES User(id) ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY(adminId) REFERENCES User(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX BlogGrant_ownerId_adminId_key ON BlogGrant(ownerId,adminId);
CREATE INDEX BlogGrant_adminId_idx ON BlogGrant(adminId);
CREATE TABLE AccountNotice (
 id TEXT NOT NULL PRIMARY KEY, recipientId TEXT NOT NULL, title TEXT NOT NULL, text TEXT NOT NULL, ownerId TEXT,
 createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, readAt DATETIME,
 FOREIGN KEY(recipientId) REFERENCES User(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX AccountNotice_recipientId_createdAt_idx ON AccountNotice(recipientId,createdAt);
CREATE TABLE AuditEvent (
 id TEXT NOT NULL PRIMARY KEY, ownerId TEXT, actorId TEXT NOT NULL, actorName TEXT NOT NULL,
 action TEXT NOT NULL, targetId TEXT, targetTitle TEXT NOT NULL, details JSONB NOT NULL,
 createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX AuditEvent_ownerId_createdAt_idx ON AuditEvent(ownerId,createdAt);
CREATE INDEX AuditEvent_actorId_createdAt_idx ON AuditEvent(actorId,createdAt);

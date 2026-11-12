CREATE TABLE PreviousHandle (id TEXT NOT NULL PRIMARY KEY,userId TEXT NOT NULL,handle TEXT NOT NULL,name TEXT NOT NULL,createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX PreviousHandle_handle_idx ON PreviousHandle(handle);
CREATE INDEX PreviousHandle_userId_idx ON PreviousHandle(userId);
INSERT INTO PreviousHandle(id,userId,handle,name,createdAt) SELECT id,ownerId,json_extract(details,'$.retainedIdentity.handle'),json_extract(details,'$.retainedIdentity.name'),createdAt FROM AuditEvent WHERE action='account.delete' AND ownerId IS NOT NULL AND json_extract(details,'$.retainedIdentity.handle') IS NOT NULL;

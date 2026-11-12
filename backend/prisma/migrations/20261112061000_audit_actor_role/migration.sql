ALTER TABLE AuditEvent ADD COLUMN actorRole TEXT NOT NULL DEFAULT 'USER';
UPDATE AuditEvent SET actorRole=COALESCE((SELECT role FROM User WHERE User.id=AuditEvent.actorId),'USER');

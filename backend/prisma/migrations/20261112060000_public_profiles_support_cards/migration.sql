ALTER TABLE SupportMessage ADD COLUMN profileUserId TEXT;
UPDATE User SET handle='departed_'||lower(hex(randomblob(10))) WHERE deletedAt IS NOT NULL AND handle NOT LIKE 'departed_%';

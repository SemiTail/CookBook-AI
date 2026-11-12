ALTER TABLE User ADD COLUMN handle TEXT NOT NULL DEFAULT '';
UPDATE User SET handle='user_'||substr(replace(id,'-',''),1,16);
UPDATE User SET handle='тестовий_користувач' WHERE id='05752a41-44a0-4a7d-9425-0762a7d06d14';
UPDATE User SET handle='модератор' WHERE id='8e54e349-eebd-4877-ae33-3505673b846c';
UPDATE User SET handle='test' WHERE id='5938765c-7a28-433e-8486-d1157b274a4b';
UPDATE User SET handle='monya' WHERE id='3ea12901-ba79-449b-9dea-66c94bc43437';
UPDATE User SET handle='cookbook_ai' WHERE id='855880e9-e30b-44e9-95b5-677f82b38ed2';
CREATE UNIQUE INDEX User_handle_key ON User(handle);
ALTER TABLE Comment ADD COLUMN parentId TEXT REFERENCES Comment(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE Comment ADD COLUMN deletedAt DATETIME;
CREATE TABLE CommentMention (
 id TEXT NOT NULL PRIMARY KEY,
 commentId TEXT NOT NULL,
 recipientId TEXT NOT NULL,
 handle TEXT NOT NULL,
 kind TEXT NOT NULL DEFAULT 'mention',
 createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 readAt DATETIME,
 CONSTRAINT CommentMention_commentId_fkey FOREIGN KEY(commentId) REFERENCES Comment(id) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT CommentMention_recipientId_fkey FOREIGN KEY(recipientId) REFERENCES User(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX CommentMention_commentId_recipientId_key ON CommentMention(commentId,recipientId);
CREATE INDEX CommentMention_recipientId_createdAt_idx ON CommentMention(recipientId,createdAt);
CREATE INDEX Comment_parentId_idx ON Comment(parentId);

const {test}=require('node:test');const assert=require('node:assert/strict');const {mentionedHandles}=require('../dist/src/users/social.shared.js');
test('mentions normalize Unicode nicknames, ignore email addresses and avoid partial long-handle matches',()=>{
 assert.deepEqual(mentionedHandles('Дякую, @Monya! (@кухар_тест). @monya'),['monya','кухар_тест']);
 assert.deepEqual(mentionedHandles('Email x@monya.com та @@monya'),[]);
 assert.deepEqual(mentionedHandles('@'+ 'a'.repeat(33)),[]);
 assert.deepEqual(mentionedHandles('... @... @нік.'),['нік']);
});

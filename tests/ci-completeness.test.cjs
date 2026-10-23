const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('verification workflow and every configured Node entry point ship with the source',()=>{
 const workflow=fs.readFileSync('.github/workflows/verify-workflow.yml','utf8');
 assert.match(workflow,/branches: \[main, 'fix\/proplus-\*\*'\]/);
 for(const match of workflow.matchAll(/node (tests\/[\w.-]+\.cjs)/g))assert.ok(fs.existsSync(match[1]),match[1]);
 assert.equal((workflow.match(/node tests\/quote-archive-postgres.cjs/g)||[]).length,2);
 assert.ok(!workflow.includes('functions deploy')&&!workflow.includes('db push'));
});
test('isolated SQL bootstrap and permission fixtures are available in a clean checkout',()=>{
 for(const file of ['bootstrap.sql','hosted-schema.sql','hosted-storage-policies.sql',
 'fixtures/permissions/revoke-browser-truncate.sql','fixtures/permissions/revoke-platform-default-truncate.sql',
 'fixtures/permissions/restore-browser-truncate-snapshot.sql','fixtures/permissions/restore-platform-default-truncate-snapshot.sql'])assert.ok(fs.existsSync('tests/'+file),file);
 assert.match(fs.readFileSync('tests/pg-helper.cjs','utf8'),/Refusing database writes/);
});

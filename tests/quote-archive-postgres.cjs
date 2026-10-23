// Execute only after postgres-integration.cjs, on guarded localhost/issue8_test.
const fs=require('node:fs');
const {sql,sqlError,as,owner,other,check,assert}=require('./pg-helper.cjs');
assert.equal(sql("select shobj_description(oid,'pg_database') from pg_database where datname=current_database()"),'Issue8 disposable synthetic test');
const migration=fs.readFileSync('supabase/migrations/202610220001_quote_archive.sql','utf8');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
// The baseline schema stamps updated_at on UPDATE; it is system metadata,
// while acceptance, identifiers, payload and every other quote field must stay.
const original=()=>sql(`select (to_jsonb(a)-array['archived_at','updated_at'])::text from ajanlatok a where id='${id}'`);
const before=original();
const updated=()=>sql(`select to_jsonb(a)->>'updated_at' from ajanlatok a where id='${id}'`);
const oldUpdated=updated();
const policies=()=>sql("select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where schemaname='public' and tablename='ajanlatok'");
const oldPolicies=policies();
require('./hosted-migration-check.cjs').verifyRollback(migration,'quote archive');
check('archive interruption rolls back the added column',()=>assert.equal(sql("select count(*) from information_schema.columns where table_schema='public' and table_name='ajanlatok' and column_name='archived_at'"),'0'));
sql(migration);sql(migration);
check('archive migration repeats without rewriting legacy quote or RLS',()=>{assert.equal(original(),before);assert.equal(updated(),oldUpdated);assert.equal(policies(),oldPolicies)});
check('accepted owner quote can leave active list without losing acceptance',()=>{
 sql(as(owner,`update ajanlatok set archived_at=now() where id='${id}'`));
 assert.equal(sql(as(owner,`select quote_status from ajanlatok where id='${id}' and archived_at is not null`)),'accepted');
 assert.equal(sql(as(owner,`select id from ajanlatok where id='${id}' and archived_at is null`)),'');
 assert.equal(original(),before);
});
check('archival cannot conceal accepted price tampering',()=>{
 sqlError(as(owner,`update ajanlatok set archived_at=null,total_gross=999 where id='${id}'`),'P0001');
 assert.equal(sql(`select archived_at is not null from ajanlatok where id='${id}'`),'t');
});
check('archival retains decision and delete protection',()=>{
 sqlError(as(owner,`update ajanlatok set quote_status='draft',accepted_at=null where id='${id}'`),'P0001');
 sqlError(as(owner,`delete from ajanlatok where id='${id}'`),'P0001');
});
check('foreign user cannot read or archive another quote',()=>{
 assert.equal(sql(as(other,`select id from ajanlatok where id='${id}'`)),'');
 assert.equal(sql(as(other,`update ajanlatok set archived_at=null where id='${id}' returning id`)),'');
});
check('unarchive restores active visibility with every original field unchanged',()=>{
 sql(as(owner,`update ajanlatok set archived_at=null where id='${id}'`));
 assert.equal(sql(as(owner,`select id from ajanlatok where id='${id}' and archived_at is null`)),id);
 assert.equal(original(),before);
});

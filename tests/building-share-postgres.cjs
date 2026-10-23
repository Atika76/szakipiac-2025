// Run only after the existing integration suite in the disposable local database.
const fs=require('node:fs');
const {sql,sqlError,as,owner,other,admin,assert,check}=require('./pg-helper.cjs');
assert.equal(sql("select shobj_description(oid,'pg_database') from pg_database where datname=current_database()"),'Issue8 disposable synthetic test');
const migration=fs.readFileSync('supabase/migrations/202610210001_building_draft_share_guard.sql','utf8');
const metadata=()=>sql("select jsonb_build_array(proacl,prosecdef,proconfig,pg_get_function_identity_arguments(oid)) from pg_proc where oid='public.create_quote_share_v1(uuid,integer)'::regprocedure");
const before=metadata();
const anonCanExecute=sql("select has_function_privilege('anon','public.create_quote_share_v1(uuid,integer)','EXECUTE')")==='t';
// Inject a failure after replacing the RPC: the previous function must survive intact.
const previousBody=sql("select prosrc from pg_proc where oid='public.create_quote_share_v1(uuid,integer)'::regprocedure");
// Reproduce the old bypass in a transaction, then discard every row/link change.
const original=fs.readFileSync('supabase/migrations/202610180001_quote_workflow_stabilization.sql','utf8');
const oldFunction=original.slice(original.indexOf('create or replace function public.create_quote_share_v1('),original.indexOf('create or replace function public.get_public_quote_v1('));
const probe='b0000000-0000-4000-8000-000000000000';
const oldResult=JSON.parse(sql(`begin;${oldFunction}${as(owner,`insert into ajanlatok(id,user_id,project_name,payload) values('${probe}','${owner}','Old bypass','{"building_budget":{"enabled":true}}');select create_quote_share_v1('${probe}',30);`)}rollback;`));
assert.equal(oldResult.ok,true);assert.equal(sql(`select count(*) from ajanlatok where id='${probe}'`),'0');
assert.equal(metadata(),before);assert.equal(sql("select prosrc from pg_proc where oid='public.create_quote_share_v1(uuid,integer)'::regprocedure"),previousBody);
console.log('PASS old detailed-share bypass reproduced and rolled back (synthetic data only)');
sqlError(migration.replace(/commit;\s*$/i,()=>"do $$ begin raise exception using errcode='P0001',message='building guard rollback'; end $$; commit;"),'P0001','building guard rollback');
assert.equal(metadata(),before);assert.equal(sql("select prosrc from pg_proc where oid='public.create_quote_share_v1(uuid,integer)'::regprocedure"),previousBody);
sql(migration);sql(migration);assert.equal(metadata(),before);
console.log('PASS targeted migration repeats; injected rollback preserves previous RPC and permissions');
let seq=0;
const literal=v=>"'"+JSON.stringify(v).replace(/'/g,"''")+"'::jsonb";
function quote(enabled){seq++;const id=require('node:crypto').randomUUID(),payload={items:[{name:'Synthetic normal/detailed'}]};if(enabled!==undefined)payload.building_budget={enabled};
 sql(as(owner,`insert into ajanlatok(id,user_id,project_name,payload) values('${id}','${owner}','Guard test',${literal(payload)})`));return id;}
check('detailed and malformed flags rejected with 0A000, no links/status/data changed',()=>{
 for(const flag of [true,'true','false',{},0,[]]){
  const id=quote(flag),snapshot=sql(`select to_jsonb(q) from ajanlatok q where id='${id}'`);
  // An already existing pending token must not be revoked by a rejected attempt.
  sql(`insert into ajanlat_megosztasok(quote_id,owner_user_id,token_hash,expires_at,quote_snapshot) values('${id}','${owner}','guard-${id}',now()+interval '1 day','{}')`);
  const links=sql(`select jsonb_agg(to_jsonb(s)) from ajanlat_megosztasok s where quote_id='${id}'`);
  for(const user of [owner,admin])sqlError(as(user,`select create_quote_share_v1('${id}',30)`),'0A000','munkavaltozat');
  assert.equal(sql(`select to_jsonb(q) from ajanlatok q where id='${id}'`),snapshot);
  assert.equal(sql(`select jsonb_agg(to_jsonb(s)) from ajanlat_megosztasok s where quote_id='${id}'`),links);
 }
});
check('normal/missing, explicit false and null flags preserve sharing and acceptance',()=>{
 for(const flag of [undefined,false,null]){
  const id=quote(flag),token=JSON.parse(sql(as(owner,`select create_quote_share_v1('${id}',30)`))).token;
  assert.equal(sql(`select quote_status from ajanlatok where id='${id}'`),'sent');
  const decision=JSON.parse(sql(`set role anon;select decide_public_quote_v1('${token}','accepted','Client','client@example.test','',true,true)`));assert.equal(decision.ok,true);
  assert.equal(sql(`select quote_status from ajanlatok where id='${id}'`),'accepted');
  sqlError(as(owner,`select create_quote_share_v1('${id}',30)`),'P0001','elfogadott');
 }
});
check('RPC ACL and ownership remain enforced',()=>{
 const id=quote(true);sqlError(`set role anon;select create_quote_share_v1('${id}',30)`,anonCanExecute?'P0001':'42501',anonCanExecute?'jogosults':'permission denied');
 sqlError(as(other,`select create_quote_share_v1('${id}',30)`),'P0001','jogosults');
 assert.equal(metadata(),before);
});

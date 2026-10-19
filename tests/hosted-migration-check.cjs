// Only used by the disposable PostgreSQL test runner, before each migration.
const {sql,assert}=require('./pg-helper.cjs');
function fingerprint(){return sql(`select jsonb_build_object(
 'columns',(select jsonb_agg(to_jsonb(x) order by table_name,ordinal_position) from information_schema.columns x where table_schema='public'),
 'constraints',(select jsonb_agg(to_jsonb(x) order by conname,conrelid) from pg_constraint x where connamespace='public'::regnamespace),
 'policies',(select jsonb_agg(to_jsonb(x) order by tablename,policyname) from pg_policies x where schemaname='public'),
 'tables',(select jsonb_agg(jsonb_build_array(relname,relacl,relrowsecurity,relforcerowsecurity) order by relname) from pg_class where relnamespace='public'::regnamespace),
 'functions',(select jsonb_agg(jsonb_build_array(proname,prosrc,proacl,prosecdef,proconfig) order by proname,oid) from pg_proc where pronamespace='public'::regnamespace));`)}
function verifyRollback(text,name){
 seedLegacy();
 const before=fingerprint();
 assert.match(text,/commit;\s*$/i);
 const broken=text.replace(/commit;\s*$/i,`do $$ begin raise exception 'injected migration interruption'; end $$; commit;`);
 sql(broken,false);assert.equal(fingerprint(),before,'Failed migration leaked DDL/grants/functions: '+name);
 console.log('PASS hosted-schema failed migration rolls back all catalog changes: '+name);
}

let legacyRows;
function seedLegacy(){legacyRows=sql("select jsonb_build_object('accepted_at',accepted_at,'name',project_name,'status',quote_status) from ajanlatok where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'");}
function verifyPreserved(){assert.equal(sql("select jsonb_build_object('accepted_at',accepted_at,'name',project_name,'status',quote_status) from ajanlatok where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'"),legacyRows);console.log('PASS hosted migration preserves historical accepted quote');}

module.exports={verifyRollback,verifyPreserved};

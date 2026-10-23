// Only used by the disposable PostgreSQL test runner, before each migration.
const {sql,sqlError,assert}=require('./pg-helper.cjs');
function fingerprint(){return sql(`select jsonb_build_object(
 'columns',(select jsonb_agg(to_jsonb(x) order by table_name,ordinal_position) from information_schema.columns x where table_schema='public'),
 'constraints',(select jsonb_agg(to_jsonb(x) order by conname,conrelid) from pg_constraint x where connamespace='public'::regnamespace),
 'policies',(select jsonb_agg(to_jsonb(x) order by tablename,policyname) from pg_policies x where schemaname='public'),
 'tables',(select jsonb_agg(jsonb_build_array(relname,relacl,relrowsecurity,relforcerowsecurity) order by relname) from pg_class where relnamespace='public'::regnamespace),
 'functions',(select jsonb_agg(jsonb_build_array(proname,prosrc,proacl,prosecdef,proconfig) order by proname,oid) from pg_proc where pronamespace='public'::regnamespace));`)}
function verifyRollback(text,name){
 seedLegacy();if(!legacyCatalog)legacyCatalog=catalogSubset();
 // Existing data must roll back too, not just newly created catalog objects.
 sql("create table public.issue8_rollback_probe(id int primary key,value text);insert into public.issue8_rollback_probe values(1,'before');");
 const before=fingerprint();
 assert.match(text,/^begin;/mi);assert.match(text,/commit;\s*$/i);
 const broken=text.replace(/^begin;/mi,()=>`begin;
 update public.issue8_rollback_probe set value='changed';
 insert into public.issue8_rollback_probe values(2,'inserted');
 create table public.issue8_rollback_ddl(id int);`)
 .replace(/commit;\s*$/i,()=>`do $$ begin raise exception using errcode='P0001', message='injected migration interruption'; end $$; commit;`);
 sqlError(broken,'P0001','injected migration interruption');
 assert.equal(fingerprint(),before,'Failed migration leaked DDL/grants/functions: '+name);
 assert.equal(sql('select jsonb_agg(to_jsonb(p) order by id) from public.issue8_rollback_probe p;'),'[{"id": 1, "value": "before"}]','Failed migration leaked UPDATE/INSERT');
 sql('drop table public.issue8_rollback_probe;');
 console.log('PASS hosted-schema injected P0001 reaches final RAISE; full DDL/grants/functions and UPDATE/INSERT roll back: '+name);
}

let legacyRows;
function seedLegacy(){legacyRows=sql("select jsonb_build_object('accepted_at',accepted_at,'name',project_name,'status',quote_status) from ajanlatok where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'");}
function verifyPreserved(){checkLegacyCatalog();assert.equal(sql("select jsonb_build_object('accepted_at',accepted_at,'name',project_name,'status',quote_status) from ajanlatok where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'"),legacyRows);console.log('PASS hosted migration preserves historical accepted quote');}


let legacyCatalog;
function catalogSubset(){return JSON.parse(sql(`select jsonb_build_object(
 'constraints',(select jsonb_agg(jsonb_build_array(c.relname,x.conname,pg_get_constraintdef(x.oid)) order by c.relname,x.conname) from pg_constraint x join pg_class c on c.oid=x.conrelid where x.connamespace='public'::regnamespace),
 'indexes',(select jsonb_agg(jsonb_build_array(tablename,indexname,indexdef) order by tablename,indexname) from pg_indexes where schemaname='public'),
 'policies',(select jsonb_agg(to_jsonb(x) order by tablename,policyname) from pg_policies x where schemaname='public'),
 'rights',(select jsonb_agg(jsonb_build_array(relname,relacl,relrowsecurity,relforcerowsecurity) order by relname) from pg_class where relnamespace='public'::regnamespace and relkind='r'));`))}
function checkLegacyCatalog(){const current=catalogSubset();for(const key of Object.keys(legacyCatalog))for(const row of legacyCatalog[key]||[])assert.ok((current[key]||[]).some(value=>JSON.stringify(value)===JSON.stringify(row)),'Migration changed existing '+key+': '+JSON.stringify(row));}

module.exports={verifyRollback,verifyPreserved};

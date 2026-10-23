// Runs after the hosted-schema integration suite, on disposable PostgreSQL 17 only.
const fs=require('node:fs');const {sql,sqlError,check,as,owner,other,assert}=require('./pg-helper.cjs');
const tables=JSON.parse(fs.readFileSync('tests/hosted-schema-provenance.json')).tables;
const naplo=tables.includes('projects');
check('SQLSTATE assertion rejects syntax errors as intentional migration interruption',()=>{
 const malformed="do $ begin raise exception 'injected migration interruption'; end $;";
 assert.throws(()=>sqlError(malformed,'P0001','injected migration interruption'),{code:'ERR_ASSERTION'});
 sqlError(malformed,'42601','syntax error');
});
const captured=JSON.parse(fs.readFileSync('tests/hosted-default-acl.json'));
const browserRoles=['anon','authenticated'],creators=['postgres','supabase_admin'];
const aclTables=[...new Set(captured.public_tables.map(row=>row.table_name))];
// Unrelated tables are ACL-only placeholders, NOT a claim to model their schema.
// This lets us execute the exact complete proposals, rather than filter their SQL.
for(const table of aclTables)if(sql(`select to_regclass('public."${table}"')`)==='')sql(`create table public."${table}"(id int);`);
sql('create role supabase_admin nologin;');
for(const row of captured.public_tables)sql(`grant truncate on public."${row.table_name}" to "${row.grantee}";`);
for(const row of captured.defaults)sql(`alter default privileges for role "${row.creator}" ${row.scope==='GLOBAL'?'':'in schema public'} grant ${row.privilege_type} on tables to "${row.grantee}"${row.is_grantable?' with grant option':''};`);
const defaultRows=()=>JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(x) order by creator,scope,grantee,privilege_type),'[]') from (
 select pg_get_userbyid(d.defaclrole) as creator,case when d.defaclnamespace=0 then 'GLOBAL' else n.nspname end as scope,
 case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,a.privilege_type,a.is_grantable
 from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace cross join lateral aclexplode(d.defaclacl) a
 where pg_get_userbyid(d.defaclrole) in ('postgres','supabase_admin') and d.defaclobjtype='r' and (d.defaclnamespace=0 or n.nspname='public'))x;`));
const normalized=rows=>rows.map(row=>JSON.stringify([row.creator,row.scope,row.grantee,row.privilege_type,row.is_grantable])).sort();
const otherDefaults=rows=>normalized(rows.filter(row=>!(browserRoles.includes(row.grantee)&&row.privilege_type==='TRUNCATE')));
const rights=()=>JSON.parse(sql(`select jsonb_agg(jsonb_build_array(c.relname,r.rolname,p.name,has_table_privilege(r.oid,c.oid,p.name)) order by c.relname,r.rolname,p.name)
 from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join pg_roles r cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('REFERENCES'),('TRIGGER'),('MAINTAIN'),('TRUNCATE')) p(name)
 where n.nspname='public' and c.relkind='r' and r.rolname in ('anon','authenticated','service_role') and not(p.name='TRUNCATE' and r.rolname in ('anon','authenticated'));`));
const before=rights(),defaultsBefore=defaultRows();
check('both creators reproduce captured GLOBAL/public default ACLs; GLOBAL is absent',()=>{
 assert.deepEqual(normalized(defaultsBefore),normalized(captured.defaults));
 for(const creator of creators){
  assert.equal(defaultsBefore.filter(row=>row.creator===creator&&row.scope==='GLOBAL').length,0);
  for(const role of browserRoles)assert.ok(defaultsBefore.some(row=>row.creator===creator&&row.scope==='public'&&row.grantee===role&&row.privilege_type==='TRUNCATE'));
 }
});
check('all captured public tables reproduce exact direct browser TRUNCATE grants',()=>{
 for(const table of aclTables)for(const role of browserRoles)assert.equal(sql(`select has_table_privilege('${role}','public."${table}"','TRUNCATE')`),captured.public_tables.some(row=>row.table_name===table&&row.grantee===role)?'t':'f');
});
// Demonstrate the RLS bypass on a synthetic table, never on hosted data.
sql(`create table public.test_truncate_probe(id int);alter table public.test_truncate_probe enable row level security;
 insert into public.test_truncate_probe values(1);grant select,truncate on public.test_truncate_probe to anon;`);
check('TRUNCATE bypasses RLS on synthetic disposable table',()=>{
 assert.equal(sql('set role anon;select count(*) from public.test_truncate_probe'),'0');
 sql('set role anon;truncate public.test_truncate_probe;');assert.equal(sql('select count(*) from public.test_truncate_probe'),'0');
});
sql('drop table public.test_truncate_probe;');
const browserProposal=fs.readFileSync('tests/fixtures/permissions/revoke-browser-truncate.sql','utf8');
const platformProposal=fs.readFileSync('tests/fixtures/permissions/revoke-platform-default-truncate.sql','utf8');
check('new tables under BOTH creators inherit the captured broad defaults BEFORE the proposals',()=>{
 for(const creator of creators){
  sql(`grant create on schema public to ${creator};set role ${creator};create table public.test_default_before(id int);`);
  for(const role of browserRoles)assert.equal(sql(`select has_table_privilege('${role}','public.test_default_before','TRUNCATE')`),'t');
  sql('drop table public.test_default_before;');
 }
});
// Real hosted postgres is NOT a platform operator. This local superuser only
// models the separately authorized platform script; the boundary is tested below.
sql(browserProposal);sql(platformProposal);sql(browserProposal);sql(platformProposal);
check('exact repeatable proposals remove TRUNCATE from ALL inventoried public tables only',()=>{
 for(const table of aclTables)for(const role of browserRoles)assert.equal(sql(`select has_table_privilege('${role}','public."${table}"','TRUNCATE')`),'f');
 assert.deepEqual(rights(),before,'CRUD/other grants or service_role TRUNCATE changed');
 assert.deepEqual(otherDefaults(defaultRows()),otherDefaults(defaultsBefore),'Non-TRUNCATE defaults changed');
});
check('new public tables under BOTH creators lose browser TRUNCATE but preserve all other defaults',()=>{
 for(const creator of creators){
  sql(`set role ${creator};create table public.test_default_after(id int);`);
  for(const role of browserRoles)assert.equal(sql(`select has_table_privilege('${role}','public.test_default_after','TRUNCATE')`),'f');
  for(const row of captured.defaults.filter(row=>row.creator===creator&&!(browserRoles.includes(row.grantee)&&row.privilege_type==='TRUNCATE')))
   assert.equal(sql(`select has_table_privilege('${row.grantee}','public.test_default_after','${row.privilege_type}')`),'t');
  sql('drop table public.test_default_after;');
 }
});
check('adversarial GLOBAL grants survive schema REVOKE; BOTH proposals refuse them atomically',()=>{
 for(const creator of creators){
  sql(`alter default privileges for role ${creator} grant truncate on tables to anon,authenticated;
   alter default privileges for role ${creator} in schema public revoke truncate on tables from anon,authenticated;
   set role ${creator};create table public.test_global_default(id int);`);
  for(const role of browserRoles)assert.equal(sql(`select has_table_privilege('${role}','public.test_global_default','TRUNCATE')`),'t');
  sql('drop table public.test_global_default;');
  const prior=normalized(defaultRows());
  sqlError(creator==='postgres'?browserProposal:platformProposal,'P0001','Global TRUNCATE default requires separate review for '+creator);
  assert.deepEqual(normalized(defaultRows()),prior);assert.deepEqual(rights(),before);
  sql(`alter default privileges for role ${creator} revoke truncate on tables from anon,authenticated;`);
 }
 assert.deepEqual(otherDefaults(defaultRows()),otherDefaults(defaultsBefore));
});
if(naplo){
 const id='f1111111-1111-4111-8111-111111111111';
 check('standalone journal CRUD, daily photos/tasks/materials survive minimum rights change',()=>{
  sql(as(owner,`insert into projects(id,user_id,name) values('${id}','${owner}','Standalone');
   insert into entries(user_id,project_id,note,image_urls,video_urls) values('${owner}','${id}','Daily note','["synthetic-photo.jpg"]','["synthetic-video.mp4"]');
   insert into tasks(user_id,project_id,title) values('${owner}','${id}','Daily task');
   insert into project_materials(user_id,project_id,name,quantity) values('${owner}','${id}','Daily material',2);
   update projects set progress=25 where id='${id}';`));
  assert.equal(sql(as(owner,`select image_urls->>0 from entries where project_id='${id}'`)),'synthetic-photo.jpg');
  assert.equal(sql(as(other,`select count(*) from projects where id='${id}'`)),'0');
  assert.equal(sql(as(other,`select count(*) from entries where project_id='${id}'`)),'0');
  sql(as(owner,`delete from tasks where project_id='${id}';delete from project_materials where project_id='${id}';delete from entries where project_id='${id}';delete from projects where id='${id}';`));
 });
 check('profile field restrictions remain effective',()=>{
  for(const col of ['role','email','is_admin'])assert.equal(sql(`select has_column_privilege('authenticated','profiles','${col}','UPDATE')`),'f');
  assert.equal(sql(`select has_column_privilege('authenticated','profiles','company_name','UPDATE')`),'t');
 });
 check('hosted legacy timestamp and absent historical FKs are preserved',()=>{
  assert.equal(sql("select data_type from information_schema.columns where table_schema='public' and table_name='diary_entries' and column_name='created_at'"),'timestamp without time zone');
  assert.equal(sql("select count(*) from pg_constraint where conrelid='project_materials'::regclass and contype='f'"),'0');
 });
}else{
 check('standalone quote and optional unlinked KivitelezesPRO save remain usable',()=>{
  sql(as(owner,`insert into ajanlatok(user_id,project_name) values('${owner}','Standalone quote');`));
  const saved=JSON.parse(sql(as(owner,`select save_kivitelezes_project_v2('f1111111-1111-4111-8111-111111111111',null,'{"project_name":"Optional standalone","payload":{}}');`)));
  assert.equal(saved.revision,1);assert.equal(saved.source_quote_id,null);
 });
}
check('captured permission rollback restores exactly the original modeled table rights',()=>{
 sql(fs.readFileSync('tests/fixtures/permissions/restore-browser-truncate-snapshot.sql','utf8'));
 sql(fs.readFileSync('tests/fixtures/permissions/restore-platform-default-truncate-snapshot.sql','utf8'));
 for(const table of aclTables)for(const role of browserRoles)
  assert.equal(sql(`select has_table_privilege('${role}','public."${table}"','TRUNCATE')`),captured.public_tables.some(row=>row.table_name===table&&row.grantee===role)?'t':'f');
 assert.deepEqual(normalized(defaultRows()),normalized(defaultsBefore),'Restore changed default scope or privileges');
 assert.deepEqual(rights(),before);
});
check('non-superuser owner can change own defaults but cannot change platform defaults',()=>{
 sql(`begin;create role issue8_owner nologin createrole;grant usage,create on schema public to issue8_owner;
 set role issue8_owner;
 alter default privileges in schema public revoke truncate on tables from anon,authenticated;
 do $$begin
  begin
   execute 'alter default privileges for role supabase_admin in schema public revoke truncate on tables from anon,authenticated';
   raise exception 'Unexpected platform privilege';
  exception when insufficient_privilege then null;
  end;
 end $$;reset role;rollback;`);
});
console.log('Hosted-schema security/standalone checks completed. No production privileges modified.');

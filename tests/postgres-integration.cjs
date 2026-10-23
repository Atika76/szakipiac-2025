const fs=require('node:fs');
const {sql,check,as,owner,other,admin,concurrent,ready,assert}=require('./pg-helper.cjs');
const tried=new Set();
const file=p=>{const text=fs.readFileSync(p,'utf8');
 if(process.env.ISSUE8_SCHEMA==='hosted' && p.includes('/migrations/') && !tried.has(p)){
  require('./hosted-migration-check.cjs').verifyRollback(text,p);tried.add(p);
 }const result=sql(text);if(process.env.ISSUE8_SCHEMA==='hosted' && p.includes('/migrations/'))require('./hosted-migration-check.cjs').verifyPreserved();return result;};
file('tests/bootstrap.sql');
if(process.env.ISSUE8_SCHEMA==='hosted')file('tests/hosted-schema.sql');
else for(const p of ['ajanlatok_schema.sql','kivitelezes_pro_schema.sql','ajanlat_elfogadas.sql'])file('supabase/'+p);
const legacy='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
sql(`insert into ajanlatok(id,user_id,quote_status,accepted_at,project_name) values('${legacy}','${owner}','accepted','2026-01-01','Legacy');`);
sql('drop policy if exists ajanlatok_update_own_or_admin on ajanlatok;'); // Match live missing UPDATE policy.
const migration='supabase/migrations/202610180001_quote_workflow_stabilization.sql';
file(migration);file(migration);
file('supabase/migrations/202610180002_project_save_retry.sql');file('supabase/migrations/202610180002_project_save_retry.sql');
check('migration repeats without manufacturing historical decisions',()=>{assert.equal(sql(`select count(*) from ajanlat_megosztasok where quote_id='${legacy}'`),'0');assert.equal(sql(`select accepted_at::date from ajanlatok where id='${legacy}'`),'2026-01-01')});
let seq=0;
function quote(){const id=`00000000-0000-4000-8000-${String(++seq).padStart(12,'0')}`;sql(as(owner,`insert into ajanlatok(id,user_id,user_email,project_name,total_gross,payload) values('${id}','${owner}','owner@example.test','Original',127000,'{"items":[{"name":"Original item"}]}');`));return id;}
function share(q){return JSON.parse(sql(as(owner,`select create_quote_share_v1('${q}',30)`))).token;}
function decide(t){return `select decide_public_quote_v1('${t}','accepted','Test client','client@example.test','',true,true);`;}
const q=quote();
check('draft UPDATE works with live-compatible added RLS policy',()=>{sql(as(owner,`update ajanlatok set project_name='Original' where id='${q}';`));assert.equal(sql(as(owner,`update ajanlatok set total_gross=127000 where id='${q}' returning id;`)),q)});
const token=share(q);
check('sent content is immutable via direct authenticated write',()=>sql(as(owner,`update ajanlatok set total_gross=1 where id='${q}';`),false));
check('snapshot contains the exact sent content',()=>{const v=JSON.parse(sql(`set role anon;select get_public_quote_v1('${token}');`));assert.equal(v.total_gross,127000);assert.equal(v.payload.items[0].name,'Original item')});
check('valid public decision is recorded by trusted server RPC',()=>{assert.equal(JSON.parse(sql(`set role anon;${decide(token)}`)).decision,'accepted');assert.equal(sql(`select quote_status from ajanlatok where id='${q}'`),'accepted')});
check('accepted content is protected for owner AND admin',()=>{for(const user of [owner,admin])sql(as(user,`update ajanlatok set payload='{}' where id='${q}';`),false)});
check('accepted quote cannot be deleted',()=>sql(as(owner,`delete from ajanlatok where id='${q}';`),false));
check('client cannot forge acceptance on INSERT or UPDATE',()=>{sql(as(owner,`insert into ajanlatok(user_id,quote_status,accepted_at) values('${owner}','accepted',now());`),false);const draft=quote();sql(as(owner,`update ajanlatok set quote_status='accepted',accepted_at=now() where id='${draft}';`),false)});
check('linked new draft version preserves original quote',()=>{sql(as(owner,`insert into ajanlatok(user_id,parent_quote_id,project_name) values('${owner}','${q}','Revision');`));assert.equal(sql(`select count(*) from ajanlatok where parent_quote_id='${q}' and quote_status='draft'`),'1');assert.equal(sql(`select total_gross from ajanlatok where id='${q}'`),'127000')});
check('RLS hides another owner and parent-version spoof is rejected',()=>{assert.equal(sql(as(other,`select count(*) from ajanlatok where id='${q}'`)),'0');sql(as(other,`insert into ajanlatok(user_id,parent_quote_id) values('${other}','${q}');`),false)});
check('repeated decision is idempotent',()=>assert.equal(JSON.parse(sql(`set role anon;${decide(token)}`)).already_decided,true));
check('expired and revoked links cannot accept',()=>{let id=quote(),t=share(id);sql(`update ajanlat_megosztasok set expires_at=now()-interval '1 day' where quote_id='${id}'`);assert.equal(JSON.parse(sql(`set role anon;${decide(t)}`)).error,'expired');id=quote();t=share(id);share(id);assert.equal(JSON.parse(sql(`set role anon;${decide(t)}`)).error,'invalid_link')});
const project='99999999-9999-4999-8999-999999999999';
let payload={project_name:'Project',client_name:'Client',location:'Test',total_gross:127000,payload:{items:[]},source_quote_id:q};
const save=(user,revision,row=payload)=>as(user,`select save_kivitelezes_project_v2('${project}',${revision===null?'null':revision},'${JSON.stringify(row)}');`);
check('first save INSERT, second save UPDATE, one real PostgreSQL row',()=>{assert.equal(JSON.parse(sql(save(owner,null))).revision,1);assert.equal(JSON.parse(sql(save(owner,1))).revision,2);assert.equal(sql(`select count(*) from kivitelezes_projektek where id='${project}'`),'1')});
check('stale revision and foreign user cannot overwrite project',()=>{sql(save(owner,1,{...payload,project_name:'Stale overwrite'}),false);sql(save(other,2),false);assert.equal(sql(`select revision from kivitelezes_projektek where id='${project}'`),'2')});
check('admin can update but cannot reassign owner',()=>{assert.equal(JSON.parse(sql(save(admin,2))).user_id,owner);sql(as(admin,`update kivitelezes_projektek set user_id='${other}' where id='${project}'`),false)});
check('direct legacy writes bump optimistic revision',()=>{sql(as(owner,`update kivitelezes_projektek set project_name='Legacy edit' where id='${project}'`));assert.equal(sql(`select revision from kivitelezes_projektek where id='${project}'`),'4')});
check('foreign quote cannot be linked to project',()=>{const foreign={...payload,source_quote_id:legacy};sql(as(other,`select save_kivitelezes_project_v2('88888888-8888-4888-8888-888888888888',null,'${JSON.stringify(foreign)}');`),false)});
// A rejected call must roll back; fixing its link reuses the same project ID.
check('invalid quote rejection then corrected INSERT and UPDATE keep one project',()=>{
 const id='66666666-6666-4666-8666-666666666666';
 const run=(revision,row)=>as(owner,`select save_kivitelezes_project_v2('${id}',${revision===null?'null':revision},'${JSON.stringify(row)}');`);
 for(const source_quote_id of ['not-a-uuid','55555555-5555-4555-8555-555555555555'])sql(run(null,{...payload,source_quote_id}),false);
 assert.equal(sql(`select count(*) from kivitelezes_projektek where id='${id}'`),'0');
 assert.equal(JSON.parse(sql(run(null,payload))).revision,1);
 const foreign='44444444-4444-4444-8444-444444444444';
 sql(as(other,`insert into ajanlatok(id,user_id,project_name) values('${foreign}','${other}','Foreign quote');`));
 sql(run(1,{...payload,source_quote_id:foreign}),false);
 assert.equal(sql(`select revision from kivitelezes_projektek where id='${id}'`),'1');
 assert.equal(JSON.parse(sql(run(1,{...payload,project_name:'Corrected'}))).revision,2);
 assert.equal(sql(`select count(*) from kivitelezes_projektek where id='${id}'`),'1');
});
// Lost HTTP responses: different saved_at must not create a conflict or a new row.
const retryId='77777777-7777-4777-8777-777777777777';
const retryRow={...payload,payload:{items:[],saved_at:'first'}};
const retrySave=(revision,row=retryRow)=>as(owner,`select save_kivitelezes_project_v2('${retryId}',${revision===null?'null':revision},'${JSON.stringify(row)}');`);
check('committed INSERT response lost: timestamp-only retry returns original revision',()=>{
 assert.equal(JSON.parse(sql(retrySave(null))).revision,1);
 assert.equal(JSON.parse(sql(retrySave(null,{...retryRow,payload:{...retryRow.payload,saved_at:'retry'}}))).revision,1);
 assert.equal(sql(`select count(*) from kivitelezes_projektek where id='${retryId}'`),'1');
});
check('retry refuses a changed scalar business field or owner',()=>{
 sql(retrySave(null,{...retryRow,total_gross:1}),false);sql(as(other,`select save_kivitelezes_project_v2('${retryId}',null,'${JSON.stringify(retryRow)}');`),false);
});
check('committed UPDATE response lost: timestamp-only retry acknowledges next revision',()=>{
 const next={...retryRow,project_name:'Updated'};assert.equal(JSON.parse(sql(retrySave(1,next))).revision,2);
 assert.equal(JSON.parse(sql(retrySave(1,{...next,payload:{...next.payload,saved_at:'retry update'}}))).revision,2);
 sql(retrySave(1,{...next,client_name:'different'}),false);
});
(async()=>{
 // Real concurrent connections; quote row lock is acquired before the link lock.
 let id=quote(),t=share(id);
 let holder=concurrent(`begin;select id from ajanlatok where id='${id}' for update;\\echo READY
select pg_sleep(1);set role anon;${decide(t)}commit;`);
 await ready(holder);
 let writer=concurrent(as(owner,`update ajanlatok set total_gross=5 where id='${id}';`));
 const [a,b]=await Promise.all([holder.done,writer.done]);assert.equal(a.code,0,a.err);assert.notEqual(b.code,0);assert.equal(sql(`select total_gross from ajanlatok where id='${id}'`),'127000');console.log('PASS concurrent acceptance wins; waiting content edit is refused');
 id=quote();t=share(id);
 holder=concurrent(`begin;select id from ajanlatok where id='${id}' for update;\\echo READY
select pg_sleep(1);${as(owner,`update ajanlatok set total_gross=5 where id='${id}';`)}commit;`);
 await ready(holder);writer=concurrent(`set role anon;${decide(t)}`);
 const [c,d]=await Promise.all([holder.done,writer.done]);assert.notEqual(c.code,0);assert.equal(d.code,0,d.err);assert.equal(sql(`select quote_status from ajanlatok where id='${id}'`),'accepted');console.log('PASS edit-first transaction rolls back; waiting acceptance keeps original content');
 console.log('PostgreSQL/RLS integration completed successfully.');
})().catch(e=>{console.error(e);process.exitCode=1});

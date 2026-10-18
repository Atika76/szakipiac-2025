const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {edge,span,query}=require('./helpers.cjs');
const kp='kivitelezes-pro.html',calc='kalkulator.html';
function clientContext(options={}) {
 let calls=[],records=new Map(),resolve;
 const context={crypto:require('node:crypto').webcrypto,JSON,toast(){},readProjectForm(){},
  normalizeProjectStateForSave:()=>({project:{name:'Test'},items:[]}),totals:()=>({gross:127000}),
  state:{project:{name:'Test'},source_quote_id:null},cloudProject:{id:null,owner:null,revision:null,pending:null},
  refreshSession:async()=>({user:{id:options.user||'owner'}}),loadSavedProjects:async()=>{},sendKivitelezesToEpitesNaplo:async id=>calls.push(['send',id]),
  supa:{rpc:async(name,args)=>{calls.push([name,args]);if(options.wait)await new Promise(r=>resolve=r);let row=records.get(args.p_id);row={id:args.p_id,revision:(row?.revision||0)+1};records.set(row.id,row);return {data:row}}}};
 vm.createContext(context);vm.runInContext(span(kp,'async function saveSupabase(','async function loadSavedProjects('),context);
 return {context,calls,records,release:()=>resolve()};
}
test('same project INSERT then UPDATE identity; new project has another id',async()=>{
 const {context:c,calls,records}=clientContext();await c.saveSupabase();await c.saveSupabase();assert.equal(records.size,1);assert.equal(calls[1][1].p_revision,1);
 c.cloudProject={id:null,owner:null,revision:null,pending:null};await c.saveSupabase();assert.equal(records.size,2);
});
test('parallel save calls share one write',async()=>{const x=clientContext({wait:true});const a=x.context.saveSupabase(),b=x.context.saveSupabase();await new Promise(setImmediate);x.release();assert.equal(await a,await b);assert.equal(x.calls.length,1)});
test('late save cannot attach id or trigger journal to new context',async()=>{const x=clientContext({wait:true});const a=x.context.saveSupabase({openEpitesNaplo:true});await new Promise(setImmediate);x.context.cloudProject={id:null,owner:null,revision:null,pending:null};x.release();await a;assert.equal(x.context.cloudProject.id,null);assert.equal(x.calls.length,1)});
test('local save owned by another account is refused',async()=>{const x=clientContext();x.context.cloudProject.owner='other';assert.equal(await x.context.saveSupabase(),null);assert.equal(x.calls.length,0)});
test('accepted quote save is refused; draft save proceeds',async()=>{
 for(const status of ['draft','sent','viewed','accepted','rejected','expired']){
  const writes=[];const c={currentQuoteId:'saved',quoteContextEpoch:1,parentQuoteId:null,refreshSession:async()=>({user:{id:'u'}}),toast(){},
   totals:()=>({}),payloadNow:()=>({client:{},quote_meta:{}}),loadSaved:async()=>{},supa:{from:()=>({select(){return this},eq(){return this},single:async()=>({data:{quote_status:status}}),update(row){writes.push(row);return query({data:{id:'saved'}})}})}};
  vm.createContext(c);vm.runInContext(span(calc,'async function persistQuoteToSupabase(','async function loadSaved('),c);await c.persistQuoteToSupabase();assert.equal(writes.length,status==='draft'?1:0,status);
 }
});
test('copy action preserves original version relation',()=>{const c={currentQuoteId:'original',parentQuoteId:null,quoteContextEpoch:0};vm.createContext(c);vm.runInContext(span(calc,'function detachQuoteVersion()','\n',),c);c.detachQuoteVersion();assert.equal(c.parentQuoteId,'original');assert.equal(c.currentQuoteId,null)});
function transfer({status='accepted',plan=false,source='q',user='owner'}={}){
 let forwarded=null;const client={auth:{getUser:async()=>({data:{user:{id:user,email:user+'@example.test'}}}),admin:{getUserById:async()=>({data:{user:{email:'owner@example.test'}}})}},from(table){if(table==='szakipiac_360_entitlements')return query({data:null});if(table==='kivitelezes_projektek')return query({data:{id:'plan',user_id:'owner',source_quote_id:source,payload:{items:[{name:'WRONG'}],phases:['phase']}}});return query({data:{id:'q',user_id:'owner',quote_status:status,accepted_at:status==='accepted'?'2026-10-18':null,total_gross:127000,client_name:'Accepted client',payload:{items:[{name:'Accepted item'}]}}})}};
 const handler=edge('supabase/functions/send-quote-to-epitesnaplo/index.ts',{createClient:()=>client,fetch:async(url,req)=>{forwarded=JSON.parse(req.body);return Response.json({ok:true,import_url:'https://example.test/import'})}});
 return {run:()=>handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer valid'},body:JSON.stringify(plan?{kivitelezesProjectId:'plan'}:{quoteId:'q'})})),forwarded:()=>forwarded};
}
for(const plan of [false,true])for(const status of ['draft','sent','viewed','rejected','expired'])test(`server refuses ${status}, planning=${plan}`,async()=>{const x=transfer({plan,status});assert.equal((await x.run()).status,409);assert.equal(x.forwarded(),null)});
test('both paths use accepted version id, price and client',async()=>{for(const plan of [false,true]){const x=transfer({plan});assert.equal((await x.run()).status,200);const f=x.forwarded();assert.equal(f.source_quote_id,'q');assert.equal(f.client_name,'Accepted client');assert.equal(f.quote_total_gross,127000);assert.equal(f.payload.items[0].name,'Accepted item');assert.equal(f.protocol_version,2)}});
test('unlinked preparation and forged caller are refused',async()=>{assert.equal((await transfer({plan:true,source:null}).run()).status,409);assert.equal((await transfer({user:'other'}).run()).status,403)});
test('all inline JavaScript still parses',()=>{for(const path of ['index.html',calc,kp,'ajanlat.html']){let i=0;for(const m of fs.readFileSync(path,'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(!/src=|application\/ld\+json|type="module"/.test(m[1]))new vm.Script(m[2],{filename:path+'#'+i++})}}});
test('deployment workflows are manual, main-only, explicitly confirmed',()=>{for(const name of ['deploy-pages.yml','deploy-szakipiac-import-function.yml']){const s=fs.readFileSync('.github/workflows/'+name,'utf8');assert.ok(!/^  push:/m.test(s));assert.match(s,/github.ref == 'refs\/heads\/main'/);assert.match(s,/inputs.production_confirmation == 'DEPLOY_PRODUCTION'/)}});

// Two real disposable Supabase stacks: Auth, REST/RLS, PostgreSQL, Edge runtime.
// No hosted projects, production credentials, npm packages or production writes.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn,spawnSync}=require('node:child_process');const assert=require('node:assert/strict');
if(process.env.CI!=='true')throw Error('Run only on the isolated CI runner.');
if(process.env.SUPABASE_ACCESS_TOKEN)throw Error('Hosted Supabase token must be absent.');
const source=process.cwd(),peer=path.resolve(process.env.PEER_REPO||'peer-naplo');
const sandbox=fs.mkdtempSync(path.join(os.tmpdir(),'issue8-supabase-'));
const secret='issue8-local-only-handoff-secret';const servers=[];let checks=0;
function command(bin,args,input){const r=spawnSync(bin,args,{input,encoding:'utf8',maxBuffer:20*1024*1024});if(r.error)throw r.error;if(r.status!==0)throw Error(`${bin} ${args.join(' ')}\n${r.stderr}\n${r.stdout}`);return r.stdout;}
const local=(stack,args)=>command('supabase',[...args,'--workdir',stack.dir]);
const sql=(stack,text)=>command('docker',['exec','-i','supabase_db_'+stack.id,'psql','-U','postgres','-d','postgres','-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],text).trim();
const file=(stack,repo,relative)=>sql(stack,fs.readFileSync(path.join(repo,relative),'utf8'));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function config(id,port){return `project_id = "${id}"
[api]
port = ${port}
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
[db]
port = ${port+1}
shadow_port = ${port+2}
major_version = 17
[studio]
enabled = false
[inbucket]
enabled = false
[storage]
enabled = false
[auth]
enabled = true
site_url = "http://127.0.0.1:5588"
[auth.email]
enable_signup = true
enable_confirmations = false
[analytics]
enabled = false
[edge_runtime]
enabled = true
inspector_port = ${port+8}
`}
function prepare(id,port,repo,names){
 const dir=path.join(sandbox,id);fs.mkdirSync(path.join(dir,'supabase/functions'),{recursive:true});
 let toml=config(id,port);
 for(const name of names){fs.cpSync(path.join(repo,'supabase/functions',name),path.join(dir,'supabase/functions',name),{recursive:true});toml+=`\n[functions.${name}]\nverify_jwt = false\n`;}
 fs.writeFileSync(path.join(dir,'supabase/config.toml'),toml);
 const env=path.join(dir,'supabase/functions/.env');fs.writeFileSync(env,`EPITESNAPLO_IMPORT_SECRET=${secret}\nEPITESNAPLO_SITE_URL=http://127.0.0.1:5588\nEPITESNAPLO_IMPORT_ENDPOINT=http://issue8-naplo-api:8000/functions/v1/create-szakipiac-import\n`);
 return {id,dir,port,env};
}
async function request(stack,route,{token,key,body,method='POST'}={}){
 const res=await fetch(`http://127.0.0.1:${stack.port}${route}`,{method,headers:{apikey:key||stack.keys.ANON_KEY,Authorization:'Bearer '+(token||key||stack.keys.ANON_KEY),'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
 const text=await res.text();let data;try{data=JSON.parse(text)}catch{data={error:text}}return {status:res.status,data};
}
async function ready(stack,name){const until=Date.now()+120000;while(Date.now()<until){try{const res=await fetch(`http://127.0.0.1:${stack.port}/functions/v1/${name}`,{method:'OPTIONS'});if(res.status===200)return;}catch{}await sleep(1000);}throw Error('Edge runtime not ready: '+stack.id);}
async function user(stack,email){
 const created=await request(stack,'/auth/v1/admin/users',{key:stack.keys.SERVICE_ROLE_KEY,body:{email,password:'Test-password-123!',email_confirm:true}});assert.equal(created.status,200,JSON.stringify(created.data));
 const login=await request(stack,'/auth/v1/token?grant_type=password',{body:{email,password:'Test-password-123!'}});assert.equal(login.status,200,JSON.stringify(login.data));return {id:created.data.id,token:login.data.access_token};
}
async function pass(name,fn){await fn();checks++;console.log('PASS '+name);}
const a=prepare('issue8-source',54321,source,['send-quote-to-epitesnaplo']);
const b=prepare('issue8-naplo',55321,peer,['create-szakipiac-import','claim-szakipiac-import']);
(async()=>{
 try{
  for(const stack of [a,b]){
   console.log('Starting disposable local stack '+stack.id);
   local(stack,['start','--exclude','studio,inbucket,imgproxy,realtime,storage,meta,analytics,vector']);
   stack.keys=JSON.parse(local(stack,['status','--output','json']));
  }
  for(const p of ['ajanlatok_schema.sql','kivitelezes_pro_schema.sql','ajanlat_elfogadas.sql'])file(a,source,'supabase/'+p);
  for(const p of ['202610180001_quote_workflow_stabilization.sql','202610180002_project_save_retry.sql'])file(a,source,'supabase/migrations/'+p);
  sql(a,'create table public.szakipiac_360_entitlements(user_id uuid primary key,plan text,expires_at timestamptz);');
  file(b,peer,'supabase-schema.sql');file(b,peer,'supabase/szakipiac_import_schema.sql');
  for(const p of ['202610180001_szakipiac_import_stabilization.sql','202610180002_deleted_import_recovery.sql'])file(b,peer,'supabase/migrations/'+p);
  // Fresh local Supabase defaults normally grant these. Make fixture explicit.
  sql(b,'grant select,insert,update,delete on projects,entries,tasks,project_materials to authenticated;');
  for(const stack of [a,b]){
   const log=fs.openSync(path.join(stack.dir,'edge.log'),'w');
   const child=spawn('supabase',['functions','serve','--no-verify-jwt','--env-file',stack.env,'--workdir',stack.dir],{stdio:['ignore',log,log]});servers.push(child);
  }
  await ready(a,'send-quote-to-epitesnaplo');await ready(b,'claim-szakipiac-import');
  command('docker',['network','create','issue8-handoff']);
  command('docker',['network','connect','--alias','issue8-naplo-api','issue8-handoff','supabase_kong_'+b.id]);
  command('docker',['network','connect','issue8-handoff','supabase_edge_runtime_'+a.id]);
  const ownerA=await user(a,'owner@example.test'),ownerB=await user(b,'owner@example.test'),otherB=await user(b,'other@example.test');
  const payload={project_name:'E2E original',client:{name:'Test client'},items:[{name:'Burkolás',qty:2,unit:'m²',mat_unit_price:100,lab_unit_price:150}],totals:{grossTotal:635,materialTotal:200,laborTotal:300,vatAmount:135}};
  let quote;
  await pass('real Auth login + owner RLS creates a draft quote',async()=>{const res=await request(a,'/rest/v1/ajanlatok',{token:ownerA.token,body:{user_id:ownerA.id,user_email:'owner@example.test',project_name:'E2E original',client_name:'Test client',total_gross:635,payload}});assert.equal(res.status,201,JSON.stringify(res.data));quote=res.data[0];});
  await pass('draft cannot cross the real sender Edge Function',async()=>{const res=await request(a,'/functions/v1/send-quote-to-epitesnaplo',{token:ownerA.token,body:{quoteId:quote.id}});assert.equal(res.status,409,JSON.stringify(res.data));});
  let share;
  await pass('real anonymous client reads and accepts the exact shared version',async()=>{
   const res=await request(a,'/rest/v1/rpc/create_quote_share_v1',{token:ownerA.token,body:{p_quote_id:quote.id,p_valid_days:30}});assert.equal(res.status,200,JSON.stringify(res.data));share=res.data.token;
   const shown=await request(a,'/rest/v1/rpc/get_public_quote_v1',{body:{p_token:share}});assert.equal(shown.data.total_gross,635);
   const accepted=await request(a,'/rest/v1/rpc/decide_public_quote_v1',{body:{p_token:share,p_decision:'accepted',p_name:'Test client',p_email:'client@example.test',p_comment:'',p_terms_accepted:true,p_privacy_accepted:true}});assert.equal(accepted.status,200,JSON.stringify(accepted.data));assert.equal(accepted.data.decision,'accepted');
  });
  await pass('accepted quote content cannot be altered over real REST/RLS',async()=>{const res=await request(a,'/rest/v1/ajanlatok?id=eq.'+quote.id,{method:'PATCH',token:ownerA.token,body:{total_gross:1}});assert.ok(res.status>=400,JSON.stringify(res.data));});
  let link;
  await pass('real sender Edge authenticates handoff to real receiver Edge + DB',async()=>{const res=await request(a,'/functions/v1/send-quote-to-epitesnaplo',{token:ownerA.token,body:{quoteId:quote.id}});assert.equal(res.status,200,JSON.stringify(res.data));assert.equal(res.data.ok,true,JSON.stringify(res.data));link=new URL(res.data.import_url).searchParams.get('token');assert.ok(link);});
  await pass('real destination Auth rejects a different account',async()=>{const res=await request(b,'/functions/v1/claim-szakipiac-import',{token:otherB.token,body:{token:link}});assert.equal(res.status,403,JSON.stringify(res.data));});
  let project;
  await pass('two real simultaneous claims create one journal with accepted content',async()=>{
   const claims=await Promise.all([1,2].map(()=>request(b,'/functions/v1/claim-szakipiac-import',{token:ownerB.token,body:{token:link}})));
   for(const res of claims){assert.equal(res.status,200,JSON.stringify(res.data));assert.equal(res.data.ok,true,JSON.stringify(res.data));}project=claims[0].data.project_id;assert.equal(claims[1].data.project_id,project);
   assert.equal(sql(b,`select count(*) from project_imports where source_quote_id='${quote.id}'`),'1');assert.equal(sql(b,`select quote_total_gross from project_imports where project_id='${project}'`),'635');
  });
  await pass('optional preparation follows the same accepted quote/project',async()=>{
   const id=crypto.randomUUID();const saved=await request(a,'/rest/v1/rpc/save_kivitelezes_project_v2',{token:ownerA.token,body:{p_id:id,p_revision:null,p_row:{project_name:'Planning name',client_name:'Not authoritative',location:'Local',total_gross:999999,payload:{items:[],phases:[]},source_quote_id:quote.id}}});assert.equal(saved.status,200,JSON.stringify(saved.data));
   const sent=await request(a,'/functions/v1/send-quote-to-epitesnaplo',{token:ownerA.token,body:{kivitelezesProjectId:id}});assert.equal(sent.data.ok,true,JSON.stringify(sent.data));const next=new URL(sent.data.import_url).searchParams.get('token');
   const claimed=await request(b,'/functions/v1/claim-szakipiac-import',{token:ownerB.token,body:{token:next}});assert.equal(claimed.data.project_id,project);assert.equal(sql(b,`select quote_total_gross from project_imports where project_id='${project}'`),'635');
  });
  await pass('real project deletion requires explicit owner-confirmed recreation',async()=>{
   const removed=await request(b,'/rest/v1/projects?id=eq.'+project,{method:'DELETE',token:ownerB.token});assert.ok(removed.status<300,JSON.stringify(removed.data));
   const missing=await request(b,'/functions/v1/claim-szakipiac-import',{token:ownerB.token,body:{token:link}});assert.equal(missing.data.code,'project_deleted',JSON.stringify(missing.data));assert.equal(missing.data.can_restore,true);
   const restored=await request(b,'/functions/v1/claim-szakipiac-import',{token:ownerB.token,body:{token:link,restore_deleted_project:true}});assert.equal(restored.data.ok,true,JSON.stringify(restored.data));assert.notEqual(restored.data.project_id,project);assert.equal(restored.data.status,'complete');
  });
  console.log(`Two-app Supabase Auth/REST/RLS/Edge E2E: ${checks} cases passed.`);
 } finally {
  for(const child of servers)child.kill();
  for(const stack of [a,b]){
   const log=path.join(stack.dir,'edge.log');if(fs.existsSync(log)){const text=fs.readFileSync(log,'utf8');if(/error|failed|exception/i.test(text))console.log(stack.id+' edge diagnostics: '+text.slice(-6000));}
   try{local(stack,['stop','--no-backup']);}catch(e){console.log('Local stack cleanup: '+e.message.slice(0,200));}
  }
 }
})().catch(e=>{console.error(e);process.exitCode=1});

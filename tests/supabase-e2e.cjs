// Two real disposable Supabase stacks: Auth, REST/RLS, PostgreSQL, Edge runtime.
// No hosted projects, production credentials, npm packages or production writes.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn,spawnSync}=require('node:child_process');const assert=require('node:assert/strict');
const vm=require('node:vm');
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
enabled = true
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
 for(const name of names){fs.cpSync(path.join(repo,'supabase/functions',name),path.join(dir,'supabase/functions',name),{recursive:true});toml+=`\n[functions.${name}]\nverify_jwt = ${id==='issue8-source'?'true':'false'}\n`;}
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
   local(stack,['start','--exclude','studio,inbucket,imgproxy,realtime,meta,analytics,vector']);
   stack.keys=JSON.parse(local(stack,['status','--output','json']));
  }
  file(a,source,'tests/hosted-schema.sql');
  for(const p of ['202610180001_quote_workflow_stabilization.sql','202610180002_project_save_retry.sql','202610210001_building_draft_share_guard.sql'])file(a,source,'supabase/migrations/'+p);
  sql(a,'create table public.szakipiac_360_entitlements(user_id uuid primary key,plan text,expires_at timestamptz);');
  file(b,peer,'tests/hosted-schema.sql');file(b,peer,'tests/hosted-storage-policies.sql');
  for(const p of ['202610180001_szakipiac_import_stabilization.sql','202610180002_deleted_import_recovery.sql'])file(b,peer,'supabase/migrations/'+p);
  // Use the captured hosted ACL unchanged; test the minimum TRUNCATE proposal separately.
  sql(b,"insert into storage.buckets(id,name,public,file_size_limit) values('project-videos','project-videos',false,104857600);");
  for(const [stack,repo] of [[a,source],[b,peer]]){
   const tables=JSON.parse(fs.readFileSync(path.join(repo,'tests/hosted-schema-provenance.json'))).tables;
   const revokes=fs.readFileSync(path.join(repo,'docs/proposals/revoke-browser-truncate.sql'),'utf8').split('\n').filter(line=>line.startsWith('REVOKE TRUNCATE')&&tables.some(table=>line.includes('public."'+table+'"')));
   sql(stack,'begin;'+revokes.join('\n')+'commit;');
  }
  file(b,peer,'docs/proposals/enforce-project-write-ownership.sql');
  for(const stack of [a,b]){
   const log=fs.openSync(path.join(stack.dir,'edge.log'),'w');
   const child=spawn('supabase',['functions','serve','--env-file',stack.env,'--workdir',stack.dir],{stdio:['ignore',log,log]});servers.push(child);
  }
  await ready(a,'send-quote-to-epitesnaplo');await ready(b,'claim-szakipiac-import');
  command('docker',['network','create','issue8-handoff']);
  command('docker',['network','connect','--alias','issue8-naplo-api','issue8-handoff','supabase_kong_'+b.id]);
  command('docker',['network','connect','issue8-handoff','supabase_edge_runtime_'+a.id]);
  const ownerA=await user(a,'owner@example.test'),ownerB=await user(b,'owner@example.test'),otherB=await user(b,'other@example.test');
  const payload={project_name:'E2E original',client:{name:'Test client'},items:[{name:'Burkolás',qty:2,unit:'m²',mat_unit_price:100,lab_unit_price:150}],totals:{grossTotal:635,materialTotal:200,laborTotal:300,vatAmount:135}};
  let quote;
  await pass('real Auth login + owner RLS creates a draft quote',async()=>{const res=await request(a,'/rest/v1/ajanlatok',{token:ownerA.token,body:{user_id:ownerA.id,user_email:'owner@example.test',project_name:'E2E original',client_name:'Test client',total_gross:635,payload}});assert.equal(res.status,201,JSON.stringify(res.data));quote=res.data[0];});
  await pass('actual save client recovers after real REST SQLSTATE validation rejections',async()=>{
   const otherA=await user(a,'other@example.test');
   const foreign=await request(a,'/rest/v1/ajanlatok',{token:otherA.token,body:{user_id:otherA.id,project_name:'Foreign draft'}});
   assert.equal(foreign.status,201,JSON.stringify(foreign.data));
   const html=fs.readFileSync(path.join(source,'kivitelezes-pro.html'),'utf8');
   const saveCode=html.slice(html.indexOf('async function saveSupabase('),html.indexOf('async function loadSavedProjects('));
   for(const [invalid,code] of [['not-a-uuid','22P02'],[foreign.data[0].id,'P0001']]){
    let rejected;const messages=[];
    const c={crypto,JSON,toast:message=>messages.push(message),readProjectForm(){},totals:()=>({gross:635}),
     state:{project:{name:'Correctable project'},source_quote_id:invalid},
     normalizeProjectStateForSave:()=>({items:[],saved_at:new Date().toISOString()}),
     cloudProject:{id:null,revision:null,owner:null,pending:null,unconfirmed:null},
     refreshSession:async()=>({user:{id:ownerA.id}}),loadSavedProjects:async()=>{},
     supa:{rpc:async(name,args)=>{const res=await request(a,'/rest/v1/rpc/'+name,{token:ownerA.token,body:args});if(res.status>=400){rejected=res.data;return {data:null,error:res.data}}return {data:res.data,error:null}}}};
    vm.createContext(c);vm.runInContext(saveCode,c);
    for(const revision of [null,1]){
     c.state.source_quote_id=invalid;assert.equal(await c.saveSupabase(),null,messages.join('\n'));
     assert.equal(rejected.code,code);assert.equal(c.cloudProject.unconfirmed,null);assert.equal(c.cloudProject.revision,revision);
     const id=c.cloudProject.id;c.state.source_quote_id=quote.id;assert.equal(await c.saveSupabase(),id,messages.join('\n'));
     assert.equal(c.cloudProject.revision,(revision||0)+1);
     assert.equal(sql(a,`select count(*) from kivitelezes_projektek where id='${id}'`),'1');
    }
   }
  });
  await pass('draft cannot cross the real sender Edge Function',async()=>{const res=await request(a,'/functions/v1/send-quote-to-epitesnaplo',{token:ownerA.token,body:{quoteId:quote.id}});assert.equal(res.status,409,JSON.stringify(res.data));});
  let share;
  await pass('real anonymous client reads and accepts the exact shared version',async()=>{
   const res=await request(a,'/rest/v1/rpc/create_quote_share_v1',{token:ownerA.token,body:{p_quote_id:quote.id,p_valid_days:30}});assert.equal(res.status,200,JSON.stringify(res.data));share=res.data.token;
   const shown=await request(a,'/rest/v1/rpc/get_public_quote_v1',{body:{p_token:share}});assert.equal(shown.data.total_gross,635);
   const accepted=await request(a,'/rest/v1/rpc/decide_public_quote_v1',{body:{p_token:share,p_decision:'accepted',p_name:'Test client',p_email:'client@example.test',p_comment:'',p_terms_accepted:true,p_privacy_accepted:true}});assert.equal(accepted.status,200,JSON.stringify(accepted.data));assert.equal(accepted.data.decision,'accepted');
  });
  await pass('accepted quote content cannot be altered over real REST/RLS',async()=>{const res=await request(a,'/rest/v1/ajanlatok?id=eq.'+quote.id,{method:'PATCH',token:ownerA.token,body:{total_gross:1}});assert.ok(res.status>=400,JSON.stringify(res.data));});
  await pass('standalone destination journal CRUD and photos work without source or preparation',async()=>{
   const created=await request(b,'/rest/v1/projects',{token:ownerB.token,body:{user_id:ownerB.id,name:'Standalone daily journal'}});assert.equal(created.status,201,JSON.stringify(created.data));const id=created.data[0].id;
   const entry=await request(b,'/rest/v1/entries',{token:ownerB.token,body:{user_id:ownerB.id,project_id:id,note:'Daily photo note',image_urls:['data:image/png;base64,iVBORw0KGgo='],video_urls:[]}});assert.equal(entry.status,201,JSON.stringify(entry.data));
   const changed=await request(b,'/rest/v1/entries?id=eq.'+entry.data[0].id,{method:'PATCH',token:ownerB.token,body:{note:'Updated daily note'}});assert.equal(changed.status,200,JSON.stringify(changed.data));
   const own=await request(b,'/rest/v1/entries?id=eq.'+entry.data[0].id,{method:'GET',token:ownerB.token});assert.equal(own.data[0].image_urls[0],'data:image/png;base64,iVBORw0KGgo=');
   const foreign=await request(b,'/rest/v1/entries?project_id=eq.'+id,{method:'GET',token:otherB.token});assert.deepEqual(foreign.data,[]);
   const injected=await request(b,'/rest/v1/entries',{token:otherB.token,body:{user_id:otherB.id,project_id:id,note:'Forbidden foreign project write'}});assert.equal(injected.status,403,JSON.stringify(injected.data));
   const tasks=await request(b,'/rest/v1/tasks',{token:ownerB.token,body:{user_id:ownerB.id,project_id:id,title:'Standalone task'}});assert.equal(tasks.status,201,JSON.stringify(tasks.data));
   const material=await request(b,'/rest/v1/project_materials',{token:ownerB.token,body:{user_id:ownerB.id,project_id:id,name:'Standalone material',quantity:2}});assert.equal(material.status,201,JSON.stringify(material.data));
   const removed=await request(b,'/rest/v1/entries?id=eq.'+entry.data[0].id,{method:'DELETE',token:ownerB.token});assert.equal(removed.status,200,JSON.stringify(removed.data));
  });
  await pass('real private Storage upload/download rejects foreign owner with hosted policies',async()=>{
   const object=ownerB.id+'/synthetic-media.png';
   // The inspected app stores photos inline; private project-videos also accepts
   // image bytes. Exercise the real generic Storage API with synthetic content.
   const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=','base64');
   const headers={apikey:b.keys.ANON_KEY,Authorization:'Bearer '+ownerB.token,'Content-Type':'image/png'};
   const uploaded=await fetch(`http://127.0.0.1:${b.port}/storage/v1/object/project-videos/${object}`,{method:'POST',headers,body:bytes});assert.equal(uploaded.status,200,await uploaded.text());
   const own=await fetch(`http://127.0.0.1:${b.port}/storage/v1/object/authenticated/project-videos/${object}`,{headers});assert.equal(own.status,200);assert.deepEqual(Buffer.from(await own.arrayBuffer()),bytes);
   const foreign=await fetch(`http://127.0.0.1:${b.port}/storage/v1/object/authenticated/project-videos/${object}`,{headers:{...headers,Authorization:'Bearer '+otherB.token}});assert.notEqual(foreign.status,200);
  });
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

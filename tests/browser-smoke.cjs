const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');
const mock=`(() => {
 const session={user:{id:'11111111-1111-4111-8111-111111111111',email:'atika.76@windowslive.com'},access_token:'test'};
 const quote={id:'11111111-1111-4111-8111-111111111111',user_id:session.user.id,project_name:'Elfogadott munka',quote_number:'TEST-1',quote_status:'accepted',accepted_at:'2026-10-18',total_gross:127000,payload:{project_name:'Elfogadott munka',client:{name:'Teszt'},items:[{id:'i',name:'BurkolÄ‚Ë‡s',qty:2,unit:'mĂ‚Ë›',mat_unit_price:100,lab_unit_price:150}]}};
 window.__records=new Map();window.__calls=[];window.__loseResponse=true;
 window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session}}),signOut:async()=>({})},
 from(table){let id=null,row=null,op='select';const b={};for(const m of ['select','order','limit','not','is'])b[m]=()=>b;
 b.eq=(key,value)=>{if(key==='id')id=value;return b};b.insert=rows=>{op='insert';row=rows[0];return b};b.update=r=>{op='update';row=r;return b};b.delete=()=>b;
 const result=()=>{if(table==='ajanlatok')return {data:id?quote:[quote]};if(table==='epitoipari_arak')return {data:[]};if(table==='kivitelezes_projektek')return {data:id?window.__records.get(id):[...window.__records.values()]};return {data:null}};
 b.single=b.maybeSingle=async()=>result();b.then=(ok,fail)=>Promise.resolve(result()).then(ok,fail);return b},
 rpc:async(name,args)=>{window.__calls.push([name,args]);if(name==='save_kivitelezes_project_v2'){if(args.p_row.source_quote_id==='foreign-quote')return {data:null,error:{code:'P0001',message:'Quote owner mismatch'}};const old=window.__records.get(args.p_id);if(old && args.p_revision!==old.revision)return {data:old};const row={id:args.p_id,revision:(old?.revision||0)+1,user_id:session.user.id,created_at:'2026-10-18',...args.p_row};window.__records.set(row.id,row);if(window.__loseResponse){window.__loseResponse=false;throw Error('Injected lost response after commit');}return {data:row}}return {data:{ok:true}}},
 functions:{invoke:async()=>({data:{ok:true,import_url:'https://example.test/import'}})}
 })};
})();`;
(async()=>{
const browser=await chromium.launch({channel:'msedge',headless:true});let results=[];
try{
for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
 const context=await browser.newContext({viewport,acceptDownloads:true});const page=await context.newPage();let errors=[],failures=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>{if(!r.url().includes('favicon'))failures.push(r.url()+':'+r.failure()?.errorText)});
 await context.route('**/*',async route=>{
  const url=route.request().url();
  if(url.includes('@supabase/supabase-js'))return route.fulfill({contentType:'application/javascript',body:mock});
  if(url.includes('.supabase.co'))return route.fulfill({status:500,body:'TEST: unexpected API request blocked'});
  if(url.includes('paypal.com')||url.includes('googletagmanager.com'))return route.fulfill({contentType:'application/javascript',body:''});
  return route.continue();
 });
 await page.goto('http://127.0.0.1:5588/szakipiac-2025/kivitelezes-pro.html');
 await page.waitForFunction(()=>document.querySelector('#linkedQuoteId').options.length===2);
 await page.locator('#projectName').fill('MentÄ‚Â©si prÄ‚Ĺ‚ba');
 await page.locator('#btnSaveSupabase').click();await page.waitForFunction(()=>window.__records.size===1);
 await page.locator('#projectName').fill('MÄ‚Ĺ‚dosÄ‚Â­tott munka');await page.locator('#btnSaveSupabase').click();
 await page.waitForFunction(()=>[...window.__records.values()][0].revision===2);
 assert.equal(await page.evaluate(()=>window.__records.size),1);
 // An invalid imported/stale quote selection is explicitly rejected, then corrected.
 await page.evaluate(()=>document.querySelector('#linkedQuoteId').add(new Option('Foreign quote','foreign-quote')));
 await page.locator('#linkedQuoteId').selectOption('foreign-quote');await page.locator('#btnSaveSupabase').click();
 await page.waitForFunction(()=>!cloudProject.pending);
 assert.equal(await page.evaluate(()=>cloudProject.unconfirmed),null);
 assert.equal(await page.evaluate(()=>[...window.__records.values()][0].revision),2);
 await page.locator('#linkedQuoteId').selectOption('11111111-1111-4111-8111-111111111111');assert.equal(await page.locator('#btnSaveAndOpenEpitesNaplo').isDisabled(),false);
 await page.locator('#btnSaveSupabase').click();await page.waitForFunction(()=>[...window.__records.values()][0].revision===3);
 assert.equal(await page.evaluate(()=>window.__records.size),1);
 await page.locator('#btnNewProject').click();assert.equal(await page.locator('#linkedQuoteId').inputValue(),'');
 await page.locator('#btnSaveSupabase').click();await page.waitForFunction(()=>window.__records.size===2);
 // Local save is independent of JSON export and restores cloud identity.
 await page.locator('#btnSaveLocal').click();await page.locator('#btnNewProject').click();await page.locator('#btnLoadLocal').click();
 await page.locator('#btnSaveSupabase').click();await page.waitForFunction(()=>[...window.__records.values()].some(x=>x.revision===2&&x.project_name!=='MÄ‚Ĺ‚dosÄ‚Â­tott munka'));
 assert.equal(await page.evaluate(()=>window.__records.size),2);
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#btnExportJson').click()]);
 const file=await download.path();const data=JSON.parse(fs.readFileSync(file,'utf8'));assert.ok(data.items.length>0);
 await page.locator('#jsonImport').setInputFiles(file);await page.waitForTimeout(100);await page.locator('#btnSaveSupabase').click();await page.waitForFunction(()=>window.__records.size===3);
 await page.goto('http://127.0.0.1:5588/szakipiac-2025/kalkulator.html');assert.equal(await page.locator('[data-share]').first().isDisabled(),true);await page.locator('[data-load]').first().click();
 await page.waitForFunction(()=>document.querySelector('#project_name').value==='Elfogadott munka');
 await page.locator('#btnDuplicateQuote').click();assert.equal(await page.locator('#quote_status').inputValue(),'draft');
 const [pdf]=await Promise.all([page.waitForEvent('download',{timeout:45000}),page.locator('#btnPdfPro').click()]);
 const pdfBytes=fs.readFileSync(await pdf.path());assert.equal(pdfBytes.subarray(0,5).toString(),'%PDF-');assert.ok(pdfBytes.length>1500);console.log('PDF export '+viewport.width+': '+pdfBytes.length+' bytes');

 // Inspect overflow and actual touch target visibility on changed fields.
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
 results.push({viewport:viewport.width,scope:'Lost-response and deterministic rejection recovery, save/update/new/local/JSON, quote load/copy and disabled accepted share',errors:[...errors],networkFailures:[...failures],overflow});
 assert.deepEqual(errors,[]);
 // The import page uses the same session fixture; deliberately partial result stays visible.
 let attempts=0,mode='partial',lastBody=null;
 await context.route('**/functions/v1/claim-szakipiac-import',route=>{attempts++;lastBody=route.request().postDataJSON();const body=mode==='deleted'?{ok:false,code:'project_deleted',can_restore:true,error:'A korĂˇbbi projektet tĂ¶rĂ¶ltĂ©k. Ăšjra lĂ©trehozhatĂł.'}:{ok:true,project_id:mode==='restored'?'restored-project':'test-project',status:'partial',warnings:['Anyagok: teszthiba'],inserted:{materials:0,tasks:1}};return route.fulfill({status:body.ok?200:409,contentType:'application/json',body:JSON.stringify(body)})});
 await page.goto('http://127.0.0.1:5588/Epites-Naplo/import-szakipiac.html?token=test');
 await page.locator('#importBtn').click();await page.waitForFunction(()=>document.querySelector('#importDetails').textContent.includes('teszthiba'));
 assert.ok(page.url().includes('import-szakipiac.html'));assert.equal(await page.locator('#importBtn').isEnabled(),true);assert.equal(await page.locator('#openProject').isVisible(),true);
 await page.locator('#importBtn').click();await page.waitForFunction(()=>document.querySelector('#importBtn').disabled===false);assert.equal(attempts,2);
 mode='deleted';await page.locator('#importBtn').click();await page.waitForFunction(()=>!document.querySelector('#restoreProjectBtn').classList.contains('hidden'));
 assert.equal(await page.locator('#openProject').isVisible(),false);assert.equal(await page.locator('#openProject').getAttribute('href'),null);
 const beforeCancel=attempts;page.once('dialog',dialog=>dialog.dismiss());await page.locator('#restoreProjectBtn').click();assert.equal(attempts,beforeCancel);
 mode='restored';page.once('dialog',dialog=>dialog.accept());await page.locator('#restoreProjectBtn').click();await page.waitForFunction(()=>document.querySelector('#openProject').getAttribute('href')?.includes('restored-project'));
 assert.equal(lastBody.restore_deleted_project,true);assert.deepEqual(errors,[]);results.push({viewport:viewport.width,scope:'Partial import retry, deleted-project notice, cancelled and confirmed restoration',errors:[],attempts});
 await context.close();
}
fs.writeFileSync(process.env.BROWSER_REPORT || 'browser-smoke-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

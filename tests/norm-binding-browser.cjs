// Serve the project root on 127.0.0.1:5588. Only synthetic data and a mocked SDK.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const E=require('../epulet-szamitas.js'),C=require('../epulet-teteladatok.js');
const mock=fs.readFileSync('tests/building-browser.cjs','utf8').match(/const mock=`([\s\S]*?)`;/)[1];
const out=path.resolve(process.env.BUILDING_REPORT_DIR||'work/norm-binding');fs.mkdirSync(out,{recursive:true});
const work=C.rows.find(r=>r.id==='epulet-alap-1');
const n={id:'norma-'+work.id,name:work.megnevezes,trade:work.szakag,unit:work.egyseg,norm:3.5,kind:'user',source:'SZINTETIKUS TESZT, nem szakmai norma',updated:'2026-10-22'};
const snapshot=p=>p.evaluate(()=>{const q=payloadNow();delete q.saved_at;return {q,state:JSON.parse(JSON.stringify(SzakiPiacBuildingUI.state)),items:JSON.parse(JSON.stringify(items)),id:currentQuoteId,parent:parentQuoteId,epoch:quoteContextEpoch,
 controls:[...document.querySelectorAll('input,select,textarea')].filter(e=>e.type!=='file').map(e=>({id:e.id,value:e.value,checked:e.checked,disabled:e.disabled})),editor:document.getElementById('buildingEditor').innerHTML,print:document.getElementById('printArea').innerHTML};});
const upload=(p,selector,data)=>p.locator(selector).setInputFiles({name:'synthetic-norm-binding.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
 try{for(const width of [1440,390]){
  const ctx=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true}),p=await ctx.newPage(),errors=[],apiRequests=[],localHttpErrors=[],consoleErrors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});p.on('dialog',d=>d.accept());
  p.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:5588/')&&r.status()>=400)localHttpErrors.push({url:r.url(),status:r.status()});});
  await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('@supabase/supabase-js'))return r.fulfill({contentType:'application/javascript',body:mock});if(u.includes('.supabase.co')){apiRequests.push(u);return r.abort();}if(u.includes('paypal.com')||u.includes('googletagmanager.com'))return r.fulfill({body:''});return r.continue();});
  await p.goto('http://127.0.0.1:5588/kalkulator.html');await p.waitForFunction(()=>window.SzakiPiacBuildingUI&&!document.getElementById('btnSave').disabled);
  const seed=E.tradeSample(C);seed.building_budget.custom_catalog=[{...work,id:'sajat-protected',megnevezes:'Megőrzendő saját tétel'}];
  await p.evaluate(q=>{applyPayload(q);currentQuoteId='protected-quote';parentQuoteId='protected-parent';quoteContextEpoch=91;},seed);
  await p.locator('[data-building-edit="0"]').click();await p.locator('#buildingRegistries').evaluate(e=>e.open=true);await p.locator('#bn-select').selectOption(n.id);
  await p.locator('#be-norm_source').fill('Megőrzendő félbehagyott szerkesztés');
  let checks=0;
  // Exact reported record, plus separately wrong names/trades, through the actual file callback.
  for(const patch of [{name:'Más művelet: fúrás',trade:'elokeszites'},{name:'Más művelet: fúrás'},{trade:'elokeszites'}]){
   const before=await snapshot(p),data={format:'szakipiac-resources',registry_version:1,material_catalog:[],norm_catalog:[{...n,...patch}]};
   await p.evaluate(()=>document.getElementById('buildingError').textContent='');await upload(p,'#buildingRegistryImport',data);
   await p.waitForFunction(()=>document.getElementById('buildingError').textContent.includes('stabil normaazonosító'));
   assert.deepEqual(await snapshot(p),before,'Rejected catalog import changed editor/quote/catalog/identity');checks++;
  }
  // A bound norm cannot be silently renamed or moved to another trade by the editor.
  for(const patch of [{name:'Más művelet: fúrás'},{trade:'elokeszites'}]){
   await p.locator('#bn-name').fill(patch.name||n.name);await p.locator('#bn-trade').selectOption(patch.trade||n.trade);
   const before=await snapshot(p);await p.evaluate(()=>document.getElementById('buildingError').textContent='');await p.locator('#bn-save').click();
   await p.waitForFunction(()=>document.getElementById('buildingError').textContent.includes('stabil normaazonosító'));
   assert.deepEqual(await snapshot(p),before,'Rejected editor save changed protected state');checks++;
  }
  // Full project JSON must reject before the legacy importer can detach the quote ID.
  const badProject=E.copy(seed);badProject.building_budget.norm_catalog=[{...n,name:'Más művelet: fúrás',trade:'elokeszites'}];
  const beforeBad=await snapshot(p);await upload(p,'#importJson',badProject);await p.waitForFunction(()=>document.getElementById('toast').textContent.includes('Hibás JSON!'));
  assert.deepEqual(await snapshot(p),beforeBad);checks++;
  const beforeRows=await p.evaluate(()=>JSON.stringify(items)),beforeIds=await p.evaluate(()=>[currentQuoteId,parentQuoteId,quoteContextEpoch]);
  // Valid catalog import and real QuickQuote creation keep old row snapshots intact.
  async function importNorm(value){await upload(p,'#buildingRegistryImport',{format:'szakipiac-resources',registry_version:1,material_catalog:[],norm_catalog:[{...n,norm:value}]});await p.waitForFunction(value=>SzakiPiacBuildingUI.state.norm_catalog.find(n=>n.id==='norma-epulet-alap-1')?.norm===value,value);}
  async function add(){await p.locator('#quickSearch').fill(work.id);await p.locator('#quickItem').selectOption(work.id);await p.locator('#quickQuantity').fill('2');await p.locator('#quickAdd').click();}
  await importNorm(3.5);assert.equal(await p.evaluate(()=>JSON.stringify(items)),beforeRows);assert.deepEqual(await p.evaluate(()=>[currentQuoteId,parentQuoteId,quoteContextEpoch]),beforeIds);checks++;
  await add();const index=await p.evaluate(()=>items.length-1),oldRow=await p.evaluate(i=>JSON.parse(JSON.stringify(items[i])),index);
  assert.equal(oldRow.budget.norm,3.5);assert.equal(await p.evaluate(i=>SzakiPiacBuilding.lineCost(items[i],{rate:7830}).labor,index),54810);checks++;
  await importNorm(1.1);assert.deepEqual(await p.evaluate(i=>JSON.parse(JSON.stringify(items[i])),index),oldRow);
  await add();assert.equal(await p.evaluate(()=>items.at(-1).budget.norm),1.1);assert.deepEqual(await p.evaluate(i=>JSON.parse(JSON.stringify(items[i])),index),oldRow);checks++;
  // Valid editor save also succeeds and changes only subsequent QuickQuote rows.
  await p.locator('#bn-select').selectOption(n.id);await p.locator('#bn-norm').fill('1.2');await p.locator('#bn-norm').press('Tab');await p.locator('#bn-save').click();
  assert.equal(await p.evaluate(()=>SzakiPiacBuildingUI.state.norm_catalog.find(n=>n.id==='norma-epulet-alap-1').norm),1.2);await add();assert.equal(await p.evaluate(()=>items.at(-1).budget.norm),1.2);assert.deepEqual(await p.evaluate(i=>JSON.parse(JSON.stringify(items[i])),index),oldRow);checks++;
  const savedRows=await p.evaluate(()=>JSON.stringify(items));const download=p.waitForEvent('download');await p.locator('#btnExportJson').click();const d=await download,file=path.join(out,'norm-binding-valid-'+width+'.json');await d.saveAs(file);
  await p.locator('#importJson').setInputFiles(file);await p.waitForFunction(()=>currentQuoteId===null);
  assert.equal(await p.evaluate(()=>JSON.stringify(items)),savedRows);assert.equal(await p.evaluate(()=>SzakiPiacBuildingUI.state.norm_catalog.find(n=>n.id==='norma-epulet-alap-1').norm),1.2);checks++;
  // Existing normal mode remains independent of the building norm catalog.
  const normal=await p.evaluate(()=>{const q=payloadNow();delete q.building_budget;delete q.estimate_status;q.items=[{name:'Normál ajánlat teszt',unit:'m²',type:'anyag',qty:2,mat_unit_price:100,lab_unit_price:200,hours:0}];return q;});
  await p.evaluate(q=>applyPayload(q),normal);assert.equal(await p.evaluate(()=>SzakiPiacBuildingUI.state.enabled),false);assert.equal(await p.evaluate(()=>items[0].lab_unit_price),200);assert.equal(await p.evaluate(()=>rowNet(items[0])),600);checks++;
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);assert.deepEqual(apiRequests,[]);assert.deepEqual(localHttpErrors,[]);assert.deepEqual(consoleErrors,[]);
  results.push({width,checks,reportedNormRejected:true,catalogImportAtomic:true,stableNormEditorProtected:true,fullJsonAtomic:true,exactNormAccepted:true,oldSnapshotsPreserved:true,validJsonRoundTrip:true,normalQuotePreserved:true,errors,apiRequests,localHttpErrors,consoleErrors});
  console.log('PASS '+JSON.stringify(results.at(-1)));await ctx.close();
 }fs.writeFileSync(path.join(out,'norm-binding-browser-results.json'),JSON.stringify(results,null,2));}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

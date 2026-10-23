// Exercise the real import callback and catalog form. Golden callback is the
// exact accepted stage-3 implementation, substituted only for negative controls.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const E=require('../epulet-szamitas.js'),C=require('../epulet-teteladatok.js'),{fixture}=require('./resources-fixture.cjs');
const old=require('./fixtures/stage3-before-catalog-fixes.json');
const current=fs.readFileSync('epulet-koltsegvetes.js','utf8'),mock=fs.readFileSync('tests/building-browser.cjs','utf8').match(/const mock=`([\s\S]*?)`;/)[1];
const out=path.resolve(process.env.BUILDING_REPORT_DIR||'work/catalog-fixes');fs.mkdirSync(out,{recursive:true});
function oldSource(kind){
 if(kind==='rollback'){const start=current.indexOf("    $b('buildingRegistryImport').onchange="),end=current.indexOf('\n  function renderCatalog()',start);assert.ok(start>0&&end>start);return current.slice(0,start)+old.original_catalog_handler+'\n  }\n'+current.slice(end);}
 return current.replace(/if\(n\.unit_price!==m\.unit_price\|\|n\.unit!==m\.unit\)\{[\s\S]*?\n        \}/,old.original_price_logic);
}
async function setup(browser,width,negative){
 const ctx=await browser.newContext({viewport:{width,height:1000}}),p=await ctx.newPage();p.__errors=[];p.on('pageerror',e=>p.__errors.push(e.message));p.on('dialog',d=>d.accept());
 await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('@supabase/supabase-js'))return r.fulfill({contentType:'application/javascript',body:mock});if(u.includes('.supabase.co'))return r.abort();if(u.endsWith('/epulet-koltsegvetes.js')&&negative)return r.fulfill({contentType:'application/javascript',body:oldSource(negative)});if(u.includes('paypal.com')||u.includes('googletagmanager.com'))return r.fulfill({body:''});return r.continue();});
 await p.goto('http://127.0.0.1:5588/kalkulator.html');await p.waitForFunction(()=>window.SzakiPiacBuildingUI&&!document.getElementById('btnSave').disabled);return{ctx,p};
}
const snapshot=p=>p.evaluate(()=>{const q=payloadNow();delete q.saved_at;return{q,items:JSON.parse(JSON.stringify(items)),state:JSON.parse(JSON.stringify(SzakiPiacBuildingUI.state)),id:currentQuoteId,parent:parentQuoteId,epoch:quoteContextEpoch,
controls:[...document.querySelectorAll('input,select,textarea')].filter(e=>e.type!=='file').map(e=>({id:e.id,value:e.value,checked:e.checked,disabled:e.disabled})),
editor:document.getElementById('buildingEditor').innerHTML,libraries:document.getElementById('buildingLibraries').innerHTML,summary:document.getElementById('buildingSummary').innerHTML,print:document.getElementById('printArea').innerHTML,quick:document.getElementById('buildingQuick').innerHTML};});
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true}),results=[];try{
 for(const width of [1440,390])for(const negative of [true,false])for(const target of ['buildingLibraries','buildingEditor']){
  const {ctx,p}=await setup(b,width,negative?'rollback':null);const payload=E.tradeSample(C);payload.building_budget.custom_catalog=[{...C.rows[0],id:'sajat-protected',megnevezes:'Megőrzendő saját tétel'}];
  await p.evaluate(q=>{applyPayload(q);currentQuoteId='kept-quote';parentQuoteId='kept-parent';quoteContextEpoch=88;},payload);await p.locator('[data-building-edit="0"]').click();await p.locator('#buildingRegistries').evaluate(e=>e.open=true);await p.locator('#bm-select').selectOption(C.material_catalog[0].id);await p.locator('#bm-source').fill('Félbehagyott mezőérték');
  const before=await snapshot(p);const lib={format:'szakipiac-resources',registry_version:1,material_catalog:E.copy(payload.building_budget.material_catalog),norm_catalog:E.copy(payload.building_budget.norm_catalog)};
  Object.assign(lib.material_catalog[0],{unit_price:321,price_kind:'user',source:'Szintetikus import',updated:'2026-10-22'});Object.assign(lib.norm_catalog[0],{norm:0.8,kind:'user',source:'Szintetikus norma',updated:'2026-10-22'});
  await p.evaluate(id=>{window.__html=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');window.__renderCalls=0;Object.defineProperty(Element.prototype,'innerHTML',{configurable:true,get:window.__html.get,set(value){window.__html.set.call(this,value);if(this.id===id){window.__renderCalls++;throw Error('persistent-catalog-render');}}});},target);
  await p.locator('#buildingRegistryImport').setInputFiles({name:'changed.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(lib))});await p.waitForFunction(()=>document.getElementById('buildingError').textContent.includes('persistent-catalog-render'));
  const calls=await p.evaluate(()=>{Object.defineProperty(Element.prototype,'innerHTML',window.__html);return window.__renderCalls;});assert.equal(calls,1,'Rollback called the failed renderer again');
  const after=await snapshot(p);
  if(negative){assert.equal(after.state.material_catalog[0].unit_price,321);assert.equal(after.state.norm_catalog[0].norm,0.8);assert.notDeepEqual(after,before);}
  else{assert.deepEqual(after,before,'Failed import changed protected editor/quote/catalog state');await p.locator('#bm-save').click();assert.equal(await p.evaluate(()=>SzakiPiacBuildingUI.state.material_catalog[0].source),'Félbehagyott mezőérték','Original restored form handler lost');}
  assert.deepEqual(p.__errors,[]);results.push({width,target,originalBugReproduced:negative,fixedFullStateRollback:!negative,rendererCalls:calls});console.log('PASS '+JSON.stringify(results.at(-1)));await ctx.close();
 }
 for(const width of [1440,390])for(const negative of [true,false]){
  const{ctx,p}=await setup(b,width,negative?'price':null),q=fixture(),m=q.building_budget.material_catalog.find(m=>m.id==='anyag-teszt-0-0');Object.assign(m,{unit_price:100,source:'Korábbi beszállítói árlista',updated:'2024-01-15',price_kind:'verified'});
  await p.evaluate(q=>applyPayload(q),q);const rows=await p.evaluate(()=>JSON.stringify(items));await p.locator('#buildingRegistries').evaluate(e=>e.open=true);await p.locator('#bm-select').selectOption(m.id);await p.locator('#bm-unit_price').fill('321');await p.locator('#bm-save').click();
  let read=await p.evaluate(id=>SzakiPiacBuildingUI.state.material_catalog.find(m=>m.id===id),m.id);assert.equal(read.unit_price,321);assert.equal(read.price_kind,'user');
  if(negative){assert.equal(read.source,m.source);assert.equal(read.updated,m.updated);}else{assert.match(read.source,/Felhasználó/);assert.notEqual(read.updated,m.updated);assert.notEqual(read.source,m.source);}
  assert.equal(await p.evaluate(()=>JSON.stringify(items)),rows,'Old quote snapshot changed');
  if(!negative){await p.locator('#bm-unit_price').fill('400');await p.locator('#bm-source').fill('Új felhasználói árajánlat');await p.locator('#bm-updated').fill('2026-10-20');await p.locator('#bm-save').click();read=await p.evaluate(id=>SzakiPiacBuildingUI.state.material_catalog.find(m=>m.id===id),m.id);assert.equal(read.source,'Új felhasználói árajánlat');assert.equal(read.updated,'2026-10-20');assert.equal(read.price_kind,'user');assert.equal(await p.evaluate(()=>JSON.stringify(items)),rows);}
  assert.deepEqual(p.__errors,[]);results.push({width,priceProvenance:true,originalBugReproduced:negative,fixedProvenance:!negative,quoteSnapshotsUnchanged:true});console.log('PASS '+JSON.stringify(results.at(-1)));await ctx.close();
 }
 fs.writeFileSync(path.join(out,'catalog-fixes-results.json'),JSON.stringify(results,null,2));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

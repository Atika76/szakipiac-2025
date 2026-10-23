// Real import/legacy renderer, synthetic SDK only; no hosted writes.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const fixture=fs.readFileSync('tests/building-browser.cjs','utf8').match(/const mock=`([\s\S]*?)`;/)[1];
const out=path.resolve(process.env.BUILDING_REPORT_DIR||'work/building-browser');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
 try {for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[],blocked=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await context.route('**/*',route=>{const url=route.request().url();if(url.includes('@supabase/supabase-js'))return route.fulfill({contentType:'application/javascript',body:fixture});if(url.includes('.supabase.co')){blocked.push(url);return route.abort();}if(url.includes('paypal.com')||url.includes('googletagmanager.com'))return route.fulfill({body:''});return route.continue();});
  await page.goto('http://127.0.0.1:5588/kalkulator.html');await page.waitForFunction(()=>window.SzakiPiacBuildingUI&&!document.getElementById('btnSave').disabled);
  let checks=0;
  for(const detailed of [true,false]){
   await page.evaluate(detailed=>{
    const p=SzakiPiacBuilding.sample(SzakiPiacBuildingCatalog);if(!detailed){delete p.building_budget;p.items=[{name:'Normál tétel',type:'anyag',unit:'m²',qty:2,mat_unit_price:100,lab_unit_price:200,hours:0}];}
    else {const own={...SzakiPiacBuildingCatalog.rows[0],id:'sajat-import-protection',megnevezes:'Megőrzendő saját tétel'};p.building_budget.custom_catalog=[own];p.items.push(SzakiPiacBuilding.fromCatalog(own));}
    applyPayload(p);document.getElementById('project_name').value='Megőrzendő ajánlat';
    document.getElementById('client_name').value='Megőrzendő ügyfél';document.getElementById('quote_notes').value='Megőrzendő megjegyzés';
    currentQuoteId='existing';parentQuoteId='parent';quoteContextEpoch=17;
    calcAndRender();
    if(detailed)document.querySelector('[data-building-edit]').click();
   },detailed);
   // Include a not-yet-committed editor value and an error message in the protected state.
   if(detailed){await page.locator('#be-qty').fill('-1');await page.locator('#be-qty').press('Tab');}
   const snapshot=()=>page.evaluate(()=>{
    const p=payloadNow();delete p.saved_at;
    return {payload:p,rawItems:JSON.parse(JSON.stringify(items)),id:currentQuoteId,parent:parentQuoteId,epoch:quoteContextEpoch,state:JSON.parse(JSON.stringify(SzakiPiacBuildingUI.state)),
     controls:[...document.querySelectorAll('input,select,textarea')].filter(e=>e.type!=='file').map(e=>({id:e.id,key:e.dataset.k,value:e.value,checked:e.checked,disabled:e.disabled})),
     error:document.getElementById('buildingError').textContent,summary:document.getElementById('buildingSummary').innerHTML,print:document.getElementById('printArea').innerHTML};
   });
   const before=await snapshot();
   const variants=[p=>p.settings.vat_rate={toString:null},p=>p.settings.global_unit={toString:null},p=>p.client.name={toString:null},
    p=>p.project_name={toString:null},p=>p.narrative.notes={toString:null},p=>p.items=[null],p=>p.items[0].name={toString:null},p=>p.items[0].qty={}];
   if(detailed)variants.push(p=>p.items[0].budget.materials={length:1},p=>p.items[0].budget.source={toString:null});
   for(const mutate of variants){
    const p=structuredClone(before.payload);mutate(p);p.project_name=typeof p.project_name==='object'?p.project_name:'NEM SZABAD BETÖLTENI';
    await page.evaluate(()=>{window.__importDone=false;const input=document.getElementById('importJson');input.value='';const old=FileReader.prototype.readAsText;FileReader.prototype.readAsText=function(...args){this.addEventListener('loadend',()=>window.__importDone=true,{once:true});return old.apply(this,args);};});
    await page.locator('#importJson').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
    await page.waitForFunction(()=>window.__importDone);assert.deepEqual(await snapshot(),before);checks++;
   }
   // Cloud load uses the same transaction: a corrupt row must not attach its id.
   await page.evaluate(()=>{window.__quotes.set('broken',{payload:{project_name:'BROKEN',settings:{vat_rate:{toString:null}}},parent_quote_id:'wrong'});return loadOne('broken');});
   assert.deepEqual(await snapshot(),before);checks++;
   // These renderers keep failing on EVERY call, after making real DOM changes.
   // Recovery must not call them again and must preserve the original node listeners.
   for(const stage of ['renderItems','calcAndRender','settingsForms']){
    const attempts=await page.evaluate(stage=>{
     let calls=0;const message='persistent render failure: '+stage;
     const p=SzakiPiacBuilding.sample(SzakiPiacBuildingCatalog);p.project_name='MUST NEVER REMAIN';p.building_budget.settings.rate=999;p.building_budget.geometry.length=15;
     if(SzakiPiacBuildingUI.state.enabled&&stage==='calcAndRender')delete p.building_budget;
     let restore;
     if(stage==='settingsForms'){
      const box=document.getElementById('buildingSettings'),descriptor=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
      Object.defineProperty(box,'innerHTML',{configurable:true,get(){return descriptor.get.call(this);},set(value){descriptor.set.call(this,value);calls++;throw Error(message);}});
      restore=()=>delete box.innerHTML;
     }else{
      const original=window[stage];window[stage]=function(...args){original.apply(this,args);calls++;throw Error(message);};restore=()=>window[stage]=original;
     }
     try{applyPayload(p);throw Error('Expected persistent failure');}catch(e){if(e.message!==message)throw e;}finally{restore();}
     return calls;
    },stage);
    assert.deepEqual(await snapshot(),before,'State changed after persistent '+stage);assert.equal(attempts,1,'Recovery called the failed renderer again');checks++;
   }
   // Keep the original one-off failure case too.
   await page.evaluate(()=>{const original=window.renderItems;let once=true;window.renderItems=function(){if(once){once=false;throw Error('injected legacy rendering failure');}return original();};
    const p=SzakiPiacBuilding.sample(SzakiPiacBuildingCatalog);p.project_name='MUST ROLL BACK';
    try{applyPayload(p);throw Error('Expected failure');}catch(e){if(e.message!=='injected legacy rendering failure')throw e;}finally{window.renderItems=original;}
   });assert.deepEqual(await snapshot(),before);checks++;
   // The actual FileReader import must fail atomically while the renderer stays broken.
   await page.evaluate(()=>{
    window.__importDone=false;window.__persistentCalls=0;document.getElementById('importJson').value='';
    window.__restoreImportRenderer=window.renderItems;
    window.renderItems=function(...args){window.__restoreImportRenderer.apply(this,args);window.__persistentCalls++;throw Error('persistent file import renderer');};
   });
   try {
    const incoming=structuredClone(before.payload);incoming.project_name='MUST NOT IMPORT';
    await page.locator('#importJson').setInputFiles({name:'persistent-failure.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(incoming))});
    await page.waitForFunction(()=>window.__importDone);assert.deepEqual(await snapshot(),before);
    assert.equal(await page.evaluate(()=>window.__persistentCalls),1);checks++;
   } finally {await page.evaluate(()=>{window.renderItems=window.__restoreImportRenderer;delete window.__restoreImportRenderer;});}
   // Restored inputs keep their real event handlers, including row-bound closures.
   if(detailed){await page.locator('#be-name').fill('Helyreállított szerkesztő');await page.locator('#be-name').press('Tab');}
   else await page.locator('#itemsBody [data-k="name"]').first().fill('Helyreállított szerkesztő');
   assert.equal(await page.evaluate(()=>items[0].name),'Helyreállított szerkesztő');checks++;
   // A valid import still commits and detaches from the saved version exactly once.
   await page.locator('#importJson').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(before.payload))});
   await page.waitForFunction(()=>currentQuoteId===null);assert.equal(await page.evaluate(()=>parentQuoteId),null);assert.equal(await page.evaluate(()=>quoteContextEpoch),18);checks++;
   assert.deepEqual(await page.evaluate(()=>{const p=payloadNow();delete p.saved_at;return p;}),before.payload);
   assert.equal(await page.evaluate(()=>SzakiPiacBuildingUI.state.enabled),detailed);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
  results.push({width,checks,persistentRendererFailures:['renderItems','calcAndRender','settingsForms'],normalAndDetailedImports:true,restoredEventHandlers:true,pageErrors:errors,blockedProductionCalls:blocked});console.log('PASS import full-state protection '+JSON.stringify(results.at(-1)));await context.close();
 }fs.writeFileSync(path.join(out,'import-protection.json'),JSON.stringify(results,null,2));}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

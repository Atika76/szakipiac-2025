// Actual PRO+ UI, local HTTP only, synthetic Auth/database responses. Hosted writes blocked.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.env.BUILDING_REPORT_DIR||'work/building-browser');fs.mkdirSync(out,{recursive:true});
const mock=`(()=>{const session={user:{id:'11111111-1111-4111-8111-111111111111',email:'atika.76@windowslive.com'}};window.__quotes=new Map();window.__shareCalls=0;window.__onlineWrites=0;
window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session}}),signOut:async()=>({})},from(table){let id=null,op='select',row=null;const b={};for(const m of ['select','order','limit','not','is'])b[m]=()=>b;b.eq=(k,v)=>{if(k==='id')id=v;return b};b.insert=r=>{op='insert';row=r[0];return b};b.update=r=>{op='update';row=r;return b};b.delete=()=>{op='delete';return b};
const result=()=>{if(table==='ajanlatok'){if(op==='insert'){id='22222222-2222-4222-8222-'+String(window.__quotes.size+1).padStart(12,'0');const next={...row,id,quote_status:'draft',created_at:'2026-10-21'};window.__quotes.set(id,next);return {data:next,error:null}}if(op==='update'){const next={...window.__quotes.get(id),...row};window.__quotes.set(id,next);return {data:next,error:null}}return {data:id?window.__quotes.get(id):[...window.__quotes.values()],error:null}}return {data:table==='epitoipari_arak'?[]:null,error:null}};b.single=b.maybeSingle=async()=>result();b.then=(ok,fail)=>Promise.resolve(result()).then(ok,fail);return b},rpc:async()=>({data:null,error:null}),functions:{invoke:async()=>{window.__shareCalls++;return {data:{token:'synthetic',url:'https://example.test'}}}}})};})();`;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true});const page=await context.newPage();const errors=[],networkErrors=[],blocked=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')networkErrors.push(m.text())});page.on('dialog',d=>d.accept());
 await context.route('**/*',route=>{const url=route.request().url();if(url.includes('@supabase/supabase-js'))return route.fulfill({contentType:'application/javascript',body:mock});if(url.includes('.supabase.co')){blocked.push(url);return route.abort();}if(url.includes('paypal.com')||url.includes('googletagmanager.com'))return route.fulfill({body:''});return route.continue();});
 await page.goto('http://127.0.0.1:5588/szakipiac-2025/kalkulator.html');await page.waitForFunction(()=>window.SzakiPiacBuildingUI&&document.getElementById('btnSave').disabled===false);
 await page.locator('#buildingEnable').click();await page.locator('#buildingSample').click();
 assert.equal(await page.evaluate(()=>items.length),25);assert.equal(await page.locator('#buildingPhases > div').count(),22);assert.match(await page.locator('#buildingSummary').innerText(),/HIÁNYOS TERVEZET/);
 assert.equal(await page.evaluate(()=>SzakiPiacBuildingUI.budgetTotal().complete),false);
 // Download the actual existing JSON export, including all added state.
 let promise=page.waitForEvent('download');await page.locator('#btnExportJson').click();let download=await promise;const jsonFile=path.join(out,'house-'+width+'.json');await download.saveAs(jsonFile);
 const snapshot=JSON.parse(fs.readFileSync(jsonFile,'utf8'));assert.equal(snapshot.building_budget.schema_version,1);assert.equal(snapshot.items.length,25);
 // The real html2pdf button must include detailed items, missing-data warning and material needs.
 await page.evaluate(()=>document.fonts.ready);const printText=await page.locator('#printArea').innerText();
 for(const phrase of ['HIÁNYOS TERVEZET','Anyagszükséglet','Sávalap betonozása','MEGADANDÓ','Norma:'])assert.ok(printText.includes(phrase),phrase);
 fs.writeFileSync(path.join(out,'print-'+width+'.txt'),printText);fs.writeFileSync(path.join(out,'print-'+width+'.html'),await page.locator('#printArea').evaluate(e=>e.outerHTML));
 promise=page.waitForEvent('download',{timeout:120000});await page.locator('#btnPdfPro').click();download=await promise;await download.saveAs(path.join(out,'house-'+width+'.pdf'));
 assert.equal(fs.readFileSync(path.join(out,'house-'+width+'.pdf')).subarray(0,5).toString(),'%PDF-');
 // Geometric recalculation is idempotent and changes the physical amounts.
 await page.locator('#buildingGeometry').locator('..').evaluate(e=>e.open=true);
 await page.locator('#bg-blocks_per_m2').fill('16');await page.locator('#buildingCalculate').click();assert.equal(await page.evaluate(()=>items.find(i=>i.budget.calc_key==='wall').budget.materials[0].qty),1667);
 await page.locator('#buildingCalculate').click();assert.equal(await page.evaluate(()=>items.length),25);
 // Search by accentless text and by phase.
 await page.locator('#buildingSearch').fill('hoszivattyu');assert.equal(await page.locator('[data-building-add]').count(),1);await page.locator('#buildingSearch').fill('');await page.locator('#buildingTrade').selectOption('alap');assert.ok(await page.locator('[data-building-add]').count()>=5);await page.locator('#buildingTrade').selectOption('');
 await page.locator('#buildingCustomName').locator('..').locator('..').locator('..').evaluate(e=>e.open=true);
 await page.locator('#buildingCustomName').fill('Szintetikus saját szerelés');await page.locator('#buildingCustom').click();
 async function fill(id,value){await page.locator(id).fill(value);await page.locator(id).press('Tab');}
 await fill('#be-qty','10');await fill('#be-mat','100');await fill('#be-norm','0.5');await fill('#be-rate','2000');await fill('#be-machine','20');await fill('#be-transport','30');await fill('#be-extra','10');
 assert.equal(await page.evaluate(()=>SzakiPiacBuildingUI.budgetTotal().net),11600);assert.equal(await page.evaluate(()=>SzakiPiacBuildingUI.budgetTotal().gross),14732);
 assert.equal(await page.evaluate(()=>SzakiPiacBuildingUI.state.custom_catalog.length),1);
 await fill('#be-qty','-1');assert.equal(await page.locator('#buildingError').isVisible(),true);await page.locator('#btnSave').click();assert.equal(await page.evaluate(()=>window.__quotes.size),0);await fill('#be-qty','10');assert.equal(await page.locator('#buildingError').isVisible(),false);
 // Cloud serialization and rehydration, without any live request.
 await page.locator('#btnSave').click();await page.waitForFunction(()=>window.__quotes.size===1&&currentQuoteId!==null);
 const stored=await page.evaluate(()=>[...window.__quotes.values()][0]);assert.equal(stored.payload.items.length,26);assert.equal(stored.total_gross,14732);assert.equal(stored.payload.building_budget.custom_catalog.length,1);assert.equal(await page.locator('[data-share]').first().isDisabled(),true);
 assert.equal(stored.subtotal_net+stored.overhead_net-stored.discount_net+stored.profit_net,stored.payload.totals.netTotal);
 await page.locator('[data-load]').first().click();await page.waitForFunction(()=>SzakiPiacBuildingUI.state.custom_catalog.length===1);
 // A malformed import must not detach the current quote or change its data.
 const before=await page.evaluate(()=>({id:currentQuoteId,payload:payloadNow()}));
 const invalid={...before.payload,building_budget:{...before.payload.building_budget,schema_version:99}};
 await page.locator('#importJson').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>currentQuoteId),before.id);assert.deepEqual(await page.evaluate(()=>payloadNow().items),before.payload.items);
 await page.locator('#importJson').setInputFiles(jsonFile);await page.waitForFunction(()=>items.length===25);assert.equal(await page.evaluate(()=>currentQuoteId),null);
 await page.evaluate(id=>shareQuoteWithClient(id,30),stored.id);assert.equal(await page.evaluate(()=>window.__shareCalls),0);
 promise=page.waitForEvent('download');await page.locator('#buildingCsv').click();download=await promise;await download.saveAs(path.join(out,'house-'+width+'.csv'));
 const csv=fs.readFileSync(path.join(out,'house-'+width+'.csv'),'utf8');assert.equal(csv.charCodeAt(0),0xfeff);assert.ok(csv.includes('MEGADANDÓ'));
 // Imported user text is displayed literally; it cannot create executable elements.
 await page.evaluate(()=>{const p=payloadNow();p.items[0].name='<img src=x onerror="window.__xss=1">';applyPayload(p)});assert.equal(await page.locator('#buildingRows img').count(),0);assert.equal(await page.evaluate(()=>window.__xss),undefined);
 await page.locator('#importJson').setInputFiles(jsonFile);await page.waitForFunction(()=>items[0].name.startsWith('Sávalap'));
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);
 await page.locator('#buildingPanel').screenshot({path:path.join(out,'ui-'+width+'.png')});
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 results.push({width,items:25,trades:22,custom_roundtrip:true,json_import:true,cloud_mock:true,incomplete_share_blocked:true,overflow,errors,consoleErrors:networkErrors,blockedProductionCalls:blocked,pdfBytes:fs.statSync(path.join(out,'house-'+width+'.pdf')).size});
 console.log(JSON.stringify(results.at(-1)));await context.close();
}fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(results,null,2));}
finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});

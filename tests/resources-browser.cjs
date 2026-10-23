// Real desktop/mobile UI and file paths; synthetic SDK, hosted requests blocked.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {fixture}=require('./resources-fixture.cjs'),E=require('../epulet-szamitas.js');
const mock=fs.readFileSync('tests/building-browser.cjs','utf8').match(/const mock=`([\s\S]*?)`;/)[1];
const out=path.resolve(process.env.BUILDING_REPORT_DIR||'work/resources-browser');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true}),p=await context.newPage(),errors=[],blocked=[],consoleErrors=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});p.on('dialog',d=>d.accept());
 await context.route('**/*',r=>{const u=r.request().url();if(u.includes('@supabase/supabase-js'))return r.fulfill({contentType:'application/javascript',body:mock});if(u.includes('.supabase.co')){blocked.push(u);return r.abort();}if(u.includes('paypal.com')||u.includes('googletagmanager.com'))return r.fulfill({body:''});return r.continue();});
 await p.goto('http://127.0.0.1:5588/kalkulator.html');await p.waitForFunction(()=>window.SzakiPiacBuildingUI&&!document.getElementById('btnSave').disabled);
 await p.locator('#buildingEnable').click();await p.locator('#buildingTradeSample').click();assert.equal(await p.evaluate(()=>items.length),29);assert.match(await p.locator('#buildingSummary').innerText(),/HIÁNYOS/);
 await p.evaluate(x=>applyPayload(x),fixture());const before=await p.evaluate(()=>JSON.stringify(items));
 await p.locator('#buildingRegistries').evaluate(e=>e.open=true);await p.locator('#bm-select').selectOption('anyag-teszt-0-0');await p.locator('#bm-unit_price').fill('900');await p.locator('#bm-save').click();
 assert.equal(await p.evaluate(()=>JSON.stringify(items)),before);assert.equal(await p.evaluate(()=>SzakiPiacBuildingUI.state.material_catalog.find(m=>m.id==='anyag-teszt-0-0').unit_price),900);
 // Explicitly applying a changed material snapshot is required.
 await p.locator('[data-building-edit="0"]').click();await p.locator('#bc-0-catalog').selectOption('anyag-teszt-0-0');await p.locator('#bc-0-apply').click();assert.equal(await p.locator('#bc-0-unit_price').inputValue(),'900');assert.equal(await p.evaluate(()=>items[1].budget.components[0].unit_price),100);
 await p.locator('#bn-select').selectOption('norma-teszt-0');await p.locator('#bn-norm').fill('0.75');await p.locator('#bn-save').click();assert.equal(await p.locator('#be-norm').inputValue(),'0.5');
 await p.locator('#be-norm-catalog').selectOption('norma-teszt-0');await p.locator('#be-norm-apply').click();assert.equal(await p.locator('#be-norm').inputValue(),'0.75');
 // Inherited rate precedence can be changed through actual controls.
 await p.locator('#buildingSettings').locator('..').evaluate(e=>e.open=true);
 const fill=async(id,v)=>{await p.locator(id).fill(String(v));await p.locator(id).press('Tab');};
 await fill('#bt-aljzat',2500);assert.equal(await p.evaluate(()=>SzakiPiacBuildingUI.budgetTotal().lines[0].rate),2500);await fill('#be-rate',0);assert.equal(await p.evaluate(()=>SzakiPiacBuildingUI.budgetTotal().lines[0].rate),0);await fill('#be-rate','');
 assert.equal(await p.locator('#bb-overhead_percent').isDisabled(),true);
 // Create independent reusable material and norm, including null/zero and XSS-safe text.
 await p.locator('#bm-select').selectOption('');await p.locator('#bm-name').fill('<img src=x onerror="window.__xss=1"> teszt');await p.locator('#bm-unit_price').fill('0');await p.locator('#bm-per_unit').fill('2');await p.locator('#bm-source').fill('Saját teszt');await p.locator('#bm-updated').fill('2026-10-22');await p.locator('#bm-save').click();assert.equal(await p.locator('#buildingLibraries img').count(),0);assert.equal(await p.evaluate(()=>window.__xss),undefined);
 await p.locator('#bn-select').selectOption('');await p.locator('#bn-name').fill('Saját új norma');await p.locator('#bn-norm').fill('0');await p.locator('#bn-kind').selectOption('user');await p.locator('#bn-save').click();
 // Invalid input must remain a handled form error, never an uncaught console error.
 await p.locator('#bn-norm').fill('-1');await p.locator('#bn-norm').press('Tab');assert.match(await p.locator('#buildingError').innerText(),/közötti szám/);await p.locator('#bn-norm').fill('0');await p.locator('#bn-norm').press('Tab');
 const saved=await p.evaluate(()=>{const p=payloadNow();delete p.saved_at;return p;});
 // Separate catalog file export/import; quote prices and identities do not change.
 let wait=p.waitForEvent('download');await p.locator('#buildingRegistryExport').click();let d=await wait;const libFile=path.join(out,'katalogus-'+width+'.json');await d.saveAs(libFile);
 const lib=JSON.parse(fs.readFileSync(libFile));assert.equal(lib.format,'szakipiac-resources');
 await p.locator('#buildingRegistryImport').setInputFiles(libFile);await p.waitForFunction(()=>document.getElementById('buildingRegistryImport').value==='');assert.deepEqual(await p.evaluate(()=>payloadNow().items),saved.items);
 // A delayed read must never write its catalog into a subsequently opened quote.
 await p.evaluate(()=>{window.__fileText=File.prototype.text;File.prototype.text=function(){if(this.name==='delayed-catalog.json')return new Promise(resolve=>window.__resolveCatalog=resolve);return window.__fileText.call(this);};});
 await p.locator('#buildingRegistryImport').setInputFiles({name:'delayed-catalog.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(lib))});
 await p.waitForFunction(()=>!!window.__resolveCatalog);await p.evaluate(q=>{q.project_name='Másik ajánlat a fájlolvasás alatt';applyPayload(q);},structuredClone(saved));
 const switched=await p.evaluate(()=>{const q=payloadNow();delete q.saved_at;return q;});await p.evaluate(text=>window.__resolveCatalog(text),JSON.stringify(lib));await p.waitForFunction(()=>document.getElementById('buildingError').textContent.includes('időközben'));
 assert.deepEqual(await p.evaluate(()=>{const q=payloadNow();delete q.saved_at;return q;}),switched);await p.evaluate(q=>{File.prototype.text=window.__fileText;applyPayload(q);},saved);await p.locator('#buildingRegistries').evaluate(e=>e.open=true);
 const badLib=structuredClone(lib);badLib.norm_catalog[0].norm={};await p.locator('#buildingRegistryImport').setInputFiles({name:'bad-catalog.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(badLib))});await p.waitForFunction(()=>document.getElementById('buildingError').textContent.includes('normaidő'));assert.deepEqual(await p.evaluate(()=>payloadNow().building_budget),saved.building_budget);
 await p.evaluate(()=>document.getElementById('buildingError').textContent='');
 wait=p.waitForEvent('download');await p.locator('#btnExportJson').click();d=await wait;const json=path.join(out,'resources-'+width+'.json');await d.saveAs(json);const exported=JSON.parse(fs.readFileSync(json));assert.deepEqual(exported.building_budget,saved.building_budget);
 await p.locator('#btnSave').click();await p.waitForFunction(()=>window.__quotes.size===1&&currentQuoteId);const stored=await p.evaluate(()=>[...window.__quotes.values()][0]);assert.deepEqual(stored.payload.building_budget,exported.building_budget);assert.equal(stored.total_gross,E.calculate(exported.items,exported.building_budget.settings).gross);
 await p.locator('[data-load]').first().click();assert.deepEqual(await p.evaluate(()=>payloadNow().building_budget),exported.building_budget);
 const protectedSnapshot=()=>p.evaluate(()=>{const q=payloadNow();delete q.saved_at;return{q,id:currentQuoteId,epoch:quoteContextEpoch};});const protectedBefore=await protectedSnapshot();
 await p.evaluate(()=>{window.__readDone=false;const old=FileReader.prototype.readAsText;FileReader.prototype.readAsText=function(...a){this.addEventListener('loadend',()=>window.__readDone=true,{once:true});return old.apply(this,a);};window.__oldRender=renderItems;window.renderItems=function(){window.__oldRender();throw Error('persistent resources rendering');};});
 await p.locator('#importJson').setInputFiles(json);await p.waitForFunction(()=>window.__readDone);await p.evaluate(()=>window.renderItems=window.__oldRender);assert.deepEqual(await protectedSnapshot(),protectedBefore);
 const invalid=structuredClone(exported);invalid.building_budget.material_catalog[0].unit_price={};await p.evaluate(()=>window.__readDone=false);await p.locator('#importJson').setInputFiles({name:'bad-material.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});await p.waitForFunction(()=>window.__readDone);assert.deepEqual(await protectedSnapshot(),protectedBefore);
 await p.locator('#importJson').setInputFiles(json);await p.waitForFunction(()=>currentQuoteId===null);assert.deepEqual(await p.evaluate(()=>payloadNow().building_budget),exported.building_budget);
 wait=p.waitForEvent('download');await p.locator('#buildingCsv').click();d=await wait;await d.saveAs(path.join(out,'resources-'+width+'.csv'));const csv=fs.readFileSync(path.join(out,'resources-'+width+'.csv'),'utf8');for(const word of ['Tesztgyártó','Újrahasználható normakatalógus','Számított munkaóra'])assert.ok(csv.includes(word));
 const text=await p.locator('#printArea').innerText();for(const word of ['Munkaóra:','2500','norma-teszt-0','Tesztgyártó','anyag-teszt-0-0'])assert.ok(text.replaceAll('\u00a0','').includes(word),word);fs.writeFileSync(path.join(out,'resources-print-'+width+'.txt'),text);
 await p.locator('[data-building-edit="0"]').click();await p.locator('#buildingEditor').screenshot({path:path.join(out,'resources-editor-'+width+'.png')});
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);assert.deepEqual(consoleErrors,[]);
 results.push({width,catalogSnapshotIsolation:true,ratePrecedence:true,separateCatalogTransfer:true,jsonAndCloudMockRoundtrip:true,persistentImportRollback:true,pdfSourceContent:true,overflow:false,errors,blocked,consoleErrors});console.log('PASS '+JSON.stringify(results.at(-1)));await context.close();
 }fs.writeFileSync(path.join(out,'resources-browser-results.json'),JSON.stringify(results,null,2));}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

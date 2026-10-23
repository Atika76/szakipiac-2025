const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),{fixture}=require('./resources-fixture.cjs');
const out=path.resolve(process.env.BUILDING_REPORT_DIR||'work/resources-export');fs.mkdirSync(out,{recursive:true});
const mock=fs.readFileSync('tests/building-browser.cjs','utf8').match(/const mock=`([\s\S]*?)`;/)[1];
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{for(const width of [1440,390]){
 const ctx=await b.newContext({viewport:{width,height:1000},acceptDownloads:true}),p=await ctx.newPage();p.on('dialog',d=>d.accept());
 await ctx.route('**/*',r=>{const u=r.request().url();if(u.includes('@supabase/supabase-js'))return r.fulfill({contentType:'application/javascript',body:mock});if(u.includes('.supabase.co'))return r.abort();if(u.includes('paypal.com')||u.includes('googletagmanager.com'))return r.fulfill({body:''});return r.continue();});
 await p.goto('http://127.0.0.1:5588/kalkulator.html');await p.waitForFunction(()=>window.SzakiPiacBuildingUI&&!document.getElementById('btnSave').disabled);
 for(const kind of ['haz120-harmadik','szintetikus-harmadik']){
  if(kind.startsWith('haz'))await p.evaluate(()=>applyPayload(SzakiPiacBuilding.tradeSample(SzakiPiacBuildingCatalog)));else await p.evaluate(q=>applyPayload(q),fixture());
  for(const [ext,button] of [['json','#btnExportJson'],['csv','#buildingCsv'],['pdf','#btnPdfPro']]){const wait=p.waitForEvent('download',{timeout:120000});await p.locator(button).click();const d=await wait;await d.saveAs(path.join(out,kind+'-'+width+'.'+ext));}
  const text=await p.locator('#printArea').innerText();for(const v of ['Munkaóra:','óra/m²','Anyagösszetevők','rendelendő'])assert.ok(text.toLowerCase().includes(v.toLowerCase()),v);if(kind.startsWith('haz'))assert.ok(text.includes('HIÁNYOS'));else{assert.ok(text.includes('Tesztgyártó'));assert.ok(text.includes('norma-teszt-0'));}
  fs.writeFileSync(path.join(out,kind+'-print-'+width+'.txt'),text);fs.writeFileSync(path.join(out,kind+'-print-'+width+'.html'),await p.locator('#printArea').evaluate(e=>e.outerHTML));console.log('PASS exported '+kind+' '+width);
 }await ctx.close();
 }}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

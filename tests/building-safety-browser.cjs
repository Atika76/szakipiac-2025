const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('tests/building-browser.cjs','utf8');const fixture=source.match(/const mock=`([\s\S]*?)`;\n/)[1];
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const kind of ['guest','free','legacy']){
  const context=await browser.newContext();const page=await context.newPage();let mock=fixture;
  if(kind==='guest')mock=mock.replace('data:{session}','data:{session:null}');
  if(kind==='free')mock=mock.replace('atika.76@windowslive.com','synthetic-free@example.test');
  await context.route('**/*',route=>{const url=route.request().url();if(url.includes('@supabase/supabase-js'))return route.fulfill({contentType:'application/javascript',body:mock});if(url.includes('.supabase.co'))return route.abort();return route.continue();});
  await page.goto('http://127.0.0.1:5588/kalkulator.html');await page.waitForFunction(()=>window.SzakiPiacBuildingUI&&window.__session);
  if(kind==='guest'){await page.waitForFunction(()=>document.querySelector('#buildingEnable').disabled);assert.equal(await page.locator('#btnSave').isDisabled(),true);}
  if(kind==='free'){await page.waitForFunction(()=>document.querySelector('#btnSave').disabled);await page.locator('#buildingEnable').click();assert.equal(await page.locator('#btnPdfPro').isDisabled(),true);assert.equal(await page.locator('#btnSave').isDisabled(),true);}
  if(kind==='legacy'){await page.locator('#buildingEnable').click();await page.evaluate(()=>applyPayload({project_name:'Régi ajánlat',currency:'HUF',items:[{name:'Korábbi tétel',type:'anyag',qty:2,unit:'m²',mat_unit_price:100,lab_unit_price:200,hours:0}],settings:{material_margin:0,overhead_rate:0,profit_percent:0,discount_net:0,vat_enabled:true,vat_rate:27}}));assert.equal(await page.evaluate(()=>SzakiPiacBuildingUI.state.enabled),false);assert.equal(await page.locator('#btnGenerateQuoteText').isDisabled(),false);assert.equal(await page.evaluate(()=>totals().grossTotal),762);assert.equal(await page.locator('#itemsBody').isVisible(),true);}
  console.log('PASS browser safety: '+kind);await context.close();
 }
 const context=await browser.newContext();const page=await context.newPage();const remote=[];
 page.on('request',r=>{if(r.url().includes('.supabase.co'))remote.push(r.url());});
 const response=await page.goto('http://127.0.0.1:5590/kalkulator.html');assert.equal(response.headers()['content-security-policy'],"connect-src 'self'");
 await page.waitForFunction(()=>window.SzakiPiacBuildingUI&&window.__quotes);assert.ok((await page.locator('body').innerText()).includes('HELYI TESZTMÓD'));
 await page.locator('#buildingEnable').click();await page.locator('#buildingSample').click();await page.locator('#btnSave').click();await page.waitForFunction(()=>window.__quotes.size===1);assert.deepEqual(remote,[]);console.log('PASS safe local preview: synthetic save; no production API requests');await context.close();
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});

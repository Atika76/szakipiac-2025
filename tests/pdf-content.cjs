// Actual html2pdf download, synthetic data; no hosted writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const source=fs.readFileSync(path.join(__dirname,'browser-smoke.cjs'),'utf8');
const mock=Function('return '+source.match(/const mock=(`[^]*?`);/)[1])();
const out=path.resolve(process.env.PDF_REPORT_DIR||'work/pdf-validation');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true});const page=await context.newPage();const errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>{if(!r.url().includes('favicon'))network.push(r.url())});
 await context.route('**/*',route=>{
  const url=route.request().url();if(url.includes('@supabase/supabase-js'))return route.fulfill({contentType:'application/javascript',body:mock});
  if(url.includes('.supabase.co'))return route.fulfill({status:500,body:'Production API blocked by test'});
  if(url.includes('paypal.com')||url.includes('googletagmanager.com'))return route.fulfill({body:''});return route.continue();
 });
 await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:5588/szakipiac-2025')+'/kalkulator.html');
 await page.waitForFunction(()=>typeof html2pdf==='function'&&typeof calcAndRender==='function');
 await page.evaluate(()=>document.fonts.ready);
 for(const count of [1,35]){
  await page.evaluate(count=>{
   document.getElementById('project_name').value='PDF próba – Őrmező, árvíztűrő tükörfúrógép';
   document.getElementById('client_name').value='Szintetikus Megrendelő';
   document.getElementById('material_margin').value=0;document.getElementById('overhead_rate').value=0;document.getElementById('profit_percent').value=0;document.getElementById('discount_net').value=0;
   document.getElementById('vat_enabled').checked=true;document.getElementById('vat_rate').value='27';
   document.getElementById('quote_notes').value='VÉGE: Teljes ajánlat, minden tétellel és végösszeggel.';
   items=Array.from({length:count},(_,i)=>({name:`Tétel ${String(i+1).padStart(2,'0')} – ${i%3===0?'Hosszú megnevezés, előkészítés és szakszerű kivitelezés, ellenőrzött anyagokkal és részletes műszaki tartalommal':'Burkolás őűáéíöü'}`,type:'munka',qty:2,unit:'m²',mat_unit_price:1000,lab_unit_price:2000,hours:0,selected:false}));renderItems();calcAndRender();
  },count);
  const summary=await page.evaluate(()=>({project:document.getElementById('print_project').textContent,net:document.getElementById('p_sum_net_total').textContent,gross:document.getElementById('p_sum_gross_total').textContent,rows:document.querySelectorAll('#print_items tr').length,tableWidth:document.querySelector('#print_items').getBoundingClientRect().width,rootWidth:document.getElementById('printArea').getBoundingClientRect().width}));
  assert.equal(summary.rows,count);assert.equal(summary.net.replace(/\D/g,''),String(count*6000));assert.equal(summary.gross.replace(/\D/g,''),String(count*7620));
  const download=page.waitForEvent('download',{timeout:60000});await page.locator('#btnPdfPro').click();const pdf=await download;
  const file=path.join(out,`quote-${width}-${count}.pdf`);await pdf.saveAs(file);assert.equal(fs.readFileSync(file).subarray(0,5).toString(),'%PDF-');
  await page.screenshot({path:path.join(out,`screen-${width}-${count}.png`),fullPage:true});
  results.push({width,count,...summary,pdf:path.basename(file),bytes:fs.statSync(file).size,errors:[...errors],networkFailures:[...network]});assert.deepEqual(errors,[]);console.log(JSON.stringify(results.at(-1)));
 }
 await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:5588/szakipiac-2025')+'/kivitelezes-pro.html');
 await page.waitForFunction(()=>typeof html2pdf==='function'&&document.querySelector('#linkedQuoteId').options.length===2);
 await page.locator('#projectName').fill('Kivitelezés PDF próba – Őrmező');
 assert.equal((await page.locator('#sumGross').innerText()).replace(/\D/g,''),'3246628');
 await page.locator('#photoInput').setInputFiles({name:'synthetic-photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAPAAAAB4CAIAAABD1OhwAAAD10lEQVR4nO3ZX2iNcRzH8e9zds6ZcXY2sy2R/MnfYnI1KbELipBSSq4k3Ajl2r+aKxcSoliuhBKy/M0FIxkLMWmIkT+bYbadOc4/j+bR1M5w2hny6f26Oud5fr/zPJ299+t3znFK9jcZoML3r28A6E8EDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSkEDSn+bCbPH527espAMysfGqxtiptZVX10b0X4dkvCG3ChMbbv3qey4sCm8pDfZynX1l9un1riT59V/fSzmb1YWXq7JeG6FvA5m6533GlJPFlROvbQ2+4rdj9dNiFv5eS8RMoCOXbgfvTYo2ivNxMKOD2GZf2OQTfos89iZ5/FvM4Wn271Du6cFe5+7Nk1O7z83MfXnakFY3K3Tg+tutSWPssT/2LekUlF/l2zw3NPfOj1uhUjgssn5i2pbm2LuwVB5/C8wW86U+k3UzEiuGZKqMewmlddrUPV39hyFOf5cr/941xojFU9yGiNfPghOTI/52dn104dtPVGR1vcNbO2uLvtRse6aYP6PAxKslqhM7T9ZqR6UdGlF7Hjjz9fe53RAjlzeLD+ffJnZ8cV+u+/+3H23rvk+EJ/n4dBSf//gYM+O7VosPe4sjZS15w42hA93xibNyq3ckb+mcbYjrrIr+c6Zu1xd8OV9h6v5j1N5zjWtQj/TobD8F/r/6C798GeIQN8YwpybjUnjjRELz6P1Swd8ouge8xNP/JkRamZPfqYLCv232r+/tGzrNjf0NrLcp7hMCj543to1+zgnMLhoa4NcdEA38tIKvvX3HO3c8v0/HDQMbOCoLO5PH/33c4+D4OSP7vlqGtOVNZGNta0V80piCbdL9++tsv+EpdfxoeFoicXFsVTbiDHDtZHr/b23UWGw6DEKdnf9K/vAeg3/FIIKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNU/IVcmBBGZQu26EAAAAASUVORK5CYII=','base64')});
 await page.waitForFunction(()=>state.photos.length===1);
 const kivDownload=page.waitForEvent('download',{timeout:60000});await page.locator('#btnPdf').click();
 const kivPdf=await kivDownload;const kivFile=path.join(out,`planning-${width}.pdf`);await kivPdf.saveAs(kivFile);
 results.push({width,scope:'optional planning PDF',pdf:path.basename(kivFile),bytes:fs.statSync(kivFile).size,errors:[...errors],networkFailures:[...network]});
 assert.deepEqual(errors,[]);console.log(JSON.stringify(results.at(-1)));
 await Promise.race([context.close(),new Promise(r=>setTimeout(r,5000))]);
}fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}finally{await Promise.race([browser.close(),new Promise(r=>setTimeout(r,5000))])}
})().then(()=>{console.log('PDF content scenarios and browser cleanup completed.');process.exit(0);}).catch(e=>{console.error(e);process.exit(1);});

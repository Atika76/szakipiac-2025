const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../epulet-teteladatok'),S=require('../epulet-forrasolt-adatok'),E=require('../epulet-szamitas'),Q=require('../epulet-gyorsajanlat-mag'),D=require('../epulet-adatfeltoltes');
const opts={...E.defaults(),rate:7830,rate_includes_overhead:true};
const draft=(id,qty=10,ms=S.material_catalog)=>Q.draftRow(S.work_variants.find(r=>r.id===id),{mode:'direct',quantity:qty},E,C,ms,S.norm_catalog);
const rewrite=(text,id,edit)=>{
 const lines=text.replace(/^\uFEFF/,'').trimEnd().split('\r\n');
 const index=lines.findIndex(l=>l.startsWith('"'+id+'";'));assert.ok(index>0);
 const row=lines[index].match(/"(?:[^"]|"")*"/g).map(v=>v.slice(1,-1).replaceAll('""','"'));
 edit(row);lines[index]=row.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(';');return '\uFEFF'+lines.join('\r\n')+'\r\n';
};
test('a teljes korábbi forrásolt adattár változatlan, ellenőrzőösszeggel igazolva',()=>{
 const hashes=require('./fixtures/sourced-v1-hashes.json'),crypto=require('node:crypto');
 for(const key of ['material_catalog','norm_catalog','work_variants']){
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(S[key].slice(0,hashes[key].length))).digest('hex'),hashes[key].sha256,key);
 }
});
test('a bővítés 24 külön munkaváltozatot, 25 anyagrekordot és 9 gyártói számított normát ad',()=>{
 assert.equal(C.rows.length,188);assert.equal(C.trades.length,22);assert.equal(S.work_variants.length,33);assert.equal(S.material_catalog.length,95);assert.equal(S.norm_catalog.filter(n=>n.norm!=null).length,15);
 for(const n of S.norm_catalog.slice(36)){assert.match(n.source,/Számított időnorma/);assert.match(n.source,/2025\.01\.21/);assert.ok(S.work_variants.some(w=>E.normMatchesWork(n,w)));}
});
test('10/25/30 cm hagyományos fal normája és anyagigénye külön adat, nem általános falazási norma',()=>{
 for(const [width,norm,blocks,mortar] of [[10,.57,8,8.48],[25,1,10.7,27.2],[30,1.14,16,30.4]]){
  const r=draft('sajat-pth'+width+'-classic'),cost=E.lineCost(r,opts);
  assert.equal(r.budget.norm,norm);assert.equal(cost.hours,Math.round(norm*1e7)/1e6);assert.equal(cost.labor,Math.round(10*norm*7830*100)/100);
  assert.equal(cost.components[0].netQuantity,10*blocks);assert.ok(Math.abs(cost.components[1].netQuantity-10*mortar)<1e-8);
  assert.equal(cost.complete,false);assert.equal(r.budget.components[1].unit_price,null);
 }
 assert.equal(C.norm_catalog.find(n=>n.id==='norma-epulet-fal-1').norm,null);
});
test('Dryfix és DBM normák, kötőanyag-egységek és mennyiségek nem cserélődnek fel',()=>{
 for(const [width,df,dbm,dfYield,dbmQty] of [[10,.32,.46,12,.99],[25,.49,.7,6,2.38],[30,.55,.78,6,2.68]]){
  const a=draft('sajat-pth'+width+'-dryfix',12),b=draft('sajat-pth'+width+'-dbm',10);
  assert.equal(a.budget.norm,df);assert.equal(b.budget.norm,dbm);
  assert.equal(a.budget.components[1].unit,'flakon');assert.equal(b.budget.components[1].unit,'kg');
  assert.equal(E.lineCost(a,opts).components[1].netQuantity,12/dfYield);
  assert.ok(Math.abs(E.lineCost(b,opts).components[1].netQuantity-10*dbmQty)<1e-8);
  assert.match(a.budget.norm_applicability,/első sor/);
 }
});
test('30 cm Dryfix: csomagárban foglalt kötőanyag nem kap még egyszer önálló árat',()=>{
 const r=draft('sajat-pth30-dryfix'),l=E.lineCost(r,opts);
 assert.equal(l.material,160*837);assert.equal(l.components[1].cost,0);assert.match(r.budget.components[1].source,/CSOMAGÁR|csomag|falazóelem nettó ára/);
 assert.match(r.budget.components[0].name,/kötőanyaggal/);assert.equal(l.labor,43065);
 assert.equal(l.components[1].netQuantity,1.666667);assert.equal(l.components[1].quantity,2);
 assert.equal(l.complete,false,'A tényleges kiszerelési többlet/ellátási feltétel nem hallgatható el');
 assert.equal(r.budget.components[1].price_kind,'legacy_reference');
});
test('gyártói ár és normaforrás eltérő érvényességi dátuma megmarad',()=>{
 const r=draft('sajat-pth30-dryfix');assert.equal(r.budget.components[0].updated,'2026-04-01');assert.equal(r.budget.norm_updated,'2026-10-23');assert.match(r.budget.norm_source,/2025\.01\.21/);
});
test('új falazási normát sem lehet más nevű/szakágú/egységű stabil tételhez kapcsolni',()=>{
 for(const key of ['name','trade','unit']){const ns=E.copy(S.norm_catalog),n=ns.find(n=>n.id==='norma-sajat-pth30-dryfix');n[key]='más';assert.throws(()=>E.registry(ns,'norm',[...C.rows,...S.work_variants]),/Eltérő/);}
});
test('kézi és gépi vakolat rétegvastagság, zsákméret és egységár alapján számol, munkanorma nincs kitalálva',()=>{
 for(const [key,net,ordered,cost] of [['mp501-10',130,160,17472],['mp501-20',260,280,30576],['premium-10',140,160,17744],['premium-20',280,280,31052]]){
  const r=draft('sajat-cemix-'+key),l=E.lineCost(r,opts);assert.equal(l.components[0].netQuantity,net);assert.equal(l.components[0].quantity,ordered);assert.equal(l.material,cost);assert.equal(r.budget.norm,null);assert.equal(l.complete,false);
 }
});
test('Nivobond és Nivo SP 3/5 mm külön recept és termékár, nincs generikus felülírás',()=>{
 for(const [key,net,ordered,cost] of [['nivobond-3',50.1,75,15600],['nivobond-5',83.5,100,20800],['nivosp-3',50.1,75,16800],['nivosp-5',83.5,100,22400]]){
  const l=E.lineCost(draft('sajat-cemix-'+key),opts);assert.equal(l.components[0].netQuantity,net);assert.equal(l.components[0].quantity,ordered);assert.equal(l.material,cost);
 }
});
test('EPS ragasztás és hálóágyazás külön-külön 5 kg/m², nincs kétszer hozzáadott teljes 10 kg',()=>{
 const a=E.lineCost(draft('sajat-cemix-styro-eps-ragasztas'),opts),b=E.lineCost(draft('sajat-cemix-styro-eps-agyazas'),opts);
 assert.equal(a.components[0].netQuantity,50);assert.equal(b.components[0].netQuantity,50);assert.equal(a.material+b.material,20600);
 assert.equal(E.lineCost(draft('sajat-cemix-styro-gyapot-ragasztas'),opts).components[0].netQuantity,60);
});
test('Flex M 3/6 mm ragasztóréteg: 4/8 kg/m²; nem glettvas-fogazat és nem teljes burkolati rendszer',()=>{
 const a=draft('sajat-cemix-flexm-3'),b=draft('sajat-cemix-flexm-6');
 assert.equal(E.lineCost(a,opts).components[0].netQuantity,40);assert.equal(E.lineCost(b,opts).components[0].netQuantity,80);
 assert.match(a.budget.components[0].quantity_source,/nem 3 mm-es fogazat/);assert.match(a.name,/ragasztó réteg/);assert.equal(a.budget.norm,null);
});
test('5% tartalék egyszer növeli az anyagot, a munkanormát és óradíjat nem',()=>{
 const r=draft('sajat-pth30-dryfix');r.budget.material_factor=1.05;r.budget.components[0].waste_percent=5;
 const l=E.lineCost(r,opts);assert.equal(l.components[0].quantity,168);assert.equal(l.material,140616);assert.equal(l.labor,43065);
});
test('aktuális árlista exportja csak árakat ad; hiányzó ár nem lesz 0 és fajlagos nem íródik felül',()=>{
 const rows=D.priceList(S.material_catalog).replace(/^\uFEFF/,'').trimEnd().split('\r\n');assert.equal(rows.length,43);assert.ok(!rows.some(r=>r.startsWith('"termek-pth30-classic-kotoanyag";')));
 for(const row of rows.slice(1))assert.ok(row.endsWith(';"";"";"";""'));
 assert.throws(()=>D.importMaterialData(D.priceList(S.material_catalog),S.material_catalog,E),/nem tartalmaz/);
});
test('2027-es árfrissítés csak a módosított terméket érinti, a mentett ajánlatsort és receptet megőrzi',()=>{
 const r=draft('sajat-cemix-mp501-10'),before=E.copy(r),id='termek-cemix-mp501';
 const csv=rewrite(D.priceList(S.material_catalog),id,c=>{c[4]='120';c[5]='Saját 2027-es beszállítói árlista';c[6]='2027-01-15';});
 const updated=D.importMaterialData(csv,S.material_catalog,E);assert.equal(updated.prices,1);assert.equal(updated.ratios,0);
 const m=updated.entries.find(m=>m.id===id);assert.equal(m.unit_price,120);assert.equal(m.price_kind,'user');assert.equal(m.per_unit,null);
 assert.deepEqual(updated.entries.find(m=>m.id==='anyag-024'),S.material_catalog.find(m=>m.id==='anyag-024'));
 assert.deepEqual(r,before);assert.equal(E.lineCost(r,opts).material,17472);assert.equal(E.lineCost(draft('sajat-cemix-mp501-10',10,updated.entries),opts).material,19200);
});
test('új ár nem örökölheti észrevétlenül a korábbi árforrást és dátumot',()=>{
 const csv=rewrite(D.priceList(S.material_catalog),'termek-cemix-mp501',c=>{c[4]='120';});
 assert.throws(()=>D.importMaterialData(csv,S.material_catalog,E),/frissítsd az árforrást/);
});
test('2028-as árlista beolvasásakor a korábbi 2027-es ajánlat árpillanatképe sem változik',()=>{
 const id='termek-cemix-mp501',csv1=rewrite(D.priceList(S.material_catalog),id,c=>{c[4]='120';c[5]='2027-es árlista';c[6]='2027-02-01';}),ms=D.importMaterialData(csv1,S.material_catalog,E).entries;
 const row=draft('sajat-cemix-mp501-10',10,ms),before=E.copy(row),csv2=rewrite(D.priceList(ms),id,c=>{c[4]='140';c[5]='2028-as árlista';c[6]='2028-02-01';});
 const ms2=D.importMaterialData(csv2,ms,E).entries;assert.deepEqual(row,before);assert.equal(E.lineCost(row,opts).material,19200);assert.equal(E.lineCost(draft('sajat-cemix-mp501-10',10,ms2),opts).material,22400);
});
test('régi és új több szakágas ajánlat teljes anyag- és normapillanatképe JSON/CSV-ben megmarad',()=>{
 const p=E.sample(C);p.items=[draft('sajat-pth30-dryfix'),draft('sajat-cemix-mp501-10'),draft('sajat-evosz2013-cw50-1-q2')];
 p.building_budget={...p.building_budget,registry_version:1,material_catalog:E.copy(S.material_catalog),norm_catalog:E.copy(S.norm_catalog),custom_catalog:E.copy(S.work_variants.filter(w=>p.items.some(r=>r.budget.id===w.id))),settings:opts};
 const checked=E.validatePayload(JSON.parse(JSON.stringify(p)),C);assert.deepEqual(checked.items,p.items);assert.equal(checked.building_budget.material_catalog.length,95);assert.match(E.csv(checked,C),/2025\.01\.21/);assert.match(E.csv(checked,C),/normamennyiség/);
});

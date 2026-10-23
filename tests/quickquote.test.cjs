const test=require('node:test');
const assert=require('node:assert/strict');
const Q=require('../epulet-gyorsajanlat-mag.js');
const E=require('../epulet-szamitas.js');
const C=require('../epulet-teteladatok.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const def=id=>C.rows.find(x=>x.id===id);
const input={mode:'direct',quantity:10};
test('hivatalos 2026-os ajánlott legkisebb nettó óradíj és norma szorzat',()=>{
 assert.equal(Q.OFFICIAL_RATE,7830);
 const r=E.fromCatalog(def('epulet-vakolat-1'));r.qty=100;r.budget.norm=0.8;r.budget.norm_kind='user';r.budget.norm_unit='m²';
 const l=E.lineCost(r,E.settings({rate:Q.OFFICIAL_RATE,rate_includes_overhead:true}));
 assert.equal(l.hours,80);assert.equal(l.labor,626400);
 assert.equal(E.calculate([r],{rate:Q.OFFICIAL_RATE,rate_includes_overhead:true}).overhead,0);
});
test('régi alapozás/fal/tető sablonok is stabil anyagazonosítóval kapják az árakat',()=>{
 for(const id of ['epulet-alap-1','epulet-fal-1','epulet-teto-4']){const ms=clone(C.material_catalog);ms.forEach(m=>{m.unit_price=123;m.price_kind='user';m.source='SZINTETIKUS TESZT';m.updated='2026-10-22';});const r=Q.draftRow(def(id),input,E,C,ms,C.norm_catalog);for(const c of r.budget.components){assert.ok(c.material_id);assert.equal(c.unit_price,123);}}
});
test('Gyorsajánlat megőrzi a katalógus kézi tartalékát és kerekítését is',()=>{
 const ms=clone(C.material_catalog),m=ms.find(m=>m.id==='anyag-029');Object.assign(m,{per_unit:0.1,waste_percent:7,rounding:'up',unit_price:100,price_kind:'user',source:'TESZT',updated:'2026-10-22'});
 const r=Q.draftRow(def('epulet-vakolat-1'),input,E,C,ms,C.norm_catalog),c=r.budget.components[0];assert.equal(c.waste_percent,7);assert.equal(c.rounding,'up');assert.equal(E.componentCost(c,10,'m²').quantity,2);assert.equal(E.componentCost(c,10,'m²').cost,200);
});
test('norma CSV valótlan naptári dátuma elutasított',()=>{const csv=Q.normTemplate([def('epulet-vakolat-1')]).replace('"";"";"";"";""','"0.8";"user";"Szintetikus mérés";"2026-02-31";"Teszt"');assert.throws(()=>Q.importNorms(csv,C.rows,E,C.norm_catalog),/érvényes dátuma/);});
test('óradíj jogszabályi referenciája JSON/CSV körben is megmarad, régi összeg nem változik',()=>{
 const p=require('./resources-fixture.cjs').fixture(),t=E.calculate(p.items,p.building_budget.settings);p.building_budget.rate_reference=Q.reference();assert.deepEqual(E.validatePayload(JSON.parse(JSON.stringify(p)),C),p);assert.equal(E.calculate(p.items,p.building_budget.settings).gross,t.gross);assert.ok(E.csv(p,C).includes(Q.RATE_SOURCE));p.building_budget.rate_reference.source={};assert.throws(()=>E.validatePayload(p,C),/Hibás szöveg/);
});
test('mennyiség: hossz × szélesség és falnyílások levonása',()=>{
 assert.deepEqual(Q.measure({mode:'area',unit:'m²',length:10,width:8}),{quantity:80,source:'Felmérés: 10 m × 8 m'});
 assert.equal(Q.measure({mode:'wall',unit:'m²',length:15,height:3,openings:5}).quantity,40);
 assert.equal(Q.measure({mode:'volume',unit:'m³',length:10,width:0.4,depth:0.8}).quantity,3.2);
 assert.equal(Q.measure({mode:'linear',unit:'fm',length:'12,5'}).quantity,12.5);
});
test('m² és m³ között nincs csendes mértékegység-váltás',()=>{
 assert.throws(()=>Q.measure({mode:'area',unit:'m³',length:10,width:10}),/csak m²/);
 assert.throws(()=>Q.measure({mode:'volume',unit:'m²',length:10,width:10,depth:1}),/csak m³/);
 assert.throws(()=>Q.measure({mode:'wall',unit:'m²',length:3,height:3,openings:9}),/nyílások/);
 assert.throws(()=>Q.measure({mode:'direct',unit:'m²',quantity:0}),/érvénytelen/);
 assert.throws(()=>Q.measure({mode:'direct',unit:'m²',quantity:-1}),/érvénytelen/);
});
test('gyorsan hozzáadott tétel azonnal jelzi a hiányzó normát és az anyagárat',()=>{
 const row=Q.draftRow(def('epulet-vakolat-1'),input,E,C,C.material_catalog,C.norm_catalog);
 assert.equal(row.qty,10);assert.equal(row.budget.material_mode,'components');
 assert.equal(row.budget.norm,null);
 const l=E.lineCost(row,{rate:Q.OFFICIAL_RATE,rate_includes_overhead:true});
 assert.equal(l.complete,false);assert.ok(l.issues.some(x=>/Normaidő hiányzik/.test(x)));
 assert.ok(l.issues.some(x=>/Anyagegységár/.test(x)));
 assert.equal(l.labor,0); // only known part, not a claim of free labor
});
test('katalógus normaidő csak pontos azonosító és egység szerint kerül sorba',()=>{
 const n=clone(C.norm_catalog),i=n.findIndex(x=>x.id==='norma-epulet-vakolat-1');assert.ok(i>=0);
 n[i]={...n[i],norm:0.8,kind:'verified',source:'Engedélyezett tesztforrás',updated:'2026-10-22'};
 const row=Q.draftRow(def('epulet-vakolat-1'),input,E,C,C.material_catalog,n);
 assert.equal(row.budget.norm,0.8);assert.equal(row.budget.norm_id,n[i].id);
 assert.equal(E.lineCost(row,{rate:Q.OFFICIAL_RATE,rate_includes_overhead:true}).labor,62640);
 n[i].norm=999;assert.equal(E.lineCost(row,{rate:Q.OFFICIAL_RATE}).labor,62640);
});
test('anyagárat másol, de eredeti sablon fajlagosát nem törli ha a katalógusban hiányzik',()=>{
 const materials=clone(C.material_catalog),m=materials.find(x=>x.id==='anyag-029');assert.ok(m);
 m.unit_price=200;m.price_kind='user';m.source='Szintetikus árteszt';m.updated='2026-10-22';m.per_unit=null;
 const row=Q.draftRow(def('epulet-vakolat-1'),{mode:'direct',quantity:5},E,C,materials,C.norm_catalog);
 const c=row.budget.components.find(c=>c.material_id==='anyag-029');
 assert.equal(c.unit_price,200);assert.equal(c.per_unit,13);
 assert.equal(E.componentCost(c,5,'m²').cost,13000);
 m.unit_price=900;assert.equal(c.unit_price,200);
});
test('téves anyagmértékegység eltérést elutasítja',()=>{
 const materials=clone(C.material_catalog),m=materials.find(x=>x.id==='anyag-029');m.unit='db';
 assert.throws(()=>Q.draftRow(def('epulet-vakolat-1'),input,E,C,materials,C.norm_catalog),/Nem egyezik/);
});
test('CSV sablonban minden 188 meglévő tétel szerepel de üres normával',()=>{
 const csv=Q.normTemplate(C.rows);
 assert.equal(csv.split('\r\n').filter(Boolean).length,189);
 assert.ok(csv.includes('"epulet-vakolat-1"'));
 assert.ok(csv.includes('"norma_ora_per_egyseg"'));
 assert.ok(!csv.includes('"0,8"'));
});
test('CSV: forrásolt valid munkanorma importálható, korábbi ajánlatpillanatkép sértetlen',()=>{
 const csv=Q.normTemplate([def('epulet-vakolat-1')]).replace('"";"";"";"";""', '"0,8";"verified";"Engedélyezett próba";"2026-10-22";"10mm réteg"');
 const old=E.fromCatalog(def('epulet-vakolat-1'));old.budget.norm=0.4;
 const result=Q.importNorms(csv,C.rows,E,C.norm_catalog);
 assert.equal(result.count,1);assert.equal(result.entries.find(x=>x.id==='norma-epulet-vakolat-1').norm,0.8);
 assert.equal(old.budget.norm,0.4);
});
test('CSV: hibás egység, ismeretlen azonosító, forrás nélkül és duplikáció elutasítva',()=>{
 const one=Q.normTemplate([def('epulet-vakolat-1')]);
 const valid=one.replace('"";"";"";"";""','"0.8";"user";"Saját próbamérés";"2026-10-22";"Teszt"');
 assert.throws(()=>Q.importNorms(valid.replace('"m²"','"m³"'),C.rows,E,C.norm_catalog),/Eltérő/);
 assert.throws(()=>Q.importNorms(valid.replace('"epulet-vakolat-1"','"idegen"'),C.rows,E,C.norm_catalog),/Ismeretlen/);
 assert.throws(()=>Q.importNorms(valid.replace('"Saját próbamérés"','""'),C.rows,E,C.norm_catalog),/forrása/);
 assert.throws(()=>Q.importNorms(valid+valid.split('\r\n')[1]+'\r\n',C.rows,E,C.norm_catalog),/Ismétlődő/);
 assert.throws(()=>Q.importNorms(one,C.rows,E,C.norm_catalog),/nem tartalmaz kitöltött/);
});

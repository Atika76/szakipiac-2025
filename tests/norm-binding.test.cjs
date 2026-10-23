// All numeric norms here are SYNTHETIC regression data, not construction standards.
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../epulet-szamitas.js'),Q=require('../epulet-gyorsajanlat-mag.js'),C=require('../epulet-teteladatok.js');
const work=C.rows.find(r=>r.id==='epulet-alap-1');
const norm=patch=>({id:'norma-'+work.id,name:work.megnevezes,trade:work.szakag,unit:work.egyseg,norm:3.5,kind:'user',source:'SZINTETIKUS TESZT, nem szakmai norma',updated:'2026-10-22',...patch});
const draft=n=>Q.draftRow(work,{mode:'direct',quantity:2},E,C,C.material_catalog,[n]);
const payload=n=>{const p=E.tradeSample(C);p.building_budget.norm_catalog=[n];return p;};
const bindingError=/stabil normaazonosító/;

test('a célzott változat 188 tételes, 22 szakágas, 70 anyagos, 30 normás és 30 sablonos marad',()=>{
 assert.deepEqual([C.rows.length,C.trades.length,C.material_catalog.length,C.norm_catalog.length,Object.keys(C.component_templates).length],[188,22,70,30,30]);
});
test('reprodukált hiba: fúrás 3,5 óra/m³ normája nem alkalmazható sávalap betonozásához',()=>{
 const n=norm({name:'Más művelet: fúrás',trade:'elokeszites'}),before=E.copy(n);
 assert.equal(E.normEntry(n).norm,3.5); // Structurally valid; the work binding is the actual defect.
 assert.equal(draft(n).budget.norm,null);
 assert.throws(()=>E.registry([n],'norm',C.rows),bindingError);
 assert.deepEqual(n,before);
});
for(const [label,patch] of [
 ['eltérő név',{name:'Más művelet: fúrás'}],
 ['eltérő szakág',{trade:'elokeszites'}],
 ['eltérő mértékegység',{unit:'m²'}],
 ['csak hasonló, de nem pontos név',{name:work.megnevezes.toLocaleLowerCase('hu')}]
])test('stabil normaazonosító: '+label+' automatikusan és katalógusmentéskor is elutasított',()=>{
 const n=norm(patch);assert.equal(E.normMatchesWork(n,work),false);
 assert.equal(draft(n).budget.norm,null);assert.throws(()=>E.registry([n],'norm',C.rows),bindingError);
});
test('egyező név, szakág és egység sem helyettesíti a pontos normaazonosítót',()=>{
 const n=norm({id:'norma-masik-tetel'});assert.equal(draft(n).budget.norm,null);
});
test('pontosan egyező norma automatikusan alkalmazható, munkaóra és munkadíj helyes',()=>{
 const n=norm(),row=draft(n),cost=E.lineCost(row,{rate:7830,rate_includes_overhead:true});
 assert.equal(row.budget.norm,3.5);assert.equal(row.budget.norm_id,n.id);
 assert.equal(cost.hours,7);assert.equal(cost.labor,54810);
 assert.deepEqual(E.registry([n],'norm',C.rows),[n]);
});
test('a megadott nulla normaidő nem válik hiányzó adattá',()=>{
 assert.equal(draft(norm({norm:0})).budget.norm,0);
 assert.equal(draft(norm({norm:null,kind:'unknown'})).budget.norm,null);
});
test('teljes projekt JSON: hibás normakötés elutasított, az eredeti importobjektum sem változik',()=>{
 const p=payload(norm({name:'Más művelet: fúrás',trade:'elokeszites'})),before=E.copy(p);
 assert.throws(()=>E.validatePayload(p,C),bindingError);assert.deepEqual(p,before);
});
test('a normaidő nélküli helykitöltőt sem lehet más technológiára átnevezni stabil azonosítóval',()=>{
 assert.throws(()=>E.validatePayload(payload(norm({name:'Más technológia',norm:null,kind:'unknown'})),C),bindingError);
});
test('teljes projekt JSON: pontos normakötés adatvesztés nélkül visszatölthető',()=>{
 const p=payload(norm());assert.deepEqual(E.validatePayload(JSON.parse(JSON.stringify(p)),C),p);
});
test('saját munkatételhez tartozó stabil norma neve és szakága is védett',()=>{
 const own={...work,id:'sajat-beton-teszt',megnevezes:'Saját betonozási technológia'},n=norm({id:'norma-'+own.id,name:own.megnevezes}),p=payload(n);
 p.building_budget.custom_catalog=[own];assert.deepEqual(E.validatePayload(p,C),p);
 p.building_budget.norm_catalog[0].trade='elokeszites';assert.throws(()=>E.validatePayload(p,C),bindingError);
});
test('önálló saját norma továbbra is szerkeszthető, de nem kapcsolódik automatikusan munkatételhez',()=>{
 const n=norm({id:'norma-sajat-onallo',name:'Önálló saját munkanorma',trade:'elokeszites'});
 assert.deepEqual(E.registry([n],'norm',C.rows),[n]);assert.deepEqual(E.validatePayload(payload(n),C),payload(n));
 assert.equal(draft(n).budget.norm,null);
});
test('katalógusfrissítés nem változtatja meg a korábbi ajánlat normapillanatképét vagy összegét',()=>{
 const n=norm({norm:0.8}),old=draft(n),saved=E.copy(old),before=E.lineCost(old,{rate:7830}).labor;
 n.norm=1.1;n.source='Új SZINTETIKUS teszt';const updated=E.registry([n],'norm',C.rows);
 assert.equal(draft(updated[0]).budget.norm,1.1);assert.deepEqual(old,saved);
 assert.equal(E.lineCost(old,{rate:7830}).labor,before);
 const p=payload(n);p.items=[old];assert.deepEqual(E.validatePayload(JSON.parse(JSON.stringify(p)),C).items,[saved]);
});
test('a régi sorban mentett egyedi norma nem kerül újra hozzárendelésre JSON-visszatöltéskor',()=>{
 const p=payload(norm()),row=E.fromCatalog(work);row.qty=2;row.name='Korábban mentett egyedi technológia';
 Object.assign(row.budget,{norm:0.6,norm_kind:'user',norm_id:'norma-'+work.id,norm_source:'Régi saját mérés',norm_updated:'2025-01-01'});p.items=[row];
 assert.deepEqual(E.validatePayload(JSON.parse(JSON.stringify(p)),C).items,p.items);
});
test('norma CSV: pontos kötések importálhatók, megmaradó hibás katalóguskötés nem csúszhat át',()=>{
 const csv=Q.normTemplate([work]).replace('"";"";"";"";""','"0.8";"user";"SZINTETIKUS teszt";"2026-10-22";"Teszt"');
 const result=Q.importNorms(csv,C.rows,E,C.norm_catalog),n=result.entries.find(n=>n.id==='norma-'+work.id);
 assert.equal(n.norm,0.8);assert.ok(E.normMatchesWork(n,work));
 const other=C.rows.find(r=>r.id==='epulet-vakolat-1'),bad={...norm(),id:'norma-'+other.id,name:'Eltérő technológia',trade:other.szakag,unit:other.egyseg};
 assert.throws(()=>Q.importNorms(csv,C.rows,E,[bad]),bindingError);
});
test('a meglévő 30 normakatalógus-hely pontosan egyezik a munkatétellel',()=>{
 assert.deepEqual(E.registry(C.norm_catalog,'norm',C.rows),C.norm_catalog);
});

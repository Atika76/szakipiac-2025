const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../epulet-szamitas.js'),C=require('../epulet-teteladatok.js');
function priced(){const r=E.fromCatalog(C.rows[0]);r.qty=10;r.mat_unit_price=100;r.budget={...r.budget,norm:0.5,norm_kind:'user',rate:2000,machine:20,transport:30,extra:10,source:'Szintetikus tesztadat – nem piaci ár',updated:'2026-10-21',price_kind:'user',quantity_source:'Szintetikus felmérés'};return r;}
test('saját katalógus: 22 szakág, 188 egyedi tétel; a korábbi 144 tétel megmaradt',()=>{assert.equal(C.trades.length,22);assert.equal(C.rows.length,188);assert.equal(new Set(C.rows.map(r=>r.id)).size,188);assert.deepEqual(C.rows.slice(0,144),require('./building-catalog-baseline.json').rows);assert.equal(C.rows.slice(0,144).filter(r=>r.price_kind==='missing').length,111);for(const r of C.rows){assert.ok(C.trades.some(t=>t.id===r.szakag));if(r.price_kind==='missing'){assert.equal(r.anyag_atlag,null);assert.equal(r.norma_ora_atlag,null);}}});
test('mennyiség × ár és mennyiség × norma × óradíj; gép, szállítás és egyéb külön',()=>{const t=E.calculate([priced()]);assert.equal(t.material,1000);assert.equal(t.hours,5);assert.equal(t.labor,10000);assert.equal(t.machine,200);assert.equal(t.transport,300);assert.equal(t.extra,100);assert.equal(t.net,11600);assert.equal(t.vat,3132);assert.equal(t.gross,14732);assert.equal(t.complete,true);});
test('rezsi → kedvezmény → haszon → pénzügyi tartalék → áfa sorrend',()=>{const t=E.calculate([priced()],{overhead_percent:10,discount:100,profit_percent:20,reserve_percent:5,vat_percent:27});assert.equal(t.overhead,1160);assert.equal(t.profit,2532);assert.equal(t.reserve,759.6);assert.equal(t.net,15951.6);assert.equal(t.gross,20258.53);});
test('nincs dupla munkadíj a régi lab_unit_price és a normaidő miatt',()=>{const r=priced();r.lab_unit_price=999999;assert.equal(E.calculate([r]).labor,10000);});
test('anyagtartalék csak az anyagot növeli, nem a nettó munkamennyiséget és munkaórát',()=>{const r=priced();r.budget.material_factor=1.05;const t=E.calculate([r]);assert.equal(t.material,1050);assert.equal(t.labor,10000);assert.equal(t.hours,5);assert.equal(t.lines[0].materialQuantity,10.5);r.budget.material_factor=null;assert.equal(E.calculate([r]).complete,false);});
test('soronkénti óradíj felülírja a közöset, üres örökli',()=>{const r=priced();assert.equal(E.calculate([r],{rate:3000}).labor,10000);r.budget.rate=null;assert.equal(E.calculate([r],{rate:3000}).labor,15000);});
test('hiányzó ár nem azonos a megadott nulla árral',()=>{const r=priced();r.mat_unit_price=null;let t=E.calculate([r]);assert.equal(t.complete,false);assert.ok(t.lines[0].issues.some(s=>s.includes('Anyagegységár')));r.mat_unit_price=0;assert.equal(E.calculate([r]).complete,true);});
test('nulla normaidőnél nem kell óradíj, hiányzó normánál nem végleges',()=>{const r=priced();r.budget.norm=0;r.budget.rate=null;assert.equal(E.calculate([r]).complete,true);r.budget.norm=null;assert.equal(E.calculate([r]).complete,false);});
test('visszaszámított normából és régi referenciából nem lesz ellenőrzött ajánlat',()=>{const r=E.fromCatalog(C.rows.find(r=>r.norm_kind==='derived'));r.qty=1;r.budget.quantity_source='Teszt';assert.equal(E.calculate([r],{rate:7830}).complete,false);assert.ok(E.calculate([r],{rate:7830}).lines[0].issues.some(s=>s.includes('visszaszámított')));});
test('ellenőrzött normához forrás és dátum szükséges',()=>{const r=priced();r.budget.norm_kind='verified';assert.equal(E.calculate([r]).complete,false);r.budget.norm_source='Szintetikus forrás';r.budget.norm_updated='2026-10-21';assert.equal(E.calculate([r]).complete,true);});
test('120 m² geometria: 22,4 m³ sávalap, 99,2 m² nettó fal, valódi tetősík',()=>{const g=E.geometry(E.sampleGeometry());assert.equal(g.floor,120);assert.equal(g.footing,22.4);assert.equal(g.slab,18);assert.equal(g.wall,99.2);assert.equal(g.roof,174.57);assert.equal(g.foundationMaterials[0].qty,23.52);assert.equal(g.foundationMaterials[1].qty,null);assert.equal(g.wallMaterials[0].qty,null);});
test('anyagszükséglet megadott gyártói fajlagosból, darab felfelé kerekítve',()=>{const g=E.geometry({...E.sampleGeometry(),blocks_per_m2:16,mortar_per_m2:20,steel_kg_m3:80,tiles_per_m2:10,timber_m3_m2:0.04});assert.equal(g.wallMaterials[0].qty,1667);assert.equal(g.wallMaterials[1].qty,2083.2);assert.equal(g.foundationMaterials[1].qty,1881.6);assert.equal(g.roofMaterials[1].qty,1833);assert.equal(g.roofMaterials[2].qty,7.33);});
test('a 120 m² minta minden szakágat tartalmaz, de nem árazott kulcsrakész ajánlat',()=>{const p=E.sample(C);assert.equal(p.items.length,25);assert.equal(new Set(p.items.map(r=>r.budget.trade)).size,22);assert.equal(E.calculate(p.items).complete,false);assert.equal(E.calculate(p.items).gross,0);assert.ok(p.items.some(r=>r.qty==null));});
test('teljes JSON mentés visszatöltése megőrzi a geometriát, saját katalógust, forrásokat',()=>{const p=E.sample(C);const row={...C.rows[0],id:'sajat-teszt',megnevezes:'Saját tétel'};p.building_budget.custom_catalog=[row];p.items.push(E.fromCatalog(row));const loaded=E.validatePayload(JSON.parse(JSON.stringify(p)),C);assert.deepEqual(loaded,p);});
test('ismeretlen fájlverzió elutasítva a meglévő állapot módosítása nélkül',()=>{const p=E.sample(C),before=JSON.stringify(p);assert.throws(()=>E.validatePayload({...p,building_budget:{...p.building_budget,schema_version:9}},C),/verzió/);assert.equal(JSON.stringify(p),before);});
test('negatív, NaN, végtelen, túl nagy ár és invalid százalék elutasítva',()=>{for(const bad of [-1,NaN,Infinity,'nem szám',1e15])assert.throws(()=>E.number(bad));assert.throws(()=>E.calculate([priced()],{vat_percent:101}));const r=priced();r.qty=1e9;r.mat_unit_price=1e9;assert.throws(()=>E.calculate([r]),/túl nagy/);});
test('geometriai hibák nem készítenek hihető negatív mennyiséget',()=>{assert.throws(()=>E.geometry({...E.sampleGeometry(),openings:999}));assert.throws(()=>E.geometry({...E.sampleGeometry(),pitch:90}));assert.throws(()=>E.geometry({...E.sampleGeometry(),width:0}));});
test('magyar számbevitel és üres érték',()=>{assert.equal(E.number('1 234,56'),1234.56);assert.equal(E.number(''),null);assert.equal(E.number('0'),0);});
test('CSV BOM, magyar elválasztó, források, hiányjelölés és képlet-injektálás elleni védelem',()=>{const p=E.sample(C);p.items[0].name='=HYPERLINK("rossz")';const csv=E.csv(p,C);assert.equal(csv.charCodeAt(0),0xfeff);assert.ok(csv.includes('MEGADANDÓ'));assert.ok(csv.includes('"22,4"'));assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.includes('HIÁNYOS TERVEZET'));});
test('legacy payload változatlanul betölthető',()=>{const p={project_name:'Régi',items:[{name:'Tétel',qty:1,mat_unit_price:100}]};assert.deepEqual(E.validatePayload(p,C),p);});

test('sérült régi mezők elutasítva részletes és normál fájlban is',()=>{
 const mutations=[p=>p.settings.vat_rate={toString:null},p=>p.settings.vat_rate=[],p=>p.settings.overhead_rate={},
  p=>p.settings.vat_enabled='false',p=>p.settings.global_unit={},p=>p.client.name={toString:null},
  p=>p.project_name=[],p=>p.narrative.notes={toString:null},p=>p.items=[null],p=>p.items[0].name={},
  p=>p.items[0].qty={},p=>p.items[0].unit={toString:null},p=>p.settings=[],p=>p.items={}];
 for(const mutate of [p=>p.items[0].budget.materials={length:1},p=>p.items[0].budget.source={toString:null}]){
  const p=E.sample(C);mutate(p);assert.throws(()=>E.validatePayload(p,C));
 }
 for(const detailed of [true,false])for(const mutate of mutations){
  const p=E.sample(C);if(!detailed)delete p.building_budget;
  mutate(p);const before=JSON.stringify(p);assert.throws(()=>E.validatePayload(p,C));assert.equal(JSON.stringify(p),before);
 }
});
test('régi számszövegek, nulla és hiányzó opcionális mezők továbbra is betölthetők',()=>{
 const p={project_name:'Régi',settings:{vat_rate:'27',vat_enabled:false,overhead_rate:'0'},items:[{name:'Sor',qty:'2',mat_unit_price:0}]};
 assert.deepEqual(E.validatePayload(p,C),p);
});
test('egységár vagy norma módosítása nem írja át a katalógust vagy a korábbi pillanatképet',()=>{const json=JSON.stringify(C);const p=E.sample(C),old=JSON.stringify(p);const r=E.copy(p);r.items[0].mat_unit_price=999;assert.equal(JSON.stringify(C),json);assert.equal(JSON.stringify(p),old);});

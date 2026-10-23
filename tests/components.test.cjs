const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../epulet-szamitas.js'),C=require('../epulet-teteladatok.js'),{fixture}=require('./component-fixture.cjs');
test('144 régi tétel változatlan; 44 saját bővítés és a korábbi 14 sablon megmaradt',()=>{
 assert.deepEqual(C.rows.slice(0,144),require('./building-catalog-baseline.json').rows);assert.equal(C.rows.length,188);assert.equal(Object.keys(C.component_templates).length,30);
 for(const row of C.rows.slice(144)){assert.equal(row.anyag_atlag,null);assert.equal(row.norma_ora_atlag,null);assert.equal(row.price_kind,'missing');}
 for(const list of Object.values(C.component_templates))for(const c of list){assert.equal(c.unit_price,null);assert.ok(c.per_unit==null||c.per_unit>=0);if(c.per_unit!=null)assert.ok(c.quantity_source);}
});
test('alapozás: m³ beton, kg acél és kg kötözőhuzal külön árazva',()=>{
 const r=fixture().items[0],l=E.lineCost(r,E.defaults());assert.deepEqual(l.components.map(c=>c.quantity),[2.1,168,1.1]);assert.deepEqual(l.components.map(c=>c.cost),[63000,33600,550]);assert.equal(l.material,97150);assert.equal(l.labor,2000);assert.equal(l.gross,125920.5);assert.equal(l.complete,true);
});
test('falazás: egészre kerekített falazóelem, habarcs és nullaáras kiegészítő',()=>{
 const l=E.lineCost(fixture().items[1],E.defaults());assert.deepEqual(l.components.map(c=>c.netQuantity),[160,25,5]);assert.deepEqual(l.components.map(c=>c.quantity),[168,27.5,5]);assert.equal(l.material,17350);assert.equal(l.total,27950);assert.equal(l.gross,35496.5);assert.equal(l.complete,true);
});
test('tetőfedés: darabkerekítés a tartalék után, elkülönített munkadíj',()=>{
 const l=E.lineCost(fixture().items[2],E.defaults());assert.deepEqual(l.components.map(c=>c.quantity),[130,21,2]);assert.equal(l.material,35550);assert.equal(l.hours,5);assert.equal(l.labor,10000);assert.equal(l.gross,57848.5);
});
test('darabkerekítés előtt nem veszhet el a pozitív törtrész',()=>{
 const r=fixture().items[1];r.qty=1;r.budget.components[0].per_unit=1.0000004;r.budget.components[0].waste_percent=0;
 assert.equal(E.componentCosts(r)[0].quantity,2);
 r.budget.components[0].per_unit=0.2;r.qty=3;r.budget.components[0].waste_percent=0;assert.equal(E.componentCosts(r)[0].quantity,1);
});
test('nincs hozzáadva régi összesített anyagár, régi szorzó vagy másodszori veszteség',()=>{
 const r=fixture().items[1],before=E.lineCost(r,E.defaults());r.mat_unit_price=1e9;r.budget.material_factor=100;const after=E.lineCost(r,E.defaults());assert.equal(after.material,before.material);assert.equal(after.hours,before.hours);assert.equal(after.materialQuantity,null);
});
test('a hiányzó összetevőár nem 0; ismert részösszeg mellett hiányos marad',()=>{
 const r=fixture().items[1];r.budget.components[0].unit_price=null;let l=E.lineCost(r,E.defaults());assert.equal(l.components[0].cost,null);assert.equal(l.material,550);assert.equal(l.complete,false);
 r.budget.components[0].unit_price=0;l=E.lineCost(r,E.defaults());assert.equal(l.components[0].cost,0);assert.equal(l.complete,true);
});
test('hiányzó fajlagos nulla ár mellett sem ismert mennyiség',()=>{
 const r=fixture().items[1];r.budget.components[0].per_unit=null;r.budget.components[0].unit_price=0;const l=E.lineCost(r,E.defaults());assert.equal(l.components[0].quantity,null);assert.equal(l.components[0].cost,null);assert.equal(l.complete,false);
});
test('kifejezetten nulla fajlagos érvényes nulla anyagigény',()=>{
 const r=fixture().items[1];r.budget.components[0].per_unit=0;const l=E.lineCost(r,E.defaults());assert.equal(l.components[0].quantity,0);assert.equal(l.components[0].cost,0);assert.equal(l.complete,true);
});
test('üres összetevőlista hiányos és nem vált vissza a régi árra',()=>{
 const r=fixture().items[1];r.budget.components=[];const l=E.lineCost(r,E.defaults());assert.equal(l.material,0);assert.equal(l.complete,false);
});
test('egységütközés, duplikált azonosító és ismeretlen verzió elutasítva',()=>{
 for(const mutate of [r=>r.budget.components[0].basis_unit='kg',r=>r.budget.components[1].id=r.budget.components[0].id,r=>r.budget.component_version=2,r=>r.budget.material_mode='bad']){const r=fixture().items[1];mutate(r);assert.throws(()=>E.lineCost(r,E.defaults()));}
});
test('sablon nem írhatja át hallgatólagosan a munkatétel bázisegységét',()=>{
 const r=E.fromCatalog(C.rows.find(r=>r.id==='epulet-alap-1'));r.unit='kg';assert.throws(()=>E.applyComponentTemplate(r,C),/bázisegysége eltér/);assert.equal(r.unit,'kg');assert.equal(r.budget.components,undefined);
});
test('hibás komponensszámok, tartalék és szerkezet nem módosítják az importot',()=>{
 for(const mutate of [c=>c.unit_price={},c=>c.per_unit=-1,c=>c.waste_percent=101,c=>c.name={},c=>c.rounding='bad',c=>c.use_geometry_waste='true']){const p=fixture();mutate(p.items[0].budget.components[0]);const old=JSON.stringify(p);assert.throws(()=>E.validatePayload(p,C));assert.equal(JSON.stringify(p),old);}
});
test('mennyiségi és pénzügyi túlcsordulás elutasítva',()=>{
 const r=fixture().items[0];r.qty=1e9;r.budget.components[0].per_unit=1e9;assert.throws(()=>E.lineCost(r,E.defaults()),/nagy/);
 r.qty=1e7;r.budget.components[0].per_unit=1;r.budget.components[0].unit_price=1e9;assert.throws(()=>E.lineCost(r,E.defaults()),/nagy/);
});
test('ár- és fajlagosforrások hiánya nem ad teljesnek jelzett költségvetést',()=>{
 const r=fixture().items[1];r.budget.components[0].source='';r.budget.components[0].quantity_source='';r.budget.components[1].updated='';assert.equal(E.lineCost(r,E.defaults()).complete,false);
});
test('a katalógussablon és korábbi projekt független az új összetevőktől',()=>{
 const before=JSON.stringify(C),p=fixture(),old=JSON.stringify(p);const q=E.copy(p);q.items[0].budget.components[0].unit_price=1;assert.equal(JSON.stringify(C),before);assert.equal(JSON.stringify(p),old);
});
test('geometria újraszámítása őrzi az árakat és a kézi tartalékot',()=>{
 const p=E.componentSample(C),r=p.items.find(i=>i.budget.calc_key==='wall');r.budget.components[0].unit_price=123;r.budget.components[0].waste_percent=7;r.budget.components[0].use_geometry_waste=false;
 const geo={...E.sampleGeometry(),blocks_per_m2:16,waste:10},next=E.updateComponentGeometry(r,geo);assert.equal(next.budget.components[0].per_unit,16);assert.equal(next.budget.components[0].unit_price,123);assert.equal(next.budget.components[0].waste_percent,7);assert.equal(next.budget.components[1].waste_percent,10);assert.equal(r.budget.components[0].per_unit,null);
});
test('JSON-kör megőrzi az összetevőket, forrásokat és saját katalógusváltozatot',()=>{
 const p=fixture(),r=p.items[1];p.building_budget.custom_catalog=[{...C.rows[0],id:'sajat-osszetevos',egyseg:r.unit,budget_defaults:{material_mode:'components',components:E.copy(r.budget.components)}}];
 assert.deepEqual(E.validatePayload(JSON.parse(JSON.stringify(p)),C),p);const copy=E.fromCatalog(p.building_budget.custom_catalog[0]);assert.deepEqual(copy.budget.components,r.budget.components);
});
test('összetevős sor nem tölthető be félreértelmezhető normál formátumként',()=>{
 const p=fixture();p.building_budget.enabled=false;assert.throws(()=>E.validatePayload(p,C),/aktív részletes/);delete p.building_budget;assert.throws(()=>E.validatePayload(p,C),/aktív részletes/);
});
test('régi összesített módra visszaváltás nem adja hozzá az inaktív komponenseket',()=>{
 const r=fixture().items[1];r.budget.material_mode='aggregate';const l=E.lineCost(r,E.defaults());assert.equal(l.material,69999930);assert.equal(l.components.length,0);const p=fixture();p.items=[r];assert.deepEqual(E.validatePayload(p,C),p);
});
test('CSV-ben megmarad a fajlagos, egységár, forrás, hiány és képletvédelem',()=>{
 const p=fixture();p.items[0].budget.components[0].name='=VESZELYES';p.items[1].budget.components[0].unit_price=null;const csv=E.csv(p,C);assert.ok(csv.includes("'=VESZELYES"));assert.ok(csv.includes('SZINTETIKUS TESZT'));assert.ok(csv.includes('Anyagösszetevők'));assert.ok(csv.includes('MEGADANDÓ'));assert.ok(csv.includes('"27,5"'));assert.ok(!csv.includes('999999'));assert.equal(csv.charCodeAt(0),0xfeff);
});
test('három tétel összege és projektáfa nem tartalmaz duplikált anyagot',()=>{
 const p=fixture(),t=E.calculate(p.items,p.building_budget.settings);assert.equal(t.material,150050);assert.equal(t.labor,22000);assert.equal(t.net,172650);assert.equal(t.gross,219265.5);assert.equal(t.complete,true);
});

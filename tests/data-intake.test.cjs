const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../epulet-adatfeltoltes.js'),E=require('../epulet-szamitas.js'),C=require('../epulet-teteladatok.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const replaceRow=(csv,id,fn)=>{
 const rows=csv.replace(/^\uFEFF/,'').trimEnd().split('\r\n');
 const i=rows.findIndex(r=>r.includes('"'+id+'"'));
 assert.ok(i>0,'nem található CSV anyag '+id);
 const parts=rows[i].match(/"(?:[^"]|"")*"/g).map(v=>v.slice(1,-1).replace(/""/g,'"'));
 const next=fn(parts)||parts;
 rows[i]=next.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(';');
 return '\uFEFF'+rows.join('\r\n')+'\r\n';
};
test('a sablon 70 anyagot ad, és nem tartalmaz kitalált árat vagy munkanormát',()=>{
 const csv=D.template(C.material_catalog);
 assert.equal(csv.replace(/^\uFEFF/,'').trimEnd().split('\r\n').length,71);
 assert.ok(csv.includes('"anyag-029"'));assert.ok(csv.includes('"netto_ar_ft"'));
 assert.equal(D.audit(C.rows,C.material_catalog,C.norm_catalog).missingPrices,70);
 const a=D.audit(C.rows,C.material_catalog,C.norm_catalog);
 assert.equal(a.missingNormSlots,30);assert.equal(a.missingWorkNorms,188);
});
test('azonosító/egység alapján kötegelt ár és fajlagos betöltése, régi sorpillanatkép sértetlen',()=>{
 const p=E.tradeSample(C),before=JSON.stringify(p.items);
 let csv=D.template(C.material_catalog);
 csv=replaceRow(csv,'anyag-029',cells=>{cells[4]='123,5';cells[5]='2026.10.22 helyi beszállítói próba';cells[6]='2026-10-22';cells[7]='14';cells[8]='Saját felmérés: nem gyártói norma';cells[9]='2026-10-22';cells[10]='10 mm, kizárólag próba';return cells});
 const r=D.importMaterialData(csv,C.material_catalog,E),newMat=r.entries.find(m=>m.id==='anyag-029');
 assert.equal(r.prices,1);assert.equal(r.ratios,1);
 assert.equal(newMat.unit_price,123.5);assert.equal(newMat.per_unit,14);assert.equal(newMat.price_kind,'user');assert.equal(newMat.quantity_kind,'user');
 assert.equal(JSON.stringify(p.items),before);
 assert.equal(C.material_catalog.find(m=>m.id==='anyag-029').unit_price,null);
 assert.equal(C.material_catalog.find(m=>m.id==='anyag-029').per_unit,13);
});
test('explicit 0 ár nem hiányzó, de megköveteli az árforrást',()=>{
 let csv=D.template(C.material_catalog);csv=replaceRow(csv,'anyag-029',c=>{c[4]='0';c[5]='Saját nulla árteszt';c[6]='2026-10-22';return c});
 const r=D.importMaterialData(csv,C.material_catalog,E);
 assert.equal(r.entries.find(m=>m.id==='anyag-029').unit_price,0);
 assert.equal(D.audit(C.rows,r.entries,C.norm_catalog).missingPrices,69);
});
test('ismert anyag azonosítójának átnevezése vagy egységcsere tiltott',()=>{
 for(const idx of [1,2,3]){
  let csv=replaceRow(D.template(C.material_catalog),'anyag-029',c=>{c[idx]='hibás';c[4]='11';c[5]='Árlista';c[6]='2026-10-22';return c});
  assert.throws(()=>D.importMaterialData(csv,C.material_catalog,E),/eltér/);
 }
});
test('hiányzó árforrás, fiktív dátum és negatív ár elutasítva',()=>{
 for(const edit of [c=>{c[4]='10'},c=>{c[4]='10';c[5]='Árlista';c[6]='2026-02-31'},c=>{c[4]='-1';c[5]='Árlista';c[6]='2026-10-22'}]){
  const csv=replaceRow(D.template(C.material_catalog),'anyag-029',edit);
  assert.throws(()=>D.importMaterialData(csv,C.material_catalog,E));
 }
});
test('a fajlagos csak alkalmazási feltételekkel és dátummal tölthető be',()=>{
 let csv=replaceRow(D.template(C.material_catalog),'anyag-029',c=>{c[7]='15';c[8]='Mérés';c[9]='2026-10-22';return c});
 assert.throws(()=>D.importMaterialData(csv,C.material_catalog,E),/alkalmazási feltételek/);
 csv=replaceRow(csv,'anyag-029',c=>{c[10]='15 mm';return c});
 assert.equal(D.importMaterialData(csv,C.material_catalog,E).ratios,1);
});
test('sérült CSV-t nem fogad el (azonosítóismétlés, extra oszlop, üres kitöltés)',()=>{
 const baseCsv=D.template(C.material_catalog);
 assert.throws(()=>D.importMaterialData(baseCsv,C.material_catalog,E),/nem tartalmaz/);
 const full=replaceRow(baseCsv,'anyag-029',c=>{c[4]='20';c[5]='Tesztár';c[6]='2026-10-22';return c});
 const repeated=full+full.split('\r\n').find(s=>s.includes('"anyag-029"'))+'\r\n';
 assert.throws(()=>D.importMaterialData(repeated,C.material_catalog,E),/Ismétlődő/);
 assert.throws(()=>D.importMaterialData(full.replace('"anyag-029"','"idegen"'),C.material_catalog,E),/Ismeretlen/);
 assert.throws(()=>D.importMaterialData(full.replace('"anyag-029"','"anyag-029";"extra"'),C.material_catalog,E),/oszlopszám/);
});
test('új gyártói MPI 25 adatlap url ismert és a norma nem módosult',()=>{
 const m=C.material_catalog.find(m=>m.id==='anyag-029');assert.equal(m.per_unit,13);assert.ok(m.quantity_source.includes('pds_mpi_25_bhu_hu_12834.pdf'));assert.equal(C.norm_catalog.find(n=>n.id==='norma-epulet-vakolat-1').norm,null);
});

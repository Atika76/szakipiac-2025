// Every price, labor norm and manual yield below is SYNTHETIC, not market data.
const E=require('../epulet-szamitas.js'),C=require('../epulet-teteladatok.js');
function fixture(){
 const p=E.tradeSample(C);p.project_name='SZINTETIKUS TESZT – hat új munkanem';
 p.narrative.notes='Kizárólag mesterséges számolási példa. Nem piaci ár, nem ellenőrzött munkanorma, nem valódi házajánlat.';
 const ids=['epulet-aljzat-5','epulet-vakolat-1','epulet-homlokzat-1','epulet-karton-1','epulet-karton-2','epulet-burkolat-2','epulet-burkolat-3','epulet-festes-2','epulet-festes-3'];
 p.items=ids.map((id,i)=>{
  let r=E.applyComponentTemplate(E.fromCatalog(C.rows.find(r=>r.id===id)),C);r.qty=10;
  const n={id:'norma-teszt-'+i,name:r.name,trade:r.budget.trade,unit:r.unit,norm:0.5,kind:'user',source:'SZINTETIKUS TESZT – nem hiteles munkanorma',updated:'2026-10-22',applicability:'Kizárólag automatizált számolási próba'};
  p.building_budget.norm_catalog.push(n);r=E.applyNorm(r,n);r.budget.quantity_source='Szintetikus felmérés';
  r.budget.components=r.budget.components.map((c,j)=>{
   const m={...c,id:'anyag-teszt-'+i+'-'+j,per_unit:j+1,unit_price:(j+1)*100,waste_percent:5,rounding:'none',price_kind:'user',source:'SZINTETIKUS TESZT – nem piaci ár',updated:'2026-10-22',quantity_source:'SZINTETIKUS TESZT – nem gyártói fajlagos',quantity_updated:'2026-10-22',manufacturer:'Tesztgyártó',supplier:'Tesztbeszállító',applicability:'Mesterséges tesztadat'};
   p.building_budget.material_catalog.push(m);return E.materialSnapshot(m,r.unit,c.id);
  });return r;
 });
 p.building_budget.settings={...E.defaults(),rate:2000,trade_rates:{karton:3000,burkolat:0},rate_includes_overhead:true};p.items[4].budget.rate=4000;
 return p;
}
module.exports={fixture};

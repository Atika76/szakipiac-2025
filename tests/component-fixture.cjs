// Deliberately synthetic test prices/yields. No market or manufacturer claim.
const E=require('../epulet-szamitas.js'),C=require('../epulet-teteladatok.js');
function fixture(){
 const p=E.componentSample(C);p.project_name='SZINTETIKUS TESZT – három összetevős munkatétel';
 p.narrative.notes='Minden ár, fajlagos és munkanorma szintetikus tesztadat, valós ajánlathoz nem használható.';
 const definitions=[['epulet-alap-1',2,[1,80,0.5],[30000,200,500],[5,5,10]],['epulet-fal-1',10,[16,2.5,0.5],[100,20,0],[5,10,0]],['epulet-teto-4',10,[12,2,0.2],[250,50,1000],[8,5,0]]];
 p.items=definitions.map(([id,qty,coefficients,prices,waste],index)=>{
  const row=E.applyComponentTemplate(E.fromCatalog(C.rows.find(r=>r.id===id)),C);row.qty=qty;row.mat_unit_price=999999;
  Object.assign(row.budget,{material_factor:7,norm:0.5,norm_kind:'user',rate:2000,norm_source:'SZINTETIKUS TESZT',norm_updated:'2026-10-21',quantity_source:'Szintetikus felmérés',source:'SZINTETIKUS TESZT',updated:'2026-10-21',price_kind:'user'});
  if(index===1)Object.assign(row.budget,{machine:20,transport:30,extra:10});
  row.budget.components.forEach((c,i)=>{delete c.geometry_key;Object.assign(c,{per_unit:coefficients[i],unit_price:prices[i],waste_percent:waste[i],source:'SZINTETIKUS TESZT – nem piaci ár',updated:'2026-10-21',price_kind:'user',quantity_source:'SZINTETIKUS TESZT – nem gyártói norma',quantity_updated:'2026-10-21',use_geometry_waste:false});});
  return row;
 });return p;
}
module.exports={fixture};

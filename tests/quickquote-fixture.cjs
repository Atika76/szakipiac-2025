// SYNTHETIC prices, yields and 0.8 h/unit norms. Never a real construction quote.
const E=require('../epulet-szamitas.js'),C=require('../epulet-teteladatok.js'),Q=require('../epulet-gyorsajanlat-mag.js');
const definitions=[['epulet-alap-1',{mode:'volume',length:10,width:0.5,depth:0.4}],['epulet-fal-1',{mode:'wall',length:5,height:3,openings:5}],['epulet-teto-4',{mode:'area',length:5,width:2}],['epulet-vakolat-1',{mode:'wall',length:10,height:3,openings:5}],['epulet-burkolat-2',{mode:'area',length:5,width:4}]];
function setup(){
 const p=E.tradeSample(C);p.items=[];p.project_name='SZINTETIKUS GYORSAJÁNLAT – öt munkanem';p.narrative.notes='Minden ár, fajlagos és normaidő mesterséges tesztadat. A 0,8 óra/egység nem igazolt munkanorma. Nem piaci ajánlat és nem házár.';
 p.building_budget.settings={...E.defaults(),rate:Q.OFFICIAL_RATE,rate_includes_overhead:true};p.building_budget.rate_reference=Q.reference();
 for(const m of p.building_budget.material_catalog)Object.assign(m,{unit_price:100,per_unit:1,waste_percent:5,rounding:m.unit==='db'?'up':'none',price_kind:'user',source:'SZINTETIKUS TESZT – 100 Ft nem piaci ár',updated:'2026-10-22',quantity_source:'SZINTETIKUS TESZT – 1 nem gyártói fajlagos',quantity_updated:'2026-10-22',applicability:'Kizárólag mesterséges számolási próba'});
 const rows=definitions.map(([id])=>C.rows.find(r=>r.id===id)),header=Q.normTemplate(rows).split('\r\n')[0],cell=x=>'"'+String(x).replaceAll('"','""')+'"';
 const csv=header+'\r\n'+rows.map(r=>[r.id,r.megnevezes,r.egyseg,'0,8','user','SZINTETIKUS TESZT – nem dokumentált munkanorma','2026-10-22','Kizárólag számolási próba'].map(cell).join(';')).join('\r\n')+'\r\n';
 return{payload:p,normCsv:csv,definitions};
}
function fixture(){const{payload:p,normCsv}=setup();p.building_budget.norm_catalog=Q.importNorms(normCsv,C.rows,E,p.building_budget.norm_catalog).entries;p.items=definitions.map(([id,input])=>Q.draftRow(C.rows.find(r=>r.id===id),input,E,C,p.building_budget.material_catalog,p.building_budget.norm_catalog));return p;}
module.exports={setup,fixture};

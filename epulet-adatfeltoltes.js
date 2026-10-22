// SzakiPiac PRO+ – offline, ellenőrizhető szakmai katalógusadat-feltöltés.
// A beolvasott lista NEM tekinthető önmagában igazolt piaci árnak vagy munkanormának.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SzakiPiacDataIntake=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const HEADERS=['anyag_id','anyag_neve','anyagegyseg','munka_bazisegyseg','netto_ar_ft','ar_forrasa','ar_datuma','fajlagos','fajlagos_forrasa','fajlagos_datuma','alkalmazasi_feltetelek'];
const clone=x=>JSON.parse(JSON.stringify(x));
const cell=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
const sep=rows=>'\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n')+'\r\n';
function parse(text){
 if(typeof text!=='string'||text.length>2000000)throw Error('A katalógus CSV legfeljebb 2 MB lehet.');
 const result=[],row=[];let v='',quoted=false,start=true;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){
   if(quoted&&text[i+1]==='"'){v+='"';i++;}
   else if(!quoted&&v!=='')throw Error('Érvénytelen CSV idézőjel.');
   else quoted=!quoted;
  }else if(!quoted&&(c===';'||c==='\n'||c==='\r')){
   row.push(v);v='';start=false;
   if(c===';')continue;
   if(c==='\r'&&text[i+1]==='\n')i++;
   if(row.some(x=>x!==''))result.push(row.slice());
   row.length=0;start=true;
  }else v+=c;
 }
 if(quoted)throw Error('Lezáratlan CSV idézőjel.');
 if(v!==''||row.length){row.push(v);if(row.some(x=>x!==''))result.push(row.slice());}
 if(!result.length)throw Error('Üres anyagkatalógus CSV.');
 return result;
}
function template(materials){
 if(!Array.isArray(materials))throw Error('Anyagkatalógus szükséges.');
 return sep([HEADERS,...materials.map(m=>[m.id,m.name,m.unit,m.basis_unit,'','','','','','',''])]);
}
function date(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const x=new Date(value+'T00:00:00Z');return Number.isFinite(x.getTime())&&x.toISOString().slice(0,10)===value;
}
function num(raw,E,label){const value=E.number(raw,label);if(value==null)throw Error(label+': számérték hiányzik.');return value;}
function importMaterialData(text,materials,E){
 if(!Array.isArray(materials)||typeof E?.registry!=='function')throw Error('Érvénytelen anyagkatalógus.');
 const rows=parse(text);
 if(JSON.stringify(rows[0])!==JSON.stringify(HEADERS))throw Error('Nem megfelelő anyagár/fajlagos CSV-fejléc.');
 const existing=new Map(materials.map(m=>[m.id,m]));const updated=new Map(materials.map(m=>[m.id,clone(m)])),seen=new Set();
 let prices=0,ratios=0;
 for(const r of rows.slice(1)){
  if(r.length!==HEADERS.length)throw Error('Hibás oszlopszám az anyagadat-fájlban.');
  const [id,name,unit,basis,rawPrice,pSource,pDate,rawRatio,qSource,qDate,conditions]=r;
  const old=existing.get(id);
  if(!old)throw Error('Ismeretlen anyagazonosító: '+id);
  if(seen.has(id))throw Error('Ismétlődő anyagazonosító: '+id);seen.add(id);
  if(name!==old.name||unit!==old.unit||basis!==old.basis_unit)throw Error('Az anyagnév vagy mértékegység eltér: '+id+' – ellenőrizd a terméket.');
  const next=updated.get(id);
  if(rawPrice!==''){
   if(!pSource.trim()||!date(pDate))throw Error('Az új nettó anyagárhoz árforrás és valós dátum kötelező: '+id);
   next.unit_price=num(rawPrice,E,'Nettó ár');next.price_kind='user';next.source=pSource.trim();next.updated=pDate;prices++;
  }else if(pSource||pDate)throw Error('Ár nélkül ne adj meg árforrást vagy dátumot: '+id);
  if(rawRatio!==''){
   if(!qSource.trim()||!date(qDate)||!conditions.trim())throw Error('A fajlagoshoz forrás, valós dátum és alkalmazási feltételek kötelezők: '+id);
   next.per_unit=num(rawRatio,E,'Fajlagos');next.quantity_kind='user';next.quantity_source=qSource.trim();next.quantity_updated=qDate;next.applicability=conditions.trim();ratios++;
  }else if(qSource||qDate||conditions)throw Error('Fajlagos nélkül ne adj meg új fajlagosforrást/feltételt: '+id);
 }
 if(!prices&&!ratios)throw Error('A CSV nem tartalmaz kitöltött árat vagy fajlagost.');
 return {entries:E.registry([...updated.values()],'material'),prices,ratios};
}
function audit(rows,materials,norms){
 const m=materials||[],n=norms||[],defs=rows||[];
 const nmap=new Map(n.map(x=>[x.id,x]));
 return {
  totalMaterials:m.length,missingPrices:m.filter(x=>x.unit_price==null).length,missingRatios:m.filter(x=>x.per_unit==null).length,
  totalNormSlots:n.length,missingNormSlots:n.filter(x=>x.norm==null).length,
  totalWorkItems:defs.length,missingWorkNorms:defs.filter(x=>{
    const norm=nmap.get('norma-'+x.id);return !norm||norm.norm==null||norm.unit!==x.egyseg;
  }).length
 };
}
return {HEADERS,template,importMaterialData,audit};
});

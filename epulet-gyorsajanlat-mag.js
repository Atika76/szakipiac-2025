(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SzakiPiacQuickQuote = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  // A magyar jogszabály szerinti 2026-os *ajánlott legkisebb* nettó rezsióradíj.
  const OFFICIAL_RATE = 7830;
  const RATE_SINCE = '2026-07-16';
  const RATE_SOURCE = 'https://njt.jog.gov.hu/jogszabaly/2026-4-20-9J';
  // Explicit links for the original 14 templates; no fuzzy name matching.
  const MATERIAL_LINKS = {
  "epulet-alap-1": {
    "beton": "anyag-001",
    "acel": "anyag-002",
    "huzal": "anyag-003"
  },
  "epulet-alap-2": {
    "beton": "anyag-001",
    "acel": "anyag-002",
    "huzal": "anyag-003"
  },
  "epulet-fal-1": {
    "elem": "anyag-004",
    "kotoanyag": "anyag-005",
    "kapcsolat": "anyag-006"
  },
  "epulet-fal-2": {
    "elem": "anyag-004",
    "kotoanyag": "anyag-005",
    "kapcsolat": "anyag-006"
  },
  "epulet-teto-1": {
    "fa": "anyag-007",
    "kapocselem": "anyag-008",
    "favedelem": "anyag-009"
  },
  "epulet-teto-2": {
    "folia": "anyag-010",
    "szalag": "anyag-011"
  },
  "epulet-teto-3": {
    "tetolet": "anyag-012",
    "ellenlet": "anyag-013",
    "rogzito": "anyag-014"
  },
  "epulet-teto-4": {
    "fedoelem": "anyag-015",
    "rogzito": "anyag-016",
    "kiegeszito": "anyag-017"
  },
  "epulet2-alap-1": {
    "beton": "anyag-001",
    "acel": "anyag-002",
    "huzal": "anyag-003"
  },
  "epulet2-alap-2": {
    "beton": "anyag-001",
    "acel": "anyag-002",
    "huzal": "anyag-003"
  },
  "epulet2-fal-1": {
    "elem": "anyag-004",
    "kotoanyag": "anyag-005",
    "kapcsolat": "anyag-006"
  },
  "epulet2-fal-2": {
    "elem": "anyag-004",
    "kotoanyag": "anyag-005",
    "kapcsolat": "anyag-006"
  },
  "epulet2-teto-1": {
    "fedoelem": "anyag-015",
    "rogzito": "anyag-016",
    "kiegeszito": "anyag-017"
  },
  "epulet2-teto-2": {
    "lemez": "anyag-018",
    "csavar": "anyag-019",
    "szegely": "anyag-020"
  }
};
  const reference = () => ({rate:OFFICIAL_RATE,source:RATE_SOURCE,valid_from:RATE_SINCE,checked_on:"2026-10-22",kind:"official_recommended_minimum"});
  const round6 = x => Math.round((x + Number.EPSILON) * 1e6) / 1e6;
  function pos(raw, label) {
    if (raw == null || String(raw).trim() === '') throw Error(label + ': adj meg pozitív méretet.');
    const n = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0 || n > 1e7) throw Error(label + ': érvénytelen vagy túl nagy méret.');
    return n;
  }
  function measure(input) {
    if (!input || typeof input !== 'object') throw Error('Nincs felmérési adat.');
    const unit=String(input.unit||'').trim(), mode=input.mode||'direct';
    let quantity, source;
    if(mode==='direct') { quantity=pos(input.quantity,'Mennyiség'); source='Közvetlenül felmért: '+quantity+' '+unit; }
    else if(mode==='area') {
      if(unit!=='m²') throw Error('Hossz × szélesség csak m² munkatételhez használható.');
      const l=pos(input.length,'Hossz'),w=pos(input.width,'Szélesség');quantity=l*w;source='Felmérés: '+l+' m × '+w+' m';
    } else if(mode==='wall') {
      if(unit!=='m²') throw Error('Falfelület csak m² munkatételhez használható.');
      const l=pos(input.length,'Falhossz'),h=pos(input.height,'Magasság'),gross=l*h;
      const holes=input.openings==null||String(input.openings).trim()===''?0:Number(String(input.openings).replace(',','.'));
      if(!Number.isFinite(holes)||holes<0||holes>=gross)throw Error('A nyílások területe nem lehet negatív vagy nagyobb/egyenlő a falfelülettel.');
      quantity=gross-holes;source='Felmérés: '+l+' m × '+h+' m − '+holes+' m² nyílás';
    } else if(mode==='volume') {
      if(unit!=='m³')throw Error('Térfogatszámítás csak m³ munkatételhez használható.');
      const l=pos(input.length,'Hossz'),w=pos(input.width,'Szélesség'),d=pos(input.depth,'Mélység');quantity=l*w*d;source='Felmérés: '+l+' m × '+w+' m × '+d+' m';
    } else if(mode==='linear') {
      if(!['m','fm'].includes(unit))throw Error('Hossz csak m vagy fm munkatételhez használható.');
      quantity=pos(input.length,'Hossz');source='Felmért hossz: '+quantity+' m';
    } else throw Error('Ismeretlen mennyiségszámítási mód.');
    if(!Number.isFinite(quantity)||quantity<=0||quantity>1e9)throw Error('A munkamennyiség túl nagy vagy hibás.');
    return {quantity:round6(quantity),source};
  }
  function modes(unit) {
    const result=[{value:'direct',label:'Mért mennyiség megadása'}];
    if(unit==='m²')result.push({value:'area',label:'Hossz × szélesség'}, {value:'wall',label:'Falhossz × magasság − nyílások'});
    if(unit==='m³')result.push({value:'volume',label:'Hossz × szélesség × mélység'});
    if(['m','fm'].includes(unit))result.push({value:'linear',label:'Mért hossz'});
    return result;
  }
  function draftRow(def, input, E, catalog, materials, norms) {
    if (!def || !def.id || !E || !catalog) throw Error('Előbb válassz munkatételt.');
    const m=measure({...input,unit:def.egyseg});
    let row=E.fromCatalog(def);
    row.qty=m.quantity;
    row.budget.quantity_source=m.source;
    if(catalog.component_templates?.[def.id] || def.budget_defaults?.components) {
      if(catalog.component_templates?.[def.id])row=E.applyComponentTemplate(row,catalog);
      row.budget.components=row.budget.components.map(c=>{
        const materialId=c.material_id||MATERIAL_LINKS[def.id]?.[c.id];
        if(!materialId)return c;
        const material=(materials||[]).find(x=>x.id===materialId);
        if(!material)return c;
        if(material.unit!==c.unit||material.basis_unit!==row.unit)throw Error('Nem egyezik az anyagkatalógus és a sablon egysége: '+c.name);
        const quantityLocked=c.quantity_locked_to_work===true;
        return {...c,name:typeof material.product_name==='string'?material.product_name:c.name,material_id:materialId,waste_percent:material.waste_percent,rounding:material.rounding,use_geometry_waste:false,
          // Only sourced catalog values replace the material's saved snapshot;
          // never overwrite the template's documented geometric quantity with null.
          unit_price:material.unit_price,price_kind:material.price_kind,
          source:material.source,updated:material.updated,
          manufacturer:material.manufacturer||c.manufacturer,
          supplier:material.supplier||c.supplier,
          per_unit:quantityLocked?c.per_unit:material.per_unit??c.per_unit,
          quantity_source:!quantityLocked&&material.per_unit!=null?(material.quantity_source||''):c.quantity_source,
          quantity_updated:!quantityLocked&&material.per_unit!=null?material.quantity_updated:c.quantity_updated,
          applicability:material.applicability||c.applicability,
          ...Object.fromEntries(['quantity_kind','order_multiple','minimum_order'].map(key=>[key,key==='quantity_kind'&&quantityLocked?c[key]:material[key]??c[key]]).filter(([,value])=>value!=null))
        };
      });
    }
    // A stable ID alone cannot prove the work technology: all identity fields must match.
    const norm=(norms||[]).find(n=>E.normMatchesWork(n,def));
    if(norm&&norm.norm!=null)row=E.applyNorm(row,norm);
    return row;
  }
  const NORM_HEADERS=['tetel_id','megnevezes','mertekegyseg','norma_ora_per_egyseg','eredet','forras','datum','alkalmazasi_feltetelek'];
  function csvCell(v){const t=String(v??'');return '"'+t.replace(/"/g,'""')+'"';}
  function normTemplate(rows){
    return '\ufeff'+[NORM_HEADERS,...rows.map(r=>[r.id,r.megnevezes,r.egyseg,'','','','',''])].map(row=>row.map(csvCell).join(';')).join('\r\n')+'\r\n';
  }
  function readSeparated(text){
    if(typeof text!=='string'||text.length>2e6)throw Error('A norma CSV túl nagy.');
    let t=text.replace(/^\uFEFF/,''),rows=[],row=[],value='',quoted=false;
    for(let i=0;i<t.length;i++){
      const x=t[i];
      if(x==='"'){
        if(quoted&&t[i+1]==='"'){value+='"';i++;}
        else if(!quoted && value!=='')throw Error('Hibás CSV idézőjelezés.');
        else quoted=!quoted;
      }else if(!quoted&&(x===';'||x==='\n'||x==='\r')){
        row.push(value);value='';
        if(x===';')continue;
        if(x==='\r'&&t[i+1]==='\n')i++;
        if(row.some(c=>c!==''))rows.push(row);
        row=[];
      }else value+=x;
    }
    if(quoted)throw Error('Lezáratlan CSV idézőjel.');
    if(value!==''||row.length){row.push(value);if(row.some(c=>c!==''))rows.push(row);}
    if(!rows.length)throw Error('Üres normakatalógus CSV.');
    return rows;
  }
  function importNorms(text,rows,E,existing){
    const table=readSeparated(text);
    if(JSON.stringify(table[0])!==JSON.stringify(NORM_HEADERS))throw Error('A normatáblázat fejléce nem megfelelő.');
    const names=new Map(rows.map(r=>[r.id,r]));const updated=new Map((existing||[]).map(n=>[n.id,n]));const used=new Set();
    let count=0;
    for(const columns of table.slice(1)){
      if(columns.length!==NORM_HEADERS.length)throw Error('A norma CSV egy sora hibás oszlopszámú.');
      const [id,name,unit,raw,kind,source,date,applicability]=columns;
      const def=names.get(id);
      if(!def)throw Error('Ismeretlen munkatétel-azonosító: '+id);
      if(used.has(id))throw Error('Ismétlődő munkatétel a norma CSV-ben: '+id);used.add(id);
      if(unit!==def.egyseg||name!==def.megnevezes)throw Error('Eltérő munkatétel vagy mértékegység: '+id);
      if(raw==='')continue; // missing norm is not zero; 0 is allowed but not typical
      if(!['user','verified'].includes(kind))throw Error('Normaeredet: user vagy verified szükséges ('+id+').');
      if(!source.trim()||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('Norma forrása és érvényes dátuma kötelező: '+id);
      const norm=E.number(raw,'Normaidő');if(norm==null)throw Error('Normaidő hiányzik: '+id);
      const n=E.normEntry({id:'norma-'+id,name:def.megnevezes,unit:def.egyseg,trade:def.szakag,norm,kind,source,updated:date,applicability});
      updated.set(n.id,n);count++;
    }
    if(!count)throw Error('A fájl nem tartalmaz kitöltött normaidőt.');
    return {entries:E.registry([...updated.values()],'norm',rows),count};
  }
  return {OFFICIAL_RATE,RATE_SINCE,RATE_SOURCE,reference,measure,modes,draftRow,normTemplate,importNorms};
});

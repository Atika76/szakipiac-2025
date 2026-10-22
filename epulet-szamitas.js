(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SzakiPiacBuilding = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
  function number(value, label = 'Érték') {
    if (value == null || String(value).trim() === '') return null;
    const n = typeof value === 'number' ? value : Number(String(value).replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 1e9) throw Error(label + ': 0 és 1 milliárd közötti szám szükséges.');
    return n;
  }
  function required(value, label) {
    const n = number(value, label); if (n == null || n <= 0) throw Error(label + ': pozitív érték szükséges.'); return n;
  }
  function money(value) {
    if (!Number.isFinite(value) || Math.abs(value) > 1e14) throw Error('A számított költség túl nagy. Ellenőrizd a mennyiséget és az egységárat.');
    return round(value);
  }
  const defaults = () => ({ rate: null, overhead_percent: 0, profit_percent: 0, reserve_percent: 0, discount: 0, vat_percent: 27 });
  function settings(input = {}) {
    const result = defaults();
    for (const k of Object.keys(result)) if (Object.hasOwn(input, k)) result[k] = number(input[k], k);
    for (const k of ['overhead_percent','profit_percent','reserve_percent','vat_percent']) {
      if (result[k] == null || result[k] > 100) throw Error('A százalék 0–100 közötti szám legyen.');
    }
    if (result.discount == null) result.discount = 0;
    if(input.trade_rates!=null){
      if(typeof input.trade_rates!=='object'||Array.isArray(input.trade_rates))throw Error('Hibás szakági óradíjlista.');
      result.trade_rates={};
      for(const [trade,value] of Object.entries(input.trade_rates)){
        if(!/^[a-z][a-z0-9_-]{0,60}$/.test(trade)||['constructor','prototype'].includes(trade))throw Error('Hibás szakági óradíjazonosító.');
        if(value!=null&&!['number','string'].includes(typeof value))throw Error('Hibás szakági óradíj.');
        result.trade_rates[trade]=number(value,'Szakági óradíj');
      }
    }
    if(input.rate_includes_overhead!=null){
      if(typeof input.rate_includes_overhead!=='boolean')throw Error('Hibás rezsióradíj-jelölés.');
      result.rate_includes_overhead=input.rate_includes_overhead;
      if(result.rate_includes_overhead&&result.overhead_percent>0)throw Error('Az óradíj már tartalmazza a rezsit; külön rezsiszázalék nem számolható fel.');
    }
    return result;
  }
  function resolvedRate(item,opts={}) {
    const own=number(item.budget?.rate,'Egyedi óradíj'),trade=number(opts.trade_rates?.[item.budget?.trade],'Szakági óradíj');
    return own!=null?{value:own,kind:'item'}:trade!=null?{value:trade,kind:'trade'}:{value:number(opts.rate,'Közös óradíj'),kind:'common'};
  }
  function normEntry(input) {
    if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Hibás normakatalógus-adat.');
    const n=copy(input);
    for(const key of ['id','name','unit','trade','kind','source','updated','applicability'])if(n[key]!=null&&typeof n[key]!=='string')throw Error('Hibás normamező: '+key);
    if(!n.id?.trim()||!n.name?.trim()||!n.unit?.trim())throw Error('Normaazonosító, név és bázisegység szükséges.');
    if(!['unknown','user','verified','derived'].includes(n.kind))throw Error('Ismeretlen normaeredet.');
    if(n.norm!=null&&!['number','string'].includes(typeof n.norm))throw Error('Hibás normaidő.');
    n.norm=number(n.norm,'Normaidő');
    if(n.kind==='verified'&&(n.norm==null||!n.source?.trim()||!n.updated?.trim()))throw Error('Ellenőrzött normához érték, forrás és dátum kell.');
    return n;
  }
  function materialEntry(input) {
    if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Hibás anyagkatalógus-adat.');
    const m=copy(input);componentCost(m,null,m.basis_unit);
    for(const key of ['manufacturer','supplier','applicability','quantity_kind','material_id'])if(m[key]!=null&&typeof m[key]!=='string')throw Error('Hibás anyagmező: '+key);
    if(!m.basis_unit?.trim())throw Error('Anyagfajlagos bázisegysége szükséges.');
    return m;
  }
  function normMatchesWork(norm,work) {
    return norm.id==='norma-'+work.id && norm.name===work.megnevezes && norm.trade===work.szakag && norm.unit===work.egyseg;
  }
  function registry(input,kind,workRows=[]) {
    if(!Array.isArray(input)||input.length>1000)throw Error('Legfeljebb 1000 katalógusadat menthető típusonként.');
    const works=new Map(workRows.map(row=>['norma-'+row.id,row]));
    const ids=new Set();return input.map(row=>{
      const r=kind==='material'?materialEntry(row):normEntry(row);
      if(ids.has(r.id))throw Error('Ismétlődő katalógusazonosító.');
      const work=kind==='norm'&&works.get(r.id);
      if(work&&!normMatchesWork(r,work))throw Error('Eltérő munkatételnév, szakág vagy mértékegység a stabil normaazonosítóhoz: '+r.id+'. Más technológiához hozz létre új saját normát.');
      ids.add(r.id);return r;
    });
  }
  // Copy-on-use: calculations never resolve a live catalog price or norm.
  function materialSnapshot(entry,workUnit,id) {
    const m=materialEntry(entry);if(m.basis_unit!==workUnit)throw Error('Az anyag fajlagosának bázisegysége nem egyezik. Nincs automatikus egységátváltás.');
    delete m.geometry_key;delete m.use_geometry_waste;
    return {...m,id,material_id:m.id,use_geometry_waste:false};
  }
  function applyNorm(input,entry) {
    const item=adopt(input),n=normEntry(entry);
    if(item.unit!==n.unit)throw Error('A normaidő bázisegysége nem egyezik a munkatétel egységével.');
    Object.assign(item.budget,{norm:n.norm,norm_kind:n.kind,norm_source:n.source||'',norm_updated:n.updated||'',norm_unit:n.unit,norm_id:n.id,norm_applicability:n.applicability||''});return item;
  }
  function fromCatalog(row) {
    const item = { name: row.megnevezes, unit: row.egyseg, type: row.tipus || 'anyag', qty: null,
      mat_unit_price: row.anyag_atlag ?? null, lab_unit_price: row.munka_atlag ?? null, hours: 0, selected: false,
      budget: { id: row.id, trade: row.szakag, norm: row.norma_ora_atlag ?? null, norm_kind: row.norm_kind || 'unknown',
        rate: row.budget_defaults?.rate ?? null, material_factor: row.budget_defaults?.material_factor ?? 1, machine: row.budget_defaults?.machine ?? 0, transport: row.budget_defaults?.transport ?? 0, extra: row.budget_defaults?.extra ?? 0, source: row.forras || '', updated: row.frissitve || '',
        price_kind: row.price_kind || 'legacy_reference', norm_source: row.norm_source || '', norm_updated: row.norm_updated || '',
        quantity_source: '', materials: [] } };
    if (row.budget_defaults?.components) {
      Object.assign(item.budget, {material_mode:row.budget_defaults.material_mode||'aggregate',component_version:1,components:copy(row.budget_defaults.components)});
    }
    for(const k of ['norm_unit','norm_id','norm_applicability'])if(row.budget_defaults?.[k]!=null)item.budget[k]=row.budget_defaults[k];
    return item;
  }
  function componentCost(component, workQuantity, workUnit) {
    const c=component;
    if (!c || typeof c!=='object' || Array.isArray(c)) throw Error('Hibás anyagösszetevő.');
    for (const key of ['id','name','unit','basis_unit','source','updated','price_kind','quantity_source','quantity_updated','geometry_key','material_id','manufacturer','supplier','applicability','quantity_kind']) {
      if(c[key]!=null && typeof c[key]!=='string')throw Error('Hibás összetevőmező: '+key);
    }
    if(!c.id?.trim() || !c.name?.trim() || !c.unit?.trim())throw Error('Összetevőazonosító, megnevezés és mértékegység szükséges.');
    if(c.basis_unit!==workUnit)throw Error('Az összetevő fajlagosának bázisegysége eltér a munkatétel egységétől. Nincs automatikus egységátváltás.');
    if(!['none','up'].includes(c.rounding))throw Error('Ismeretlen összetevő-kerekítés.');
    if(c.use_geometry_waste!=null && typeof c.use_geometry_waste!=='boolean')throw Error('Hibás geometriai tartalékkapcsoló.');
    if(c.geometry_key!=null && !['steel_kg_m3','blocks_per_m2','mortar_per_m2','tiles_per_m2','timber_m3_m2'].includes(c.geometry_key))throw Error('Ismeretlen geometriai fajlagos.');
    const numeric=(v,label)=>{if(v!=null && !['number','string'].includes(typeof v))throw Error('Hibás szám: '+label);return number(v,label);};
    const per=numeric(c.per_unit,'Anyagfajlagos'),price=numeric(c.unit_price,'Összetevő egységára'),waste=numeric(c.waste_percent,'Összetevő tartaléka');
    const multiple=numeric(c.order_multiple,'Rendelési lépcső')??0,minimum=numeric(c.minimum_order,'Minimum rendelés')??0;
    if(waste!=null&&waste>100)throw Error('Az összetevő tartaléka 0–100% legyen.');
    const issues=[];
    if(workQuantity==null)issues.push('Munkamennyiség hiányzik');
    if(per==null)issues.push('Anyagfajlagos hiányzik');
    if(price==null)issues.push('Anyagegységár hiányzik');
    if(waste==null)issues.push('Anyagtartalék hiányzik');
    if(!c.quantity_source?.trim())issues.push('Fajlagos forrása hiányzik');
    if(!['user','verified'].includes(c.price_kind))issues.push('Ár eredete nincs jóváhagyva');
    if(!c.source?.trim()||!c.updated?.trim())issues.push('Ár forrása vagy dátuma hiányzik');
    const quantity=v=>{if(!Number.isFinite(v)||v>1e14)throw Error('Túl nagy anyagmennyiség.');return Math.round((v+Number.EPSILON)*1e6)/1e6;};
    const netRaw=workQuantity==null||per==null?null:workQuantity*per;
    const net=netRaw==null?null:quantity(netRaw);
    const requestedRaw=netRaw==null||waste==null?null:netRaw*(1+waste/100);
    if(requestedRaw!=null)quantity(requestedRaw);
    let ordered=requestedRaw==null?null:c.rounding==='up'?Math.max(0,Math.ceil(requestedRaw-Number.EPSILON*Math.max(1,requestedRaw))):quantity(requestedRaw);
    if(ordered>0){
      ordered=Math.max(ordered,minimum);
      if(multiple>0){const packs=ordered/multiple;ordered=quantity(Math.ceil(packs-Number.EPSILON*Math.max(1,packs))*multiple);}
      quantity(ordered);
    }
    const cost=ordered==null||price==null?null:money(ordered*price);
    return {netQuantity:net,quantity:ordered,cost,issues,complete:issues.length===0};
  }
  function componentCosts(item) {
    const b=item.budget;
    if(b.component_version!==1)throw Error('Ismeretlen anyagösszetevő-fájlverzió.');
    if(!Array.isArray(b.components)||b.components.length>100)throw Error('Legfeljebb 100 anyagösszetevő kezelhető tételenként.');
    const ids=new Set(),qty=number(item.qty,'Mennyiség');
    return b.components.map(c=>{if(ids.has(c?.id))throw Error('Ismétlődő anyagösszetevő-azonosító.');ids.add(c?.id);return componentCost(c,qty,item.unit);});
  }
  function applyComponentTemplate(input, catalog, geo=null) {
    const item=adopt(input),template=catalog.component_templates?.[item.budget.id];
    if(!template)throw Error('Ehhez a tételhez nincs összetevősablon. Saját összetevők megadhatók.');
    if(template.some(c=>c.basis_unit!==item.unit))throw Error('A sablon bázisegysége eltér a munkatétel egységétől. Nincs automatikus egységátváltás.');
    item.budget.material_mode='components';item.budget.component_version=1;
    item.budget.components=copy(template).map(c=>({...c,basis_unit:item.unit,
      per_unit:c.geometry_key&&geo?number(geo[c.geometry_key]):c.per_unit,
      waste_percent:geo?number(geo.waste)??0:c.waste_percent,use_geometry_waste:!!geo}));
    componentCosts(item);return item;
  }
  function updateComponentGeometry(input, geo) {
    const item=adopt(input);
    if(item.budget.material_mode!=='components')return item;
    item.budget.components=item.budget.components.map(c=>({...c,
      per_unit:c.geometry_key?number(geo[c.geometry_key]):c.per_unit,
      waste_percent:c.use_geometry_waste?number(geo.waste)??0:c.waste_percent}));
    componentCosts(item);return item;
  }
  function adopt(item) {
    if (item.budget) return copy(item);
    return { ...copy(item), budget: { id: '', trade: 'jarulekos', norm: item.norms?.atlag ?? item.norm_ora_atlag ?? null,
      norm_kind: 'unknown', rate: null, material_factor: 1, machine: 0, transport: 0, extra: 0,
      source: item.source || 'Korábbi ajánlatsor; felülvizsgálat szükséges', updated: item.updated_at || '', price_kind: 'legacy_reference',
      norm_source: '', norm_updated: '', quantity_source: 'Korábbi ajánlat', materials: [] } };
  }
  function lineCost(input, opts) {
    const item = adopt(input), b = item.budget, issues = [];
    if(b.material_mode!=null&&!['aggregate','components'].includes(b.material_mode))throw Error('Ismeretlen anyagszámítási mód.');
    const detailed=b.material_mode==='components',components=detailed?componentCosts(item):[];
    const qty = number(item.qty, 'Mennyiség'), mat = detailed?null:number(item.mat_unit_price, 'Anyagegységár');
    const norm = number(b.norm, 'Normaidő'), rateInfo=resolvedRate(item,opts),rate=rateInfo.value;
    if(b.norm_unit!=null&&b.norm_unit!==item.unit)throw Error('A normaidő bázisegysége eltér a munkatétel egységétől.');
    if (!String(item.name || '').trim()) issues.push('Megnevezés hiányzik');
    if (!String(item.unit || '').trim()) issues.push('Mértékegység hiányzik');
    if (qty == null) issues.push('Mennyiség hiányzik');
    if (!detailed && mat == null) issues.push('Anyagegységár hiányzik');
    if(detailed&&!components.length)issues.push('Legalább egy anyagösszetevő szükséges');
    components.forEach((c,i)=>c.issues.forEach(s=>issues.push(b.components[i].name+': '+s)));
    if (norm == null) issues.push('Normaidő hiányzik');
    if (norm !== 0 && rate == null) issues.push('Óradíj hiányzik');
    if (b.norm_kind === 'derived') issues.push('Munkadíjból visszaszámított becslés, nem ellenőrzött norma');
    else if (!['user','verified'].includes(b.norm_kind)) issues.push('Norma eredete nincs jóváhagyva');
    if (b.norm_kind === 'verified' && (!b.norm_source || !b.norm_updated)) issues.push('Ellenőrzött normához forrás és dátum kell');
    if (!detailed && b.price_kind !== 'user' && b.price_kind !== 'verified') issues.push('Ár hiányzik vagy régi, nem újraellenőrzött referencia');
    if (!detailed && (!b.source || !b.updated)) issues.push('Ár forrása vagy dátuma hiányzik');
    if (!b.quantity_source || /mintafeltevés/i.test(b.quantity_source)) issues.push('Mennyiség helyszíni/tervi ellenőrzése szükséges');
    const materials = Array.isArray(b.materials) ? b.materials : [];
    if(!detailed)materials.forEach(m => { if (m.qty == null) issues.push('Anyagigény megadandó: ' + m.name); else number(m.qty, m.name); });
    const materialFactor = detailed?1:Object.hasOwn(b,'material_factor') ? number(b.material_factor, 'Anyagfajlagos-szorzó') : 1;
    if(!detailed&&materialFactor==null)issues.push('Anyagfajlagos-szorzó hiányzik');
    const materialQuantity = detailed?null:money((qty ?? 0) * (materialFactor ?? 0));
    const material = detailed?money(components.reduce((n,c)=>n+(c.cost??0),0)):money((qty ?? 0) * (materialFactor ?? 0) * (mat ?? 0));
    const rawHours=(qty??0)*(norm??0);
    if(!Number.isFinite(rawHours)||rawHours>1e14)throw Error('Túl nagy számított munkaóra.');
    const hours = Math.round((rawHours+Number.EPSILON)*1e6)/1e6;
    const labor = money((qty ?? 0) * (norm ?? 0) * (rate ?? 0));
    const machine = money((qty ?? 0) * (number(b.machine, 'Gép egységköltség') ?? 0));
    const transport = money((qty ?? 0) * (number(b.transport, 'Szállítás egységköltség') ?? 0));
    const extra = money((qty ?? 0) * (number(b.extra, 'Egyéb egységköltség') ?? 0));
    const total=money(material+labor+machine+transport+extra),vat=money(total*(opts.vat_percent??27)/100);
    return { material, materialQuantity,materialMode:detailed?'components':'aggregate',components, labor, hours,rate,rateKind:rateInfo.kind, machine, transport, extra, total,vat,gross:money(total+vat), issues, complete: !issues.length };
  }
  function calculate(rows, input = {}) {
    const opts = settings(input);
    if (!Array.isArray(rows) || rows.length > 2000) throw Error('Legfeljebb 2000 munkatétel kezelhető.');
    const lines = rows.map(row => lineCost(row, opts));
    const sum = key => money(lines.reduce((n, l) => n + l[key], 0));
    const material = sum('material'), labor = sum('labor'), machine = sum('machine'), transport = sum('transport'), extra = sum('extra');
    const direct = money(material + labor + machine + transport + extra);
    const overhead = money(direct * opts.overhead_percent / 100);
    const base = money(Math.max(0, direct + overhead - opts.discount));
    const profit = money(base * opts.profit_percent / 100);
    const reserve = money((base + profit) * opts.reserve_percent / 100);
    const net = money(base + profit + reserve), vat = money(net * opts.vat_percent / 100);
    return { lines, material, labor, machine, transport, extra, direct, overhead, profit, reserve, net, vat, gross: money(net + vat),
      hours: Math.round((lines.reduce((n,l)=>n+l.hours,0)+Number.EPSILON)*1e6)/1e6, complete: lines.length > 0 && lines.every(l => l.complete), missingCount: lines.filter(l => !l.complete).length };
  }
  function geometry(input) {
    const v = copy(input), length = required(v.length, 'Épülethossz'), width = required(v.width, 'Épületszélesség');
    const height = required(v.height, 'Falmagasság'), footingLength = required(v.footing_length, 'Korrigált alaphossz');
    const footingWidth = required(v.footing_width, 'Alapszélesség'), footingDepth = required(v.footing_depth, 'Alapmélység');
    const slab = required(v.slab_thickness, 'Lemezvastagság'), overhang = number(v.overhang, 'Ereszkiülés') ?? 0;
    const pitch = number(v.pitch, 'Tető hajlásszöge'); if (pitch == null || pitch >= 80) throw Error('Tetőhajlás: 0–80° közötti érték kell.');
    const openings = number(v.openings, 'Nyílások') ?? 0, grossWall = 2 * (length + width) * height;
    if (openings > grossWall) throw Error('A nyílásfelület nem lehet nagyobb a falfelületnél.');
    const waste = number(v.waste, 'Anyagtartalék') ?? 0; if (waste > 100) throw Error('Anyagtartalék: legfeljebb 100%.');
    const factor = 1 + waste / 100;
    const floor = length * width, footing = footingLength * footingWidth * footingDepth, wall = grossWall - openings;
    const roof = (length + 2 * overhang) * (width + 2 * overhang) / Math.cos(pitch * Math.PI / 180);
    const blocks = number(v.blocks_per_m2, 'Falazóelem db/m²'), mortar = number(v.mortar_per_m2, 'Habarcs kg/m²');
    const steel = number(v.steel_kg_m3, 'Terv szerinti betonacél kg/m³'), tiles = number(v.tiles_per_m2, 'Fedőelem db/m²');
    const timber = number(v.timber_m3_m2, 'Terv szerinti faanyag m³/m²');
    const m = (name, qty, unit, formula) => ({ name, qty: qty == null ? null : money(qty), unit, formula, source: 'Szerkeszthető geometria / felhasználói kiadósság; gyártói és statikai ellenőrzés kell' });
    return { floor: money(floor), wall: money(wall), roof: money(roof), footing: money(footing), slab: money(floor * slab),
      foundationMaterials: [m('Alapbeton rendelési mennyisége', footing * factor, 'm³', 'alaphossz × szélesség × mélység × tartalék'), m('Betonacél, terv szerinti fajlagossal', steel == null ? null : footing * steel * factor, 'kg', 'nettó alapbeton × terv szerinti kg/m³ × tartalék')],
      wallMaterials: [m('Falazóelem', blocks == null ? null : Math.ceil(wall * blocks * factor), 'db', 'nettó fal × db/m² × tartalék, felfelé kerekítve'), m('Falazóhabarcs', mortar == null ? null : wall * mortar * factor, 'kg', 'nettó fal × megadott kg/m² × tartalék')],
      roofMaterials: [m('Tetőfólia tájékoztató rendelési felülete', roof * factor, 'm²', 'tetősík felülete × megadott átfedési/tartalék tényező'), m('Fedőelem', tiles == null ? null : Math.ceil(roof * tiles * factor), 'db', 'tetősík × megadott db/m² × tartalék'), m('Szerkezeti faanyag', timber == null ? null : roof * timber * factor, 'm³', 'tetősík × terv szerinti m³/m² × tartalék')],
      notice: 'Egyszerű téglalap alaprajz, szimmetrikus nyeregtető. Nem statikai méretezés; csomópontok, áttörések, tetőablakok és összetett tetőformák külön felmérendők.' };
  }
  const sampleGeometry = () => ({ length: 12, width: 10, height: 2.8, openings: 24, footing_length: 56, footing_width: 0.5, footing_depth: 0.8, slab_thickness: 0.15,
    pitch: 35, overhang: 0.5, waste: 5, blocks_per_m2: null, mortar_per_m2: null, steel_kg_m3: null, tiles_per_m2: null, timber_m3_m2: null });
  function geometryRows(input, catalog) {
    const g = geometry(input), make = (id, qty, materials, key) => {
      const found = catalog.find(r => r.id === id); if (!found) throw Error('Hiányzó saját tétel: ' + id);
      const row = fromCatalog(found); row.qty = qty; row.budget.materials = materials; row.budget.calc_key = key; row.budget.material_factor = 1 + (number(input.waste) ?? 0) / 100;
      row.budget.quantity_source = 'Mintafeltevés / szerkeszthető geometria; terv szerint ellenőrizendő'; return row;
    };
    return [make('epulet-alap-1', g.footing, g.foundationMaterials, 'foundation'), make('epulet-fal-1', g.wall, g.wallMaterials, 'wall'), make('epulet-teto-1', g.roof, g.roofMaterials.filter(m => m.unit === 'm³'), 'roof-structure'),
      make('epulet-teto-2', g.roof, g.roofMaterials.filter(m => m.unit === 'm²'), 'roof-underlay'), make('epulet-teto-4', g.roof, g.roofMaterials.filter(m => m.unit === 'db'), 'roof-covering')];
  }
  function sample(catalog) {
    const geo = sampleGeometry(), rows = geometryRows(geo, catalog.rows);
    for (const trade of catalog.trades) {
      if (rows.some(r => r.budget.trade === trade.id)) continue;
      const row = fromCatalog(catalog.rows.find(r => r.szakag === trade.id));
      row.budget.quantity_source = 'Mintafeltevés: felmérés szükséges'; rows.push(row);
    }
    const floor = fromCatalog(catalog.rows.find(r => r.id === 'epulet-aljzat-2'));
    floor.qty = geometry(geo).slab; floor.budget.quantity_source = 'Mintafeltevés: 120 m² × 0,15 m'; rows.push(floor);
    return { project_name: '120 m² földszintes családi ház – HIÁNYOS MINTA', currency: 'HUF', client: {}, settings: { vat_enabled: true, vat_rate: 27, material_margin: 0, overhead_rate: 0, profit_percent: 0 },
      items: rows, narrative: { notes: 'Szerkeszthető mintafeltevés, nem terv vagy kulcsrakész ajánlat. Minden szakág további részletezést igényel. Árak és munkanormák megadandók.' },
      building_budget: { schema_version: 1, enabled: true, settings: defaults(), geometry: geo, custom_catalog: [], is_sample: true } };
  }
  function componentSample(catalog) {
    const p=sample(catalog);
    p.project_name='120 m² családi ház – ÖSSZETEVŐS, HIÁNYOS MINTA';
    p.items=p.items.map(item=>item.budget.calc_key&&catalog.component_templates?.[item.budget.id]?applyComponentTemplate(item,catalog,p.building_budget.geometry):item);
    p.narrative.notes+=' A fajlagosok és az árak megadandók. Az összetevős sorokban a korábbi összesített anyagár és anyagszorzó nem számítódik hozzá.';
    return p;
  }
  function validatePayload(input, catalog) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Projektobjektum szükséges.');
    const p = copy(input), b = p.building_budget;
    // Validate the shared/legacy fields too, before either editor mutates state.
    const object = (v, label) => {
      if (v != null && (typeof v !== 'object' || Array.isArray(v))) throw Error('Hibás objektum: ' + label);
    };
    const text = (v, label) => {
      if (v != null && typeof v !== 'string') throw Error('Hibás szöveg: ' + label);
    };
    const numeric = (v, label) => {
      if (v != null && !['number','string'].includes(typeof v)) throw Error('Hibás szám: ' + label);
      number(v, label);
    };
    for (const key of ['project_name','currency']) text(p[key], key);
    for (const key of ['client','settings','narrative']) object(p[key], key);
    for (const key of ['name','email','phone','city','address']) text(p.client?.[key], 'client.' + key);
    for (const key of ['intro','scope','notes']) text(p.narrative?.[key], 'narrative.' + key);
    for (const key of ['overhead_rate','profit_percent','discount_net','vat_rate','material_margin','global_qty']) numeric(p.settings?.[key], 'settings.' + key);
    text(p.settings?.global_unit, 'settings.global_unit');
    if (p.settings?.vat_enabled != null && typeof p.settings.vat_enabled !== 'boolean') throw Error('Hibás áfakapcsoló.');
    if (p.items != null && (!Array.isArray(p.items) || p.items.length > 2000)) throw Error('Hibás tétellista.');
    for (const item of p.items || []) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw Error('Hibás tétel.');
      for (const key of ['name','unit','type']) text(item[key], 'item.' + key);
      for (const key of ['qty','mat_unit_price','lab_unit_price','hours']) numeric(item[key], 'item.' + key);
      if (item.budget != null) {
        object(item.budget, 'item.budget');
        for (const key of ['id','trade','norm_kind','price_kind','source','updated','norm_source','norm_updated','norm_unit','norm_id','norm_applicability','quantity_source','calc_key']) text(item.budget[key], 'budget.' + key);
        for (const key of ['norm','rate','material_factor','machine','transport','extra']) numeric(item.budget[key], 'budget.' + key);
        if(item.budget.material_mode!=null&&!['aggregate','components'].includes(item.budget.material_mode))throw Error('Ismeretlen anyagszámítási mód.');
        if(item.budget.components!=null || item.budget.material_mode==='components')componentCosts(item);
        const materials=item.budget.materials;
        if (materials != null && (!Array.isArray(materials) || materials.length>1000)) throw Error('Hibás anyaglista.');
        for (const material of materials || []) {
          if (!material || typeof material!=='object' || Array.isArray(material)) throw Error('Hibás anyagtétel.');
          for (const key of ['name','unit','formula','source']) text(material[key], 'material.' + key);
          numeric(material.qty, 'material.qty');
        }
      }
    }
    if((p.items||[]).some(item=>item.budget?.material_mode==='components')&&b?.enabled!==true)throw Error('Az összetevős sorokhoz aktív részletes költségvetési formátum szükséges.');
    if (!b) return p;
    object(b, 'building_budget');
    if (b.schema_version !== 1 || typeof b.enabled !== 'boolean') throw Error('Ismeretlen költségvetés-fájlverzió.');
    if (!Array.isArray(p.items) || p.items.length > 2000) throw Error('Hibás tétellista.');
    b.settings = settings(b.settings);
    if(b.rate_reference!=null){
      object(b.rate_reference,'rate_reference');
      for(const k of ['source','valid_from','checked_on','kind']){text(b.rate_reference[k],'rate_reference.'+k);if(!b.rate_reference[k]?.trim())throw Error('Hiányos óradíj-referencia.');}
      numeric(b.rate_reference.rate,'rate_reference.rate');if(number(b.rate_reference.rate)==null)throw Error('Hiányzó referencia-óradíj.');
    }
    for(const trade of Object.keys(b.settings.trade_rates||{}))if(!catalog.trades.some(t=>t.id===trade))throw Error('Ismeretlen szakági óradíj.');
    if(b.registry_version!=null&&b.registry_version!==1)throw Error('Ismeretlen anyag- és normakatalógus-verzió.');
    for(const [key,kind] of [['material_catalog','material'],['norm_catalog','norm']])if(b[key]!=null){if(b.registry_version!==1)throw Error('Katalógusverzió szükséges.');b[key]=registry(b[key],kind);}
    for(const n of b.norm_catalog||[])if(!catalog.trades.some(t=>t.id===n.trade))throw Error('Ismeretlen normaszakág.');
    if (!Array.isArray(b.custom_catalog) || b.custom_catalog.length > 500) throw Error('Legfeljebb 500 saját tétel menthető.');
    const customIds = new Set();
    for (const row of b.custom_catalog) {
      if (typeof row.id !== 'string' || !row.id.startsWith('sajat-') || customIds.has(row.id)) throw Error('Hibás vagy ismétlődő saját tételazonosító.');
      customIds.add(row.id);
      if (!String(row.megnevezes || '').trim() || !catalog.trades.some(t => t.id === row.szakag)) throw Error('Hibás saját tétel.');
      lineCost(fromCatalog(row), b.settings);
    }
    // Validate catalog identities, never rewrite a saved quote row's norm snapshot.
    if(b.norm_catalog!=null)b.norm_catalog=registry(b.norm_catalog,'norm',[...catalog.rows,...b.custom_catalog]);
    for (const item of p.items) {
      if (!item || typeof item !== 'object' || String(item.name || '').length > 1000) throw Error('Hibás tétel.');
      if (item.budget && !catalog.trades.some(t => t.id === item.budget.trade)) throw Error('Ismeretlen szakág.');
    }
    calculate(p.items.filter(i => String(i.name || '').trim()), b.settings);
    if (b.geometry) geometry(b.geometry);
    return p;
  }
  function csv(payload, catalog) {
    const p = validatePayload(payload, catalog), s = p.building_budget?.settings || defaults(), t = calculate(p.items, s);
    const cell = v => { let text = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? 'MEGADANDÓ'); if (/^\s*[=+@\-\t\r]/.test(text)) text = "'" + text; return '"' + text.replace(/"/g, '""') + '"'; };
    const records = [['SzakiPiac részletes költségvetés', p.project_name, t.complete ? 'Kitöltött becslés' : 'HIÁNYOS TERVEZET – NEM VÉGÖSSZEG'],
      ['Szakág','Tétel','Mennyiség','Egység','Anyagegységár','Anyagfajlagos-szorzó','Norma óra/egység','Óradíj','Anyag nettó','Munka nettó','Gép nettó','Szállítás nettó','Egyéb nettó','Ismert részösszeg','Árforrás','Ár dátuma','Norma eredete','Norma forrása','Norma dátuma','Hiányok','Anyagszámítási mód','Közvetlen bruttó tétel projektszintű felárak nélkül']];
    records[1].push('Számított munkaóra','Óradíj szintje','Norma bázisegysége','Normaazonosító','Norma alkalmazhatósága');
    p.items.forEach((item, i) => { const b = adopt(item).budget, l = t.lines[i]; records.push([catalog.trades.find(x => x.id === b.trade)?.name || b.trade, item.name, item.qty, item.unit, l.materialMode==='components'?null:item.mat_unit_price, l.materialMode==='components'?null:b.material_factor ?? 1, b.norm, l.rate, l.material, l.labor, l.machine, l.transport, l.extra, l.total, b.source, b.updated, b.norm_kind, b.norm_source, b.norm_updated, l.issues.join('; '), l.materialMode==='components'?'Összetevőkből; a régi ár és szorzó nem számít':'Összesített egységárból', l.gross,item.qty==null||b.norm==null?null:l.hours,l.rateKind,b.norm_unit||item.unit,b.norm_id||'',b.norm_applicability||'']); });
    records.push([],['Ismert nettó részösszeg',t.net],['Áfa az ismert részre',t.vat],['Ismert bruttó részösszeg',t.gross],['Külön rezsi',t.overhead],['Haszon',t.profit],['Pénzügyi tartalék',t.reserve]);
    records.push([],['Anyagkimutatás','Mennyiség','Egység','Képlet / feltevés']);
    p.items.filter(item=>item.budget?.material_mode!=='components').forEach(item => (item.budget?.materials || []).forEach(m => records.push([item.name + ' / ' + m.name, m.qty, m.unit, m.formula])));
    records.push([],['Anyagösszetevők – csak az összetevős mód aktív sorai'],['Munkatétel','Anyag','Munkamennyiség','Munkatétel egysége','Fajlagos','Anyagegység','Nettó anyagigény','Tartalék %','Rendelési mennyiség','Nettó egységár','Ismert anyagköltség','Árforrás','Ár dátuma','Fajlagos forrása','Fajlagos dátuma','Hiányok']);
    records[records.length-1].push('Anyagazonosító','Gyártó','Beszállító','Alkalmazhatóság','Kerekítés','Rendelési lépcső','Minimum rendelés');
    p.items.forEach((item,index)=>{if(t.lines[index].materialMode!=='components')return;item.budget.components.forEach((c,i)=>{const cost=t.lines[index].components[i];records.push([item.name,c.name,item.qty,item.unit,c.per_unit,c.unit,cost.netQuantity,c.waste_percent,cost.quantity,c.unit_price,cost.cost,c.source,c.updated,c.quantity_source,c.quantity_updated,cost.issues.join('; '),c.material_id||'',c.manufacturer||'',c.supplier||'',c.applicability||'',c.rounding,c.order_multiple??0,c.minimum_order??0]);});});
    records.push([],['Óradíjak rezsit tartalmaznak',s.rate_includes_overhead==null?'Régi beállítás, külön ellenőrizendő':s.rate_includes_overhead?'Igen':'Nem'],['Közös rezsióradíj',s.rate]);
    for(const [trade,rate] of Object.entries(s.trade_rates||{}))records.push(['Szakági rezsióradíj',trade,rate]);
    if(p.building_budget?.rate_reference){const r=p.building_budget.rate_reference;records.push(['Mentett óradíj-referencia',r.rate,r.source,r.valid_from,r.checked_on,r.kind]);}
    records.push([],['Újrahasználható anyagkatalógus – ajánlatárakat nem frissít automatikusan'],['Azonosító','Név','Egység','Nettó egységár','Árforrás','Ár dátuma','Gyártó','Beszállító','Fajlagos','Bázisegység','Fajlagos forrása','Fajlagos dátuma','Tartalék %','Kerekítés','Alkalmazhatóság']);
    records[records.length-1].push('Rendelési lépcső','Minimum rendelés');
    for(const m of p.building_budget?.material_catalog||[])records.push([m.id,m.name,m.unit,m.unit_price,m.source,m.updated,m.manufacturer,m.supplier,m.per_unit,m.basis_unit,m.quantity_source,m.quantity_updated,m.waste_percent,m.rounding,m.applicability,m.order_multiple??0,m.minimum_order??0]);
    records.push([],['Újrahasználható normakatalógus'],['Azonosító','Név','Szakág','Normaidő óra/egység','Bázisegység','Eredet','Forrás','Dátum','Alkalmazhatóság']);
    for(const n of p.building_budget?.norm_catalog||[])records.push([n.id,n.name,n.trade,n.norm,n.unit,n.kind,n.source,n.updated,n.applicability]);
    return '\ufeff' + records.map(r => r.map(cell).join(';')).join('\r\n');
  }
  function tradeSample(catalog) {
    const p=componentSample(catalog),selected=[['epulet-aljzat-3',120],['epulet-aljzat-4',120],['epulet-aljzat-5',120],['epulet-vakolat-1',200],['epulet-homlokzat-1',99.2],['epulet-karton-1',30],['epulet-karton-2',120],['epulet-burkolat-2',40],['epulet-burkolat-3',80],['epulet-festes-2',320],['epulet-festes-3',320]];
    const trades=new Set(selected.map(([id])=>catalog.rows.find(r=>r.id===id).szakag));
    p.items=p.items.filter(r=>!trades.has(r.budget.trade));
    for(const [id,qty] of selected){const r=applyComponentTemplate(fromCatalog(catalog.rows.find(r=>r.id===id)),catalog);r.qty=qty;r.budget.quantity_source='Mintafeltevés: kézzel kiosztott, tervből ellenőrizendő mennyiség';p.items.push(r);}
    Object.assign(p.building_budget,{registry_version:1,material_catalog:copy(catalog.material_catalog),norm_catalog:copy(catalog.norm_catalog)});
    p.building_budget.settings={...defaults(),rate_includes_overhead:true,trade_rates:{}};
    p.project_name='120 m² családi ház – több szakágas, HIÁNYOS munkaminta';
    p.narrative.notes+=' Aljzatrétegek 120 m²; vakolat 200 m²; gipszkarton fal 30 m²; mennyezet 120 m²; burkolat 40+80 m²; glett és festés 320 m². Ezek nem alaprajzból felmért mennyiségek. Az összetett homlokzati sor tartalmazza az alapréteget és színezést; ezeket külön újra ne számold fel. Árak és munkanormák MEGADANDÓK.';
    return p;
  }
  return { number, round, defaults, settings, resolvedRate,materialEntry,normEntry,normMatchesWork,registry,materialSnapshot,applyNorm,tradeSample,fromCatalog, adopt, lineCost, componentCost, componentCosts, applyComponentTemplate, updateComponentGeometry, calculate, geometry, sampleGeometry, geometryRows, sample, componentSample, validatePayload, csv, copy };
});

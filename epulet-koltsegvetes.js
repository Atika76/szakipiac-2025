(function () {
  'use strict';
  const E = window.SzakiPiacBuilding, base = window.SzakiPiacBuildingCatalog, Q = window.SzakiPiacQuickQuote, D = window.SzakiPiacDataIntake;
  if (!E || !base || !Q || !D || typeof items === 'undefined') return;
  const $b = id => document.getElementById(id), esc = escapeHtml;
  const state = { enabled:false, settings:E.defaults(), geometry:E.sampleGeometry(), custom_catalog:[], is_sample:false,registry_version:null,material_catalog:null,norm_catalog:null,rate_reference:null };
  let selected = -1;
  let generateButtonBefore = null;
  const today = () => new Date().toISOString().slice(0,10);
  const named = () => items.filter(i => String(i.name || '').trim());
  const money = n => $b('currency').value==='HUF'?Number(n).toLocaleString('hu-HU',{maximumFractionDigits:2})+' Ft':fmtMoney(n,$b('currency').value);
  const amount = n => n == null ? 'MEGADANDÓ' : Number(n).toLocaleString('hu-HU', {maximumFractionDigits:6});
  const phase = id => base.trades.find(t => t.id === id)?.name || 'Egyéb';
  const normLabels = {unknown:'Ismeretlen',derived:'Munkadíjból visszaszámított becslés',user:'Felhasználói munkanorma',verified:'Forrással ellenőrzött munkanorma'};
  const fail = error => { $b('buildingError').textContent = error.message || String(error); $b('buildingError').hidden=false; toast(error.message || String(error), 'error'); };
  const run = fn => { try { $b('buildingError').textContent = ''; return fn(); } catch (error) { fail(error); } };
  const field = (id,label,value,type='number') => `<label>${esc(label)}<input id="${id}" type="${type}" ${type==='number'?'min="0" step="any"':''} value="${esc(String(value ?? ''))}"></label>`;
  function catalog() {
    const rows = new Map(base.rows.map(r => [r.id, {...r}]));
    const mapping = {szerkezet:'alap',festo:'festes',acs:'teto',vakolas:'vakolat',burkolo:'burkolat',laminalt:'burkolat'};
    for (const row of window.SzakiPiacPriceCatalog?.all() || []) {
      const trade = mapping[row.szakag] || row.szakag;
      if (!base.trades.some(t => t.id === trade)) continue;
      rows.set(row.id, {...row,szakag:trade,price_kind:'legacy_reference',norm_kind:row.norma_ora_atlag>0?'derived':'unknown',norm_source:'Online epitoipari_arak; ellenőrzött normaforrás nincs igazolva'});
    }
    state.custom_catalog.forEach(r => rows.set(r.id, r)); return [...rows.values()];
  }
  function snapshot() { const s={schema_version:1,...E.copy(state)};for(const k of ['registry_version','material_catalog','norm_catalog','rate_reference'])if(s[k]==null)delete s[k];return s; }
  const materials=()=>state.material_catalog??base.material_catalog;
  const norms=()=>state.norm_catalog??base.norm_catalog;
  function saveRegistry(kind,entry){
    const key=kind==='material'?'material_catalog':'norm_catalog',next=E.copy(kind==='material'?materials():norms()),index=next.findIndex(r=>r.id===entry.id);
    if(index<0)next.push(entry);else next[index]=entry;
    const checked=E.registry(next,kind,catalog());
    atomicRegistryUpdate({registry_version:1,material_catalog:kind==='material'?checked:E.copy(materials()),norm_catalog:kind==='norm'?checked:E.copy(norms())});
    toast('Katalógus mentve a projektbe. A meglévő ajánlatsorok pillanatképei változatlanok.');
  }
  function atomicRegistryUpdate(changes) {
    // Durable render failure must never partially replace reusable catalogs.
    const previous={state:E.copy(state),items,selected,generateButtonBefore}, controls=[...document.querySelectorAll('input,select,textarea')].filter(e=>e.type!=='file').map(e=>({node:e,value:e.value,checked:e.checked}));
    const watcher=new MutationObserver(()=>{});
    watcher.observe(document.body,{subtree:true,childList:true,attributes:true,attributeOldValue:true,characterData:true,characterDataOldValue:true});
    try { Object.assign(state,changes);renderLibraries();renderEditor();render(); }
    catch(error){
      Object.assign(state,previous.state);items=previous.items;selected=previous.selected;generateButtonBefore=previous.generateButtonBefore;
      const records=watcher.takeRecords();watcher.disconnect();
      try { for(const change of records.reverse()) {
        if(change.type==='childList'){
          for(const node of change.addedNodes)if(node.parentNode===change.target)change.target.removeChild(node);
          const next=change.nextSibling?.parentNode===change.target?change.nextSibling:null;
          for(const node of change.removedNodes)change.target.insertBefore(node,next);
        } else if(change.type==='attributes'){
          if(change.oldValue===null)change.target.removeAttribute(change.attributeName);
          else change.target.setAttribute(change.attributeName,change.oldValue);
        } else if(change.type==='characterData')change.target.data=change.oldValue;
      }} finally {for(const c of controls){c.node.value=c.value;if(c.checked!==undefined)c.node.checked=c.checked;}}
      throw error;
    } finally {watcher.disconnect();}
  }
  function budgetTotal() { return E.calculate(named(), state.settings); }
  const panel = document.createElement('section'); panel.id='buildingPanel'; panel.className='building-box no-print';
  panel.innerHTML=`<h2>Teljes épület részletes költségvetése – PRO+ munkaváltozat</h2><p>A meglévő ajánlat tételeit használja. Nincs külön program vagy kötelező naplókapcsolat.</p>
    <div id="buildingError" role="alert" aria-live="polite" class="building-warning" hidden></div>
    <button id="buildingEnable" type="button">Részletes mód bekapcsolása</button>
    <div id="buildingContent" hidden>
      <div class="building-warning">Tervezet: a hiányzó ár, mennyiség vagy norma nem nulla költséget jelent. A részösszegek csak a megadott adatokat tartalmazzák. A régi referencia és a munkadíjból becsült norma külön ellenőrzendő.</div>
      <section class="building-quick" id="buildingQuick"><h3>⚡ Gyors árajánlat – 3 lépés</h3>
        <p class="building-muted">Válaszd ki a munkát, add meg a felmért méreteket. A program kiszámolja a mennyiséget, anyagot és munkaórát <b>ha az ellenőrzött ár és normaidő már szerepel az adattárban</b>. Hiányzó adatból soha nem készül végleges ár.</p>
        <div class="building-grid"><label>1. Szakág<select id="quickTrade"><option value="">Minden szakág</option>${base.trades.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
        <label>Munkafolyamat keresése<input id="quickSearch" type="search" placeholder="pl. vakolás, burkolás, betonozás"></label>
        <label class="building-wide">2. Munkatétel<select id="quickItem"></select></label>
        <label>Mennyiség meghatározása<select id="quickMethod"></select></label>
        <label id="quickQuantityLabel">Mennyiség<input id="quickQuantity" type="number" min="0" step="any" placeholder="Pl. 100"></label>
        <label id="quickLengthLabel" hidden>Hossz (m)<input id="quickLength" type="number" min="0" step="any"></label>
        <label id="quickWidthLabel" hidden>Szélesség (m)<input id="quickWidth" type="number" min="0" step="any"></label>
        <label id="quickHeightLabel" hidden>Magasság (m)<input id="quickHeight" type="number" min="0" step="any"></label>
        <label id="quickDepthLabel" hidden>Mélység (m)<input id="quickDepth" type="number" min="0" step="any"></label>
        <label id="quickOpeningsLabel" hidden>Nyílások összesen (m²)<input id="quickOpenings" type="number" min="0" step="any" value="0"></label></div>
        <div id="quickPreview" aria-live="polite" class="building-quick-preview">Válassz munkatételt és add meg a méreteket.</div>
        <button id="quickAdd" type="button">3. Tétel hozzáadása az ajánlathoz</button>
        <p class="building-muted">Az ajánlatban a „Részletek” gombbal ellenőrizheted a normaidőt, anyagösszetevőket és forrásokat.</p>
        <div id="quickOverall" aria-live="polite"></div>
        <div id="quickDataQuality" class="building-warning" aria-live="polite"></div>
        <details><summary>Anyagárak és fajlagosok kötegelt betöltése – szakmailag ellenőrzött CSV</summary>
          <p class="building-muted">A 70 anyaghoz készül üres sablon. A beszállító nettó árait és a gyártói fajlagosokat az anyagazonosító, név és egység változtatása nélkül lehet beolvasni. Kötelező a forrás és dátum, fajlagosnál a rétegvastagság/alkalmazás is. A CSV-ből származó adat <b>felhasználói rögzítés</b>, nem automatikusan ellenőrzött piaci ár. A régi ajánlatpillanatképek nem változnak.</p>
          <button id="quickMaterialTemplate" type="button" class="secondary">70 anyagos kitöltő CSV letöltése</button>
          <label>Forrásolt anyagár/fajlagos CSV beolvasása<input id="quickMaterialImport" type="file" accept=".csv,text/csv"></label>
        </details>
        <details><summary>Normaidők tömeges betöltése – forrással ellátott saját CSV</summary>
          <p class="building-muted">A 188 munkatételhez üres Excel-kompatibilis sablon készül. Csak forrással, dátummal és munkafolyamat-azonosítóval alátámasztott, jogszerűen felhasználható normaidőt tölts be. Semmilyen TERC-norma nincs a fájlban.</p>
          <button id="quickNormTemplate" type="button" class="secondary">Normaidő-sablon CSV letöltése</button>
          <label>Kitöltött normaidő CSV beolvasása<input id="quickNormImport" type="file" accept=".csv,text/csv"></label>
          <p class="building-muted">A betöltés újrahasználható norma-adattárat frissít; a már mentett ajánlatsorok normája nem módosul automatikusan. Az újonnan kiválasztott munkatételeknél azonosító és egység alapján alkalmazzuk.</p>
        </details>
        <p class="building-muted">Hivatalos 2026-os <b>ajánlott legkisebb</b> nettó rezsióradíj: <b>7 830 Ft/óra</b> (2026.07.16-tól). <a href="https://njt.jog.gov.hu/jogszabaly/2026-4-20-9J" target="_blank" rel="noopener noreferrer">Jogszabály</a>. Az új részletes ajánlat ezt kapja kiinduló értéknek, a mentett régi ajánlatok óradíját nem módosítjuk.</p>
      </section>
      <button id="buildingSample" type="button">120 m²-es ház mintaprojektje</button><button id="buildingCsv" type="button" class="secondary">Excel-kompatibilis CSV</button>
      <button id="buildingComponentSample" type="button">120 m² – összetevős anyagkalkuláció</button>
      <button id="buildingTradeSample" type="button">120 m² – több szakágas munkaminta</button>
      <details id="buildingRegistries"><summary>Újrahasználható anyag- és normakatalógus</summary><p class="building-muted">A katalógus a projekt JSON- és felhőmentésének része. Másik projekthez a JSON-ból vihető tovább. A katalógus frissítése nem írja át az ajánlat árait vagy normáit; alkalmazáshoz külön gomb szükséges. A gyártói anyagfajlagos nem munkanorma.</p><div id="buildingLibraries"></div></details>
      <p class="building-muted">Teljes fájlmentéshez a meglévő JSON export/import gombot használd; telefonon is. A saját tételek és a geometria is a fájlba kerülnek. Nincs automatikus böngészőtárolás.</p>
      <details><summary>Költségbeállítások</summary><div id="buildingSettings" class="building-grid"></div><p class="building-muted">Munkadíj = mennyiség × normaidő × nettó óradíj. Gép, szállítás és egyéb díj munkatétel-egységenként adható meg. Külön rezsit csak akkor adj hozzá, ha azt az óradíj nem tartalmazza. A részletes módban ezek a beállítások érvényesek.</p></details>
      <details><summary>Alapozás, falazás és nyeregtető – mennyiségek és anyagigény</summary><div id="buildingGeometry" class="building-grid"></div><button id="buildingCalculate" type="button">Geometria alkalmazása az ajánlatra</button><p class="building-muted">Egyszerű téglalap és szimmetrikus nyeregtető. Az alaphossz csomópontokkal korrigált összesített hossz. A vasalás és faanyag fajlagosa statikai tervből, a falazóelem/habarcs/fedőelem igénye gyártói adatból vagy saját felmérésből adandó meg. Az újraszámítás a saját öt geometriai sort frissíti, nem duplikálja őket.</p></details>
      <h3>Szakági felépítés</h3><div id="buildingPhases" class="building-phases"></div>
      <h3>Kereshető munkatétel-adatbázis</h3><div class="building-grid"><label>Keresés<input id="buildingSearch" type="search" placeholder="Pl. fal, hőszivattyú, beton"></label><label>Szakág<select id="buildingTrade"><option value="">Minden szakág</option>${base.trades.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label></div>
      <p id="buildingCatalogCount" class="building-muted"></p><ul id="buildingCatalog" class="building-catalog-list"></ul>
      <details><summary>Új saját munkatétel</summary><div class="building-grid">${field('buildingCustomName','Megnevezés','','text')}<label>Szakág<select id="buildingCustomTrade">${base.trades.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>${field('buildingCustomUnit','Mértékegység','m²','text')}</div><button id="buildingCustom" type="button">Létrehozás és hozzáadás</button></details>
      <h3>Az ajánlat részletes munkatételei</h3><p class="building-muted">A sor Részletek gombjával megadhatók az árak, normák és források. A 0 kifejezetten nulla költséget jelent; az üres mező hiányzó adat.</p>
      <div class="building-table-wrap"><table class="building-table"><thead><tr><th>Szakág / tétel</th><th>Mennyiség</th><th>Ismert nettó rész</th><th>Állapot</th><th>Művelet</th></tr></thead><tbody id="buildingRows"></tbody></table></div>
      <div id="buildingEditor"></div><div id="buildingSummary" aria-live="polite"></div><div id="buildingMaterials"></div>
    </div>`;
  $b('step2').prepend(panel);
  const print = document.createElement('section'); print.id='buildingPrint'; print.hidden=true; $b('printArea').append(print);
  const printWarning = document.createElement('div'); printWarning.id='buildingPrintWarning'; printWarning.hidden=true; printWarning.className='building-warning'; $b('printArea').prepend(printWarning);
  const legacyTable = $b('itemsBody').closest('table').parentElement, legacyPrintTable = $b('print_items').closest('table').parentElement;
  const originalLabels = new Map();
  for (const id of ['sum_net_total','sum_gross_total','p_sum_net_total','p_sum_gross_total']) {
    const label=$b(id)?.parentElement.firstElementChild; if(label)originalLabels.set(label,label.textContent);
  }
  const extraCostPanels=['sum_lab','p_sum_lab'].map(id=>{const node=document.createElement('div');node.hidden=true;$b(id).parentElement.after(node);return node;});
  const originalOverheadLabels=['sum_overhead','p_sum_overhead'].map(id=>({node:$b(id).parentElement.firstElementChild,text:$b(id).parentElement.firstElementChild.textContent}));
  const settingLabels = {rate:'Közös nettó rezsióradíj (Ft/óra)',overhead_percent:'Külön rezsi (%)',profit_percent:'Haszon (%)',reserve_percent:'Pénzügyi tartalék (%)',discount:'Nettó kedvezmény (Ft)',vat_percent:'Áfa (%)'};
  const geometryLabels = {length:'Épület hossza (m)',width:'Épület szélessége (m)',height:'Falmagasság (m)',openings:'Külső nyílások (m²)',footing_length:'Korrigált összes alaphossz (m)',footing_width:'Alap szélessége (m)',footing_depth:'Alap mélysége (m)',slab_thickness:'Padlólemez vastagsága (m)',pitch:'Tető hajlása (°)',overhang:'Ereszkiülés (m)',waste:'Anyagtartalék / átfedés (%)',blocks_per_m2:'Falazóelem igénye (db/m²)',mortar_per_m2:'Habarcsigény (kg/m²)',steel_kg_m3:'Terv szerinti betonacél (kg/m³)',tiles_per_m2:'Fedőelem igénye (db/m²)',timber_m3_m2:'Terv szerinti faanyag (m³/m²)'};
  function settingsForms() {
    $b('buildingSettings').innerHTML=Object.entries(settingLabels).map(([key,label])=>field('bb-'+key,label,state.settings[key])).join('');
    for(const key of Object.keys(settingLabels)) $b('bb-'+key).onchange=()=>run(()=>{const next=E.settings({...state.settings,[key]:$b('bb-'+key).value}); E.calculate(named(),next);state.settings=next;calcAndRender();renderEditor();});
    $b('buildingSettings').insertAdjacentHTML('beforeend',`<label>Az összes alkalmazott óradíj tartalmazza a rezsit<select id="bb-includes-overhead"><option value="legacy">Régi / nincs még meghatározva</option><option value="yes">Igen – külön rezsi nem adható hozzá</option><option value="no">Nem – külön rezsi megadható</option></select></label><div class="building-wide"><h3>Szakági rezsióradíjak</h3><p class="building-muted">Üres: közös óradíj. Tételenkénti egyedi óradíj mindkettőt felülírja; a 0 megadott nulla érték.</p><div class="building-grid">${base.trades.map(t=>field('bt-'+t.id,t.name+' (Ft/óra)',state.settings.trade_rates?.[t.id])).join('')}</div></div>`);
    $b('bb-includes-overhead').value=state.settings.rate_includes_overhead==null?'legacy':state.settings.rate_includes_overhead?'yes':'no';
    $b('bb-overhead_percent').disabled=state.settings.rate_includes_overhead===true;
    $b('bb-includes-overhead').onchange=()=>run(()=>{const next={...state.settings},v=$b('bb-includes-overhead').value;if(v==='legacy')delete next.rate_includes_overhead;else next.rate_includes_overhead=v==='yes';state.settings=E.settings(next);settingsForms();calcAndRender();});
    for(const t of base.trades)$b('bt-'+t.id).onchange=()=>run(()=>{const next=E.settings({...state.settings,trade_rates:{...state.settings.trade_rates,[t.id]:$b('bt-'+t.id).value}});E.calculate(named(),next);state.settings=next;calcAndRender();renderEditor();});
    $b('buildingGeometry').innerHTML=Object.entries(geometryLabels).map(([key,label])=>field('bg-'+key,label,state.geometry[key])).join('');
  }
  function renderLibraries(){
    const box=$b('buildingLibraries'),oldM=$b('bm-select')?.value||'',oldN=$b('bn-select')?.value||'';
    box.innerHTML=`<h3>Anyagkatalógus (${materials().length} anyag)</h3><label>Keresés<input id="bm-search" type="search"></label><label>Anyag kiválasztása<select id="bm-select"><option value="">Új anyag</option>${materials().map(m=>`<option value="${esc(m.id)}">${esc(m.id+' – '+m.name+' ['+m.unit+']')}</option>`).join('')}</select></label><div id="bm-form"></div><h3>Normakatalógus (${norms().length} normahely; az üres nem ellenőrzött norma)</h3><label>Keresés<input id="bn-search" type="search"></label><label>Norma kiválasztása<select id="bn-select"><option value="">Új norma</option>${norms().map(n=>`<option value="${esc(n.id)}">${esc(n.name+' [óra/'+n.unit+']')}</option>`).join('')}</select></label><div id="bn-form"></div>`;
    $b('bm-select').value=materials().some(m=>m.id===oldM)?oldM:'';$b('bn-select').value=norms().some(n=>n.id===oldN)?oldN:'';
    function materialForm(){
      const selected=materials().find(m=>m.id===$b('bm-select').value),m=selected||{name:'',unit:'kg',basis_unit:'m²',unit_price:null,per_unit:null,waste_percent:0,rounding:'none',price_kind:'missing',quantity_source:'',source:'',updated:'',quantity_updated:'',manufacturer:'',supplier:'',applicability:''};
      const labels={name:'Megnevezés',unit:'Anyagegység',basis_unit:'Fajlagos bázisegysége',unit_price:'Nettó Ft / anyagegység',per_unit:'Anyagegység / munkatétel-egység',waste_percent:'Rendelési tartalék (%)',order_multiple:'Rendelési lépcső (anyagegység, 0: nincs)',minimum_order:'Minimum rendelés (anyagegység)',source:'Árforrás',updated:'Ár dátuma',manufacturer:'Gyártó',supplier:'Beszállító',quantity_source:'Fajlagos forrása',quantity_updated:'Fajlagos dátuma',applicability:'Alkalmazhatóság / rétegvastagság / feltételek'};
      $b('bm-form').innerHTML=`<p>Azonosító: ${esc(selected?.id||'Mentéskor készül')}</p><div class="building-grid">${Object.entries(labels).map(([k,l])=>field('bm-'+k,l,m[k],['unit_price','per_unit','waste_percent','order_multiple','minimum_order'].includes(k)?'number':['updated','quantity_updated'].includes(k)?'date':'text')).join('')}<label>Kerekítés<select id="bm-rounding"><option value="none">Hat tizedesre</option><option value="up">Egészre felfelé</option></select></label></div><button id="bm-save" type="button">Anyag mentése a katalógusba</button>`;
      $b('bm-rounding').value=m.rounding;
      $b('bm-save').onclick=()=>run(()=>{const n={...m,id:selected?.id||'anyag-sajat-'+crypto.randomUUID()};for(const k of Object.keys(labels))n[k]=['unit_price','per_unit','waste_percent','order_multiple','minimum_order'].includes(k)?E.number($b('bm-'+k).value):$b('bm-'+k).value;n.rounding=$b('bm-rounding').value;
        if(n.unit_price!==m.unit_price||n.unit!==m.unit){
          n.price_kind=n.unit_price==null?'missing':'user';
          if(n.source===m.source)n.source=n.unit_price==null?'':'Felhasználó által megadott ár; külső forrás még nincs ellenőrizve';
          if(n.updated===m.updated)n.updated=n.unit_price==null?'':today();
        }
        if(n.unit!==m.unit&&selected&&(n.unit_price!=null||n.per_unit!=null||n.order_multiple>0||n.minimum_order>0))throw Error('Új anyagegységnél előbb ürítsd az árat, a fajlagost és a rendelési lépcsőt/minimumot, majd add meg őket az új egységben.');
        if(n.basis_unit!==m.basis_unit&&selected&&n.per_unit!=null)throw Error('Új bázisegységnél előbb ürítsd a fajlagost.');
        if(n.per_unit!==m.per_unit){
          n.quantity_kind=n.per_unit==null?'unknown':'user';
          // A régi gyártói forrás nem igazolhatja az új, kézzel módosított fajlagost.
          if(n.quantity_source===m.quantity_source)n.quantity_source=n.per_unit==null?'':'Felhasználó által módosított fajlagos; külső forrás még nincs ellenőrizve';
          if(n.quantity_updated===m.quantity_updated)n.quantity_updated=n.per_unit==null?'':today();
        }
        saveRegistry('material',E.materialEntry(n));});
    }
    function normForm(){
      const selected=norms().find(n=>n.id===$b('bn-select').value),n=selected||{name:'',unit:'m²',trade:base.trades[0].id,norm:null,kind:'unknown',source:'',updated:'',applicability:''};
      $b('bn-form').innerHTML=`<p>Azonosító: ${esc(selected?.id||'Mentéskor készül')}</p><div class="building-grid">${field('bn-name','Megnevezés',n.name,'text')}${field('bn-unit','Bázisegység (óra / egység)',n.unit,'text')}${field('bn-norm','Normaidő (óra / egység)',n.norm)}<label>Szakág<select id="bn-trade">${base.trades.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label><label>Eredet<select id="bn-kind">${Object.entries(normLabels).map(([k,l])=>`<option value="${k}">${esc(l)}</option>`).join('')}</select></label>${field('bn-source','Normaforrás',n.source,'text')}${field('bn-updated','Norma dátuma',n.updated,'date')}${field('bn-applicability','Alkalmazhatóság / körülmények',n.applicability,'text')}</div><button id="bn-save" type="button">Norma mentése a katalógusba</button>`;
      $b('bn-trade').value=n.trade;$b('bn-kind').value=n.kind;
      $b('bn-norm').onchange=()=>run(()=>{if(E.number($b('bn-norm').value)!==n.norm){$b('bn-kind').value='user';$b('bn-source').value='Felhasználó által módosított munkanorma';$b('bn-updated').value=today();}});
      $b('bn-save').onclick=()=>run(()=>{const next={...n,id:selected?.id||'norma-sajat-'+crypto.randomUUID()};for(const k of ['name','unit','norm','trade','kind','source','updated','applicability'])next[k]=k==='norm'?E.number($b('bn-'+k).value):$b('bn-'+k).value;if(next.unit!==n.unit&&selected&&next.norm!=null)throw Error('Új normabázisegységnél előbb ürítsd a normaidőt.');saveRegistry('norm',E.normEntry(next));});
    }
    $b('bm-select').onchange=materialForm;$b('bn-select').onchange=normForm;
    for(const prefix of ['bm','bn'])$b(prefix+'-search').oninput=()=>{const q=$b(prefix+'-search').value.toLocaleLowerCase('hu');for(const opt of $b(prefix+'-select').options)opt.hidden=!!opt.value&&!opt.textContent.toLocaleLowerCase('hu').includes(q);};
    materialForm();normForm();
    box.insertAdjacentHTML('afterbegin','<button id="buildingRegistryExport" type="button" class="secondary">Csak anyag- és normakatalógus JSON-mentése</button><label>Katalógus beolvasása másik projektből<input type="file" id="buildingRegistryImport" accept=".json,application/json"></label><p class="building-muted">Azonos azonosítónál a beolvasott katalógusadat váltja a jelenlegit. A munkatételek mentett árai és normái változatlanok.</p>');
    $b('buildingRegistryExport').onclick=()=>run(()=>{const p={format:'szakipiac-resources',registry_version:1,material_catalog:E.copy(materials()),norm_catalog:E.copy(norms())},url=URL.createObjectURL(new Blob([JSON.stringify(p,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='szakipiac-anyag-normakatalogus.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
    $b('buildingRegistryImport').onchange=async event=>{try{
      const contextItems=items,contextEpoch=quoteContextEpoch;const file=event.target.files[0];if(!file)return;if(file.size>10*1024*1024)throw Error('Legfeljebb 10 MB-os katalógus tölthető be.');
      const p=JSON.parse(await file.text());if(p.format!=='szakipiac-resources'||p.registry_version!==1)throw Error('Ismeretlen katalógusfájl.');
      const ms=E.registry(p.material_catalog,'material'),ns=E.registry(p.norm_catalog,'norm',catalog());for(const n of ns)if(!base.trades.some(t=>t.id===n.trade))throw Error('Ismeretlen normaszakág.');
      const merge=(old,rows,kind)=>E.registry([...new Map([...old,...rows].map(r=>[r.id,r])).values()],kind,catalog());
      const nextM=merge(materials(),ms,'material'),nextN=merge(norms(),ns,'norm');
      if(!confirm('A beolvasott katalógus azonos azonosítójú adatai lecserélik a jelenlegieket. Az ajánlatsorok nem változnak. Folytatod?'))return;
      if(items!==contextItems||quoteContextEpoch!==contextEpoch)throw Error('Az ajánlat időközben megváltozott. A katalógus beolvasását indítsd újra.');
      atomicRegistryUpdate({registry_version:1,material_catalog:nextM,norm_catalog:nextN});toast('Katalógus beolvasva; az ajánlat pillanatképei változatlanok.');
    }catch(error){fail(error);}finally{event.target.value='';}};
  }
  function renderCatalog() {
    const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const query=normalize($b('buildingSearch').value), trade=$b('buildingTrade').value, all=catalog();
    const filtered=all.filter(r=>(!trade||r.szakag===trade)&&normalize(r.megnevezes+' '+r.id+' '+phase(r.szakag)).includes(query));
    $b('buildingCatalogCount').textContent=`${all.length} tétel; ${filtered.length} találat. ${state.custom_catalog.length} saját projekt-tétel. Az új tételek árai és normái megadandók.`;
    $b('buildingCatalog').innerHTML=filtered.slice(0,80).map(r=>`<li><span><b>${esc(r.megnevezes)}</b><small>${esc(phase(r.szakag))} · ${esc(r.egyseg)} · ${r.anyag_atlag==null?'ár megadandó':'korábbi referencia / saját adat'}</small></span><button type="button" data-building-add="${esc(r.id)}" aria-label="Hozzáadás: ${esc(r.megnevezes)}">＋</button></li>`).join('');
    if(filtered.length>80)$b('buildingCatalogCount').textContent+=' Az első 80 látszik; szűkítsd a keresést.';
    quickChoices();
  }
  function renderEditor() {
    const item=items[selected], box=$b('buildingEditor'); if(!item?.budget){box.innerHTML='';return;}
    const b=item.budget;
    box.innerHTML=`<h3>Sor szerkesztése: ${esc(item.name)}</h3><div class="building-grid">${field('be-name','Megnevezés',item.name,'text')}${field('be-unit','Mértékegység',item.unit,'text')}${field('be-qty','Nettó munkamennyiség',item.qty)}${field('be-mat','Anyag nettó alap-egységár (Ft)',item.mat_unit_price)}${field('be-material_factor','Anyagfajlagos-szorzó (1,05 = +5%)',b.material_factor??1)}${field('be-norm','Normaidő (óra / munkatétel-egység)',b.norm)}${field('be-rate','Egyedi óradíj (üres: közös)',b.rate)}${field('be-machine','Gép nettó Ft / munkatétel-egység',b.machine)}${field('be-transport','Szállítás nettó Ft / munkatétel-egység',b.transport)}${field('be-extra','Egyéb nettó Ft / munkatétel-egység',b.extra)}
      <label>Norma eredete<select id="be-norm_kind"><option value="unknown">Ismeretlen</option><option value="derived">Munkadíjból visszaszámított becslés</option><option value="user">Saját megadott munkanorma</option><option value="verified">Forrással ellenőrzött munkanorma</option></select></label>
      ${field('be-source','Ár forrása',b.source,'text')}${field('be-updated','Ár frissítése',b.updated,'date')}${field('be-norm_source','Norma forrása',b.norm_source,'text')}${field('be-norm_updated','Norma frissítése',b.norm_updated,'date')}${field('be-quantity_source','Mennyiség forrása / feltevése',b.quantity_source,'text')}</div>
      <button id="buildingRemember" type="button" class="secondary">Sor mentése saját katalógusváltozatként</button>`;
    $b('be-norm_kind').value=b.norm_kind;
    const topFields={name:'name',unit:'unit',qty:'qty',mat:'mat_unit_price'};
    for(const id of ['name','unit','qty','mat','material_factor','norm','rate','machine','transport','extra','norm_kind','source','updated','norm_source','norm_updated','quantity_source']) {
      $b('be-'+id).onchange=()=>run(()=>{
        const next=E.copy(item), value=$b('be-'+id).value;
        if(topFields[id])next[topFields[id]]=['qty','mat'].includes(id)?E.number(value):value;
        else next.budget[id]=['material_factor','norm','rate','machine','transport','extra'].includes(id)?E.number(value):value;
        if(id==='mat'){next.budget.price_kind='user';next.budget.source='Felhasználó által megadott ár';next.budget.updated=today();}
        if(id==='qty'){next.budget.quantity_source='Felhasználó által megadott mennyiség';if(next.budget.calc_key){next.budget.materials=[];delete next.budget.calc_key;}}
        if(id==='norm'){next.budget.norm_kind='user';next.budget.norm_source='Felhasználó által megadott munkanorma';next.budget.norm_updated=today();next.budget.norm_unit=next.unit;delete next.budget.norm_id;}
        if(id==='unit'&&value!==item.unit&&next.budget.norm_unit){next.budget.norm=null;next.budget.norm_unit=value;next.budget.norm_kind='unknown';next.budget.norm_source='';next.budget.norm_updated='';delete next.budget.norm_id;}
        const trial=items.map((r,i)=>i===selected?next:r); E.calculate(trial.filter(r=>String(r.name||'').trim()),state.settings);
        items[selected]=next;calcAndRender();renderEditor();
      });
    }
    $b('buildingRemember').onclick=()=>run(()=>{
      if(state.custom_catalog.length>=500)throw Error('Elérted az 500 saját tételes határt.');
      const row={id:'sajat-'+crypto.randomUUID(),szakag:b.trade,megnevezes:item.name,egyseg:item.unit,tipus:item.type,anyag_atlag:item.mat_unit_price,munka_atlag:null,norma_ora_atlag:b.norm,forras:b.source,frissitve:b.updated,price_kind:b.price_kind,norm_kind:b.norm_kind,norm_source:b.norm_source,norm_updated:b.norm_updated,budget_defaults:{...Object.fromEntries(['norm_unit','norm_id','norm_applicability'].filter(k=>b[k]!=null).map(k=>[k,b[k]])),rate:b.rate,material_factor:b.material_factor??1,machine:b.machine,transport:b.transport,extra:b.extra,...(b.components?{material_mode:b.material_mode||'aggregate',component_version:1,components:E.copy(b.components)}:{})}};
      state.custom_catalog.push(row);renderCatalog();toast('A saját változat a projekt JSON- és felhőmentésébe is bekerül.');
    });
    renderComponentEditor(item,selected);
    renderNormEditor(item,selected);
  }
  function renderNormEditor(item,index){
    const b=item.budget,l=E.lineCost(item,state.settings),choices=norms().filter(n=>n.unit===item.unit);
    $b('buildingEditor').insertAdjacentHTML('beforeend',`<section class="building-components"><h3>Munkanorma és rezsióradíj</h3><p>Norma: <b>${esc(amount(b.norm))} óra/${esc(item.unit)}</b> · Számított munkaóra: <b>${esc(amount(item.qty==null||b.norm==null?null:l.hours))} óra</b> · Óradíj: <b>${esc(amount(l.rate))} Ft/óra</b> (${esc({item:'tételenkénti',trade:'szakági',common:'közös'}[l.rateKind])}) · Munkadíj: <b>${esc(money(l.labor))}</b></p><p class="building-muted">${esc(b.norm_applicability||'A munkakörülmények és a norma szakmai ellenőrzése szükséges.')}</p><label>Kompatibilis norma (óra/${esc(item.unit)})<select id="be-norm-catalog"><option value="">Válassz normát</option>${choices.map(n=>`<option value="${esc(n.id)}">${esc(n.name+' – '+amount(n.norm)+' óra/'+n.unit+' – '+normLabels[n.kind])}</option>`).join('')}</select></label><button id="be-norm-apply" type="button">Kiválasztott norma másolása a sorba</button><button id="be-norm-save" type="button" class="secondary">Sor normájának mentése katalógusba</button></section>`);
    $b('be-norm-apply').onclick=()=>run(()=>{const n=norms().find(n=>n.id===$b('be-norm-catalog').value);if(!n)throw Error('Előbb válassz normát.');const next=E.applyNorm(item,n);E.calculate(items.map((r,i)=>i===index?next:r).filter(r=>String(r.name||'').trim()),state.settings);items[index]=next;calcAndRender();renderEditor();});
    $b('be-norm-save').onclick=()=>run(()=>{
      const definition=catalog().find(r=>r.id===b.id);
      const linked=definition&&definition.megnevezes===item.name&&definition.egyseg===item.unit&&definition.szakag===b.trade;
      // Only an exact work definition may acquire an automatic norm binding.
      const id=linked?'norma-'+definition.id:'norma-sajat-'+crypto.randomUUID();
      const previous=norms().find(n=>n.id===id);
      if(linked&&previous?.norm!=null&&!confirm('A munkatétel jövőbeli normáját frissíted. A mentett ajánlatsorok nem változnak. Folytatod?'))return;
      saveRegistry('norm',E.normEntry({id,name:item.name,unit:item.unit,trade:b.trade,norm:b.norm,kind:b.norm_kind,source:b.norm_source||'',updated:b.norm_updated||'',applicability:b.norm_applicability||''}));
      toast(linked?'Norma ehhez a munkatételhez mentve; az új gyorsfelvétel ezt használja. A régi sorok változatlanok.':'Külön norma mentve. Az átnevezett munkához hozz létre saját munkatételt az automatikus felhasználáshoz.');
    });
  }
  function renderComponentEditor(item,index) {
    const b=item.budget,active=b.material_mode==='components';
    $b('buildingEditor').insertAdjacentHTML('beforeend',`<section class="building-components"><h3>Anyagkalkuláció módja</h3><label>Egyszerre csak a kiválasztott mód anyagköltsége számít<select id="be-material-mode"><option value="aggregate">Összesített egységár – korábbi mód</option><option value="components">Összetevőnkénti anyagkalkuláció</option></select></label><button id="buildingComponentTemplate" type="button" class="secondary" ${base.component_templates?.[b.id]?'':'disabled'}>Tétel összetevősablonjának betöltése</button><p class="building-muted">Összetevős módban a fenti összesített anyagár és anyagszorzó nem kerül az összegbe. A tartalék anyagonként egyszer számít. Nincs automatikus mértékegység-átváltás.</p><div id="buildingComponentEditor"></div></section>`);
    $b('be-material-mode').value=active?'components':'aggregate';
    $b('be-unit').disabled=!!b.components?.length;
    for(const id of ['be-mat','be-material_factor','be-source','be-updated'])$b(id).disabled=active;
    const commit=next=>{const trial=items.map((r,i)=>i===index?next:r);E.calculate(trial.filter(r=>String(r.name||'').trim()),state.settings);items[index]=next;calcAndRender();renderEditor();};
    $b('be-material-mode').onchange=()=>run(()=>{const next=E.copy(item);next.budget.material_mode=$b('be-material-mode').value;if(next.budget.material_mode==='components'){next.budget.component_version=1;next.budget.components??=[];}commit(next);});
    $b('buildingComponentTemplate').onclick=()=>run(()=>{if(b.components?.length&&!confirm('A sablon lecseréli a sor összetevőit és azok árait. Folytatod?'))return;commit(E.applyComponentTemplate(item,base,b.calc_key?state.geometry:null));});
    if(!active)return;
    const costs=E.componentCosts(item),box=$b('buildingComponentEditor');
    box.innerHTML=(b.components||[]).map((c,i)=>`<fieldset class="building-component-card" data-component="${i}"><legend>${esc(c.name)}</legend><div class="building-grid">${field('bc-'+i+'-name','Anyag megnevezése',c.name,'text')}${field('bc-'+i+'-unit','Anyag mértékegysége',c.unit,'text')}${field('bc-'+i+'-per_unit','Fajlagos ('+c.unit+' / '+item.unit+')',c.per_unit)}${field('bc-'+i+'-unit_price','Nettó egységár (Ft / '+c.unit+')',c.unit_price)}${field('bc-'+i+'-waste_percent','Rendelési tartalék (%)',c.waste_percent)}<label>Rendelési kerekítés<select id="bc-${i}-rounding"><option value="none">Hat tizedesre, egészre kerekítés nélkül</option><option value="up">Egészre felfelé</option></select></label>${field('bc-'+i+'-source','Ár forrása',c.source,'text')}${field('bc-'+i+'-updated','Ár dátuma',c.updated,'date')}${field('bc-'+i+'-quantity_source','Fajlagos forrása',c.quantity_source,'text')}${field('bc-'+i+'-quantity_updated','Fajlagos dátuma',c.quantity_updated,'date')}</div><p>Nettó igény: <b>${esc(amount(costs[i].netQuantity))} ${esc(c.unit)}</b> → rendelendő: <b>${esc(amount(costs[i].quantity))} ${esc(c.unit)}</b> · Anyagköltség: <b>${costs[i].cost==null?'MEGADANDÓ':esc(money(costs[i].cost))}</b></p><p class="building-muted">${esc(costs[i].issues.join('; ')||'Kitöltött összetevő')}${c.geometry_key?' · Geometriához kötött fajlagos':''}${c.use_geometry_waste?' · Geometriai tartalék követése':''}</p><button type="button" class="secondary" data-component-delete="${i}">Összetevő törlése</button></fieldset>`).join('')+`<button id="buildingComponentAdd" type="button">Új anyagösszetevő</button><p id="buildingComponentTotal">Összetevők ismert anyagköltsége: <b>${esc(money(E.lineCost(item,state.settings).material))}</b>. Közvetlen nettó tételár: <b>${esc(money(E.lineCost(item,state.settings).total))}</b>; közvetlen bruttó: <b>${esc(money(E.lineCost(item,state.settings).gross))}</b>. A projektszintű rezsi, kedvezmény, haszon és pénzügyi tartalék az összesítésben szerepel.</p>`;
    (b.components||[]).forEach((c,i)=>{
      const card=box.querySelector('[data-component="'+i+'"]');
      card.insertAdjacentHTML('beforeend',`<div class="building-grid">${field('bc-'+i+'-order_multiple','Rendelési lépcső ('+c.unit+')',c.order_multiple)}${field('bc-'+i+'-minimum_order','Minimum rendelés ('+c.unit+')',c.minimum_order)}${field('bc-'+i+'-manufacturer','Gyártó',c.manufacturer||'','text')}${field('bc-'+i+'-supplier','Beszállító',c.supplier||'','text')}${field('bc-'+i+'-applicability','Alkalmazhatóság / feltételek',c.applicability||'','text')}</div><p class="building-muted">Anyagazonosító: ${esc(c.material_id||'még nincs katalógushoz kapcsolva')}; az ár mentett pillanatkép.</p><label>Anyag a katalógusból<select id="bc-${i}-catalog"><option value="">Válassz anyagot</option>${materials().filter(m=>m.basis_unit===item.unit).map(m=>`<option value="${esc(m.id)}">${esc(m.name+' ['+m.unit+']')}</option>`).join('')}</select></label><button type="button" id="bc-${i}-apply">Kiválasztott anyag másolása</button><button type="button" id="bc-${i}-save" class="secondary">Összetevő mentése anyagkatalógusba</button>`);
      for(const key of ['manufacturer','supplier','applicability'])$b('bc-'+i+'-'+key).onchange=()=>run(()=>{const next=E.copy(item);next.budget.components[i][key]=$b('bc-'+i+'-'+key).value;commit(next);});
      $b('bc-'+i+'-apply').onclick=()=>run(()=>{const m=materials().find(m=>m.id===$b('bc-'+i+'-catalog').value);if(!m)throw Error('Előbb válassz anyagot.');const next=E.copy(item);next.budget.components[i]=E.materialSnapshot(m,item.unit,c.id);commit(next);});
      $b('bc-'+i+'-save').onclick=()=>run(()=>{const m={...E.copy(c),id:c.material_id||'anyag-sajat-'+crypto.randomUUID()};delete m.material_id;delete m.geometry_key;delete m.use_geometry_waste;saveRegistry('material',E.materialEntry(m));});
      $b('bc-'+i+'-rounding').value=c.rounding;
      for(const key of ['name','unit','per_unit','unit_price','waste_percent','order_multiple','minimum_order','rounding','source','updated','quantity_source','quantity_updated'])$b('bc-'+i+'-'+key).onchange=()=>run(()=>{
        const next=E.copy(item),part=next.budget.components[i],value=$b('bc-'+i+'-'+key).value;
        if(['name','unit'].includes(key)&&!value.trim())throw Error('Anyagnév és mértékegység szükséges.');
        part[key]=['per_unit','unit_price','waste_percent','order_multiple','minimum_order'].includes(key)?E.number(value):value;
        if(key==='per_unit'){delete part.geometry_key;part.quantity_source='Felhasználó által megadott fajlagos';part.quantity_updated=today();}
        if(key==='unit_price'&&part.unit_price!==c.unit_price){part.price_kind=part.unit_price==null?'missing':'user';part.source=part.unit_price==null?'':'Felhasználó által megadott ár; külső forrás még nincs ellenőrizve';part.updated=part.unit_price==null?'':today();}
        if(key==='waste_percent')part.use_geometry_waste=false;
        if(key==='unit'&&value!==c.unit){part.per_unit=null;part.unit_price=null;part.price_kind='missing';part.source='';part.updated='';part.quantity_source='';part.quantity_updated='';delete part.order_multiple;delete part.minimum_order;delete part.geometry_key;delete part.material_id;part.rounding=value==='db'?'up':'none';}
        commit(next);
      });
    });
    box.querySelectorAll('[data-component-delete]').forEach(button=>button.onclick=()=>run(()=>{const next=E.copy(item);next.budget.components.splice(Number(button.dataset.componentDelete),1);commit(next);}));
    $b('buildingComponentAdd').onclick=()=>run(()=>{if((b.components||[]).length>=100)throw Error('Legfeljebb 100 összetevő adható meg.');const next=E.copy(item);next.budget.components.push({id:crypto.randomUUID(),name:'Új anyag',unit:'db',basis_unit:item.unit,per_unit:null,unit_price:null,waste_percent:0,rounding:'up',price_kind:'missing',source:'',updated:'',quantity_source:'',quantity_updated:'',use_geometry_waste:false});commit(next);});
  }
  function materialMarkup() {
    return named().map(r=>{
      if(r.budget?.material_mode==='components'){
        const costs=E.componentCosts(r),parts=r.budget.components;let html='';
        for(let offset=0;offset<parts.length;offset+=3)html+=`<section class="building-print-phase"><h3>${esc(r.name)} – anyagösszetevők${offset?' (folytatás)':''}</h3><div class="building-table-wrap"><table class="building-component-report"><thead><tr><th>Anyag / fajlagos</th><th>Nettó → rendelendő</th><th>Egységár / költség</th><th>Forrás / hiányok</th></tr></thead><tbody>${parts.slice(offset,offset+3).map((c,i)=>{const cost=costs[offset+i];return `<tr><td><b>${esc(c.name)}</b><br>${esc(c.material_id||'Saját összetevő')}<br>${esc(c.manufacturer||'')} ${esc(c.supplier||'')}<br>${esc(amount(c.per_unit))} ${esc(c.unit)} / ${esc(c.basis_unit)}</td><td>${esc(amount(cost.netQuantity))} → ${esc(amount(cost.quantity))} ${esc(c.unit)}<br>Tartalék: ${esc(amount(c.waste_percent))}%<br>${c.rounding==='up'?'Egészre felfelé':'Hat tizedesre'}<br>Rendelési lépcső: ${esc(amount(c.order_multiple??0))} ${esc(c.unit)}; minimum: ${esc(amount(c.minimum_order??0))} ${esc(c.unit)}</td><td>${esc(amount(c.unit_price))} Ft/${esc(c.unit)}<br><b>${cost.cost==null?'MEGADANDÓ':esc(money(cost.cost))}</b></td><td>Ár: ${esc(c.source||'nincs forrás')} (${esc(c.updated||'dátum nincs')})<br>Fajlagos: ${esc(c.quantity_source||'megadandó')} (${esc(c.quantity_updated||'dátum nincs')})<br>${esc(c.applicability||'')}<br>${esc(cost.issues.join('; '))}</td></tr>`;}).join('')}</tbody></table></div></section>`;
        return html;
      }
      return r.budget?.materials?.length?`<section class="building-print-phase"><h3>${esc(r.name)} – anyagigény</h3><table><thead><tr><th>Anyag</th><th>Mennyiség</th><th>Képlet / feltevés</th></tr></thead><tbody>${r.budget.materials.map(m=>`<tr><td>${esc(m.name)}</td><td>${esc(amount(m.qty))} ${esc(m.unit)}</td><td>${esc(m.formula)}</td></tr>`).join('')}</tbody></table></section>`:'';
    }).join('');
  }
  function render() {
    $b('buildingContent').hidden=!state.enabled;$b('buildingEnable').hidden=state.enabled;
    print.hidden=!state.enabled;printWarning.hidden=!state.enabled;
    for(const id of ['transparentCostDetails','printCostBreakdown'])if($b(id))$b(id).hidden=state.enabled;
    legacyTable.hidden=state.enabled;legacyPrintTable.parentElement.hidden=state.enabled;
    for(const id of ['currency','overhead_rate','profit_percent','discount_net','vat_enabled','vat_rate','material_margin','pricing_method','price_band','material_quality','price_region'])if($b(id))$b(id).disabled=state.enabled||$b(id).dataset.authLocked==='1';
    if(state.enabled){if(generateButtonBefore===null)generateButtonBefore={disabled:$b('btnGenerateQuoteText').disabled,title:$b('btnGenerateQuoteText').title};$b('btnGenerateQuoteText').disabled=true;$b('btnGenerateQuoteText').title='A részletes költségvetés ügyféloldali megjelenítése a következő ütem. JSON/PDF/CSV menthető.';}
    else if(generateButtonBefore!==null){Object.assign($b('btnGenerateQuoteText'),generateButtonBefore);generateButtonBefore=null;}
    $b('buildingError').hidden=!$b('buildingError').textContent;
    for(const [label,text]of originalLabels)label.textContent=state.enabled?text.replace('végösszeg','ismert részösszeg'):text;
    for(const x of originalOverheadLabels)x.node.textContent=state.enabled?'Külön rezsi és pénzügyi tartalék':x.text;
    for(const node of extraCostPanels)node.hidden=!state.enabled;
    if(!state.enabled)return;
    quickPreview();quickOverall();
    const t=budgetTotal(), warning=t.complete?'Kitöltött költségbecslés – szakmai jóváhagyás szükséges.':`HIÁNYOS TERVEZET – NEM KULCSRAKÉSZ AJÁNLAT. ${t.missingCount} sor ellenőrzendő. Az összegek csak az ismert részt tartalmazzák.`;
    const sumValues={mat:t.material,lab:t.labor,overhead:t.overhead+t.reserve,discount:state.settings.discount,profit:t.profit,net_total:t.net,vat:t.vat,gross_total:t.gross};
    for(const prefix of ['sum_','p_sum_'])for(const [key,value]of Object.entries(sumValues))$b(prefix+key).textContent=(key==='discount'?'-':'')+money(value);
    for(const node of extraCostPanels)node.innerHTML=[['Gép (nettó)',t.machine],['Szállítás (nettó)',t.transport],['Egyéb (nettó)',t.extra]].filter(([,n])=>n!==0).map(([name,n])=>`<div class="flex justify-between"><span>${name}</span><span class="font-bold">${esc(money(n))}</span></div>`).join('');
    printWarning.textContent=warning;
    $b('buildingPhases').innerHTML=base.trades.map(trade=>{const n=named().filter(r=>r.budget?.trade===trade.id).length;return `<div class="${n?'active-phase':''}">${esc(trade.name)}: ${n} sor${n?'':' – még nincs részletezve'}</div>`;}).join('');
    $b('buildingRows').innerHTML=items.map((item,i)=>{
      if(!String(item.name||'').trim())return '';
      const l=E.lineCost(item,state.settings);
      return `<tr><td><small>${esc(phase(item.budget?.trade))}</small><b>${esc(item.name)}</b></td><td>${esc(amount(item.qty))} ${esc(item.unit)}</td><td>${esc(money(l.total))}</td><td>${l.complete?'Kitöltve':`${l.issues.length} hiány / ellenőrzés`}</td><td><button type="button" data-building-edit="${i}">Részletek</button><button type="button" class="secondary" data-building-delete="${i}" aria-label="Tétel törlése: ${esc(item.name)}">Törlés</button></td></tr>`;
    }).join('');
    $b('buildingSummary').innerHTML=`<div class="building-warning">${esc(warning)}</div><h3>Ismert költségek</h3><p>Ismert számított munkaóra: <b>${esc(amount(t.hours))} óra</b>. Munkadíj = mennyiség × normaidő × rezsióradíj.</p><div class="building-grid">${[['Anyag',t.material],['Munka',t.labor],['Gép',t.machine],['Szállítás',t.transport],['Egyéb',t.extra],['Külön rezsi',t.overhead],['Haszon',t.profit],['Pénzügyi tartalék',t.reserve],['Nettó ismert rész',t.net],['Áfa az ismert részre',t.vat],['Bruttó ismert rész',t.gross]].map(([label,n])=>`<div>${label}<br><b>${esc(money(n))}</b></div>`).join('')}</div>`;
    $b('buildingMaterials').innerHTML=materialMarkup();
    const printRows=[];
    for(const trade of base.trades){
      const rows=named().filter(r=>r.budget?.trade===trade.id); if(!rows.length)continue;
      const phaseRows=[];
      for(const row of rows){const b=row.budget,l=E.lineCost(row,state.settings);
        const printIssues=l.materialMode==='components'?l.issues.filter(s=>!b.components.some(c=>s.startsWith(c.name+': '))):l.issues;
        const missing=printIssues.map(s=>s.replace('Mennyiség helyszíni/tervi ellenőrzése szükséges','Mennyiség ellenőrizendő').replace('Norma eredete nincs jóváhagyva','Norma eredete ellenőrizendő').replace('Ár hiányzik vagy régi, nem újraellenőrzött referencia','Ár ellenőrizendő').replace('Ár forrása vagy dátuma hiányzik','Árforrás/dátum hiányzik')).join('; ')+(l.materialMode==='components'?'; Anyagösszetevők részletei az anyagkimutatásban.':'');
        const priceSource=l.materialMode==='components'?'Összetevőnként, az anyagkimutatásban':b.price_kind==='missing'?'Nincs árforrás':b.source;
        const normSource=b.norm_kind==='unknown'?'Nincs normaforrás':b.norm_source;
        phaseRows.push(`<tr><td><b>${esc(row.name)}</b><br>${esc(amount(row.qty))} ${esc(row.unit)}<br><small>${esc(missing||'Kitöltött sor')}</small></td><td>${l.materialMode==='components'?'Anyag: összetevők összege; a régi anyagár és szorzó nem számít.':`Anyag: ${esc(amount(row.mat_unit_price))} Ft/alapegység<br>Anyagszorzó: ${esc(amount(b.material_factor??1))}`}<br>Norma: ${esc(amount(b.norm))} óra/${esc(row.unit)}<br>Munkaóra: ${esc(amount(row.qty==null||b.norm==null?null:l.hours))} óra<br>Óradíj: ${esc(amount(l.rate))} Ft/óra (${esc({item:'tétel',trade:'szakág',common:'közös'}[l.rateKind])})<br><b>Ismert nettó rész: ${esc(money(l.total))}</b><br>Közvetlen bruttó tétel: ${esc(money(l.gross))}</td><td>Anyag: ${esc(money(l.material))}<br>Munka: ${esc(money(l.labor))}<br>Gép: ${esc(money(l.machine))}<br>Szállítás: ${esc(money(l.transport))}<br>Egyéb: ${esc(money(l.extra))}</td><td>Ár: ${esc(priceSource)}${l.materialMode==='components'?'':` (${esc(b.updated||'dátum nincs')})`}<br>Norma: ${esc(normLabels[b.norm_kind]||normLabels.unknown)} – ${esc(normSource||'forrás nincs')} (${esc(b.norm_updated||'dátum nincs')})<br>${esc(b.norm_id||'')} ${esc(b.norm_applicability||'')}<br>Mennyiség: ${esc(b.quantity_source||'forrás nincs')}</td></tr>`);
      }
      for(let offset=0;offset<phaseRows.length;offset+=3)printRows.push(`<section class="building-print-phase"><h3>${esc(trade.name)}${offset?' – folytatás':''}</h3><table><thead><tr><th>Tétel és hiányok</th><th>Egységár és norma</th><th>Költségbontás</th><th>Források és feltevések</th></tr></thead><tbody>${phaseRows.slice(offset,offset+3).join('')}</tbody></table></section>`);
    }
    if(printRows.length)printRows[0]=printRows[0].replace('<section class="building-print-phase">',`<section class="building-print-phase"><h2>Részletes szakági költségvetés</h2><p>${esc(warning)}</p>`);
    const materials=materialMarkup(),materialPrint=materials?materials.replace('<section class="building-print-phase">','<section class="building-print-phase"><h2>Anyagszükséglet</h2>'):'';
    print.innerHTML=`${printRows.join('')}${materialPrint}<section class="building-print-phase"><h2>Összesítés – ismert költségek</h2>${$b('buildingSummary').innerHTML}<p>Óradíjak rezsit tartalmaznak: ${state.settings.rate_includes_overhead==null?'nincs meghatározva (régi beállítás)':state.settings.rate_includes_overhead?'igen – nincs külön rezsi':'nem'}. Közös rezsióradíj: ${esc(amount(state.settings.rate))} Ft/óra.</p>${state.rate_reference?`<p>Óradíj-referencia: ${esc(amount(state.rate_reference.rate))} Ft/óra; ajánlott minimális nettó építőipari rezsióradíj; ${esc(state.rate_reference.valid_from)}-tól; ${esc(state.rate_reference.source)}. A tényleges óradíj soronként fent látható.</p>`:''}<p>Minden további szakág és hiányzó adat részletezendő. ${esc(E.geometry(state.geometry).notice)}</p></section>`;
    // html2canvas does not reliably lay out overflow-wrap:anywhere URLs.
    // Add explicit break opportunities to printable text only. Payloads,
    // catalog sources, JSON and CSV retain their original URL bytes.
    const sourceTextNodes=document.createTreeWalker(print,NodeFilter.SHOW_TEXT);
    while(sourceTextNodes.nextNode()){
      const textNode=sourceTextNodes.currentNode;
      textNode.nodeValue=textNode.nodeValue.replace(/https?:\/\/[^\s]+/g,url=>Array.from(url).map((ch,i)=>ch+((i+1)%14===0?'\u200b':'')).join(''));
    }
    for(const id of ['sum_net_total','sum_gross_total','p_sum_net_total','p_sum_gross_total']) if(!t.complete)$b(id).textContent=money(id.includes('gross')?t.gross:t.net)+' (részadat)';
  }
  const oldTotals=window.totals, oldRow=window.rowNet, oldCalc=window.calcAndRender, oldRender=window.renderItems, oldPayload=window.payloadNow, oldApply=window.applyPayload;
  window.totals=function(){const old=oldTotals();if(!state.enabled)return old;const t=budgetTotal();return {...old,sumMat:t.material,sumLab:t.labor,subtotalNet:t.direct,overheadNet:t.overhead+t.reserve,discountNet:state.settings.discount,profitNet:t.profit,netTotal:t.net,vatRate:state.settings.vat_percent,vatAmount:t.vat,grossTotal:t.gross,totalHours:t.hours,ancillaryNet:t.reserve,ancillaryDetails:[],building:t};};
  window.rowNet=function(row){return state.enabled?E.lineCost(row,state.settings).total:oldRow(row);};
  window.calcAndRender=function(){oldCalc();render();};
  window.renderItems=function(){if(state.enabled)items=items.map(E.adopt);oldRender();render();};
  window.payloadNow=function(){const p=oldPayload();if(state.enabled){p.items=E.copy(named());p.building_budget=snapshot();p.estimate_status=budgetTotal().complete?'building_estimate_review_required':'building_incomplete_draft';}return p;};
  window.applyPayload=function(input){
    const p=E.validatePayload(input,base);
    if(p.building_budget&&p.currency!=='HUF')throw Error('A részletes munkaváltozat csak HUF költségvetést kezel.');
    const b=p.building_budget;
    const next={enabled:!!b?.enabled,settings:b?.settings||E.defaults(),geometry:b?.geometry||E.sampleGeometry(),custom_catalog:b?.custom_catalog||[],is_sample:!!b?.is_sample,registry_version:b?.registry_version??null,material_catalog:b?.material_catalog??null,norm_catalog:b?.norm_catalog??null,rate_reference:b?.rate_reference??null};
    // The legacy renderer can still throw. Preserve the entire working snapshot,
    // selection and unsaved form values, rather than only the quote identity.
    const previous={items,state:E.copy(state),selected,generateButtonBefore,
      controls:[...document.querySelectorAll('input,select,textarea')].filter(e=>e.type!=='file').map(e=>({node:e,value:e.value,checked:e.checked}))};
    // Synchronous import only. Keep the actual removed nodes (and their handlers),
    // so rollback never depends on a renderer that may still be broken.
    const mutations=new MutationObserver(()=>{});
    mutations.observe(document.body,{subtree:true,childList:true,attributes:true,attributeOldValue:true,characterData:true,characterDataOldValue:true});
    try {
      Object.assign(state,next);selected=-1;$b('buildingError').textContent='';
      oldApply(p);settingsForms();renderCatalog();render();renderEditor();renderLibraries();
    } catch(error) {
      Object.assign(state,previous.state);items=previous.items;selected=previous.selected;generateButtonBefore=previous.generateButtonBefore;
      const changes=mutations.takeRecords();mutations.disconnect();
      try {
        for(const change of changes.reverse()){
          if(change.type==='childList'){
            for(const node of change.addedNodes)if(node.parentNode===change.target)change.target.removeChild(node);
            const next=change.nextSibling?.parentNode===change.target?change.nextSibling:null;
            for(const node of change.removedNodes)change.target.insertBefore(node,next);
          }else if(change.type==='attributes'){
            if(change.oldValue===null)change.target.removeAttribute(change.attributeName);
            else change.target.setAttribute(change.attributeName,change.oldValue);
          }else if(change.type==='characterData')change.target.data=change.oldValue;
        }
      } finally {
        // value/checked properties are not reliably reflected in DOM attributes.
        for(const c of previous.controls){c.node.value=c.value;if(c.checked!==undefined)c.node.checked=c.checked;}
      }
      throw error;
    } finally {mutations.disconnect();}
  };
  // Guided entry stays in the existing PRO+ quote; no separate database or application.
  function quickChoices(){
    const normalize=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const query=normalize($b('quickSearch').value),trade=$b('quickTrade').value;
    const options=catalog().filter(c=>(!trade||c.szakag===trade)&&normalize(c.megnevezes+' '+c.id).includes(query));
    const select=$b('quickItem'),old=select.value;
    select.innerHTML='<option value="">Válassz munkatételt</option>'+options.map(x=>`<option value="${esc(x.id)}">${esc(x.megnevezes+' ('+x.egyseg+') – '+phase(x.szakag))}</option>`).join('');
    if(options.some(r=>r.id===old))select.value=old;
    quickModes();
  }
  function quickSelected(){return catalog().find(x=>x.id===$b('quickItem').value);}
  function quickModes(){
    const row=quickSelected(),unit=row?.egyseg;
    const opts=Q.modes(unit),select=$b('quickMethod'),old=select.value;
    select.innerHTML=opts.map(o=>`<option value="${o.value}">${esc(o.label)}</option>`).join('');
    if(opts.some(o=>o.value===old))select.value=old;
    quickInputLayout();
  }
  function quickInputLayout(){
    const mode=$b('quickMethod').value;
    const shown={Quantity:mode==='direct',Length:['area','wall','volume','linear'].includes(mode),Width:['area','volume'].includes(mode),Height:mode==='wall',Depth:mode==='volume',Openings:mode==='wall'};
    for(const [key,visible]of Object.entries(shown))$b('quick'+key+'Label').hidden=!visible;
    quickPreview();
  }
  function quickInput(){return {mode:$b('quickMethod').value,quantity:$b('quickQuantity').value,length:$b('quickLength').value,width:$b('quickWidth').value,height:$b('quickHeight').value,depth:$b('quickDepth').value,openings:$b('quickOpenings').value};}
  function quickDraft(){const definition=quickSelected();if(!definition)throw Error('Válassz munkatételt.');return Q.draftRow(definition,quickInput(),E,base,materials(),norms());}
  function quickPreview(){
    const box=$b('quickPreview');if(!box||!state.enabled)return;
    try {
      const row=quickDraft(),l=E.lineCost(row,state.settings);
      const lackingPrices=row.budget.material_mode==='components'?(row.budget.components||[]).filter(c=>c.unit_price==null).length:(row.mat_unit_price==null?1:0);
      const lackingNorm=row.budget.norm==null;
      const lackingRatios=row.budget.material_mode==='components'?(row.budget.components||[]).filter(c=>c.per_unit==null).length:0;
      const priorities=[lackingNorm?'Normaidő megadandó':null,lackingPrices?lackingPrices+' anyagár hiányzik':null,lackingRatios?lackingRatios+' anyagfajlagos hiányzik':null].filter(Boolean);
      const missing=l.issues.length?`<p class="building-warning"><b>Nem kész az ajánlati ár:</b> ${esc(priorities.join(' · ')||'Források és körülmények ellenőrzendők')}.</p><details><summary>Összes ellenőrizendő adat (${l.issues.length})</summary><ul>${l.issues.map(issue=>`<li>${esc(issue)}</li>`).join('')}</ul></details>`:'<p><b>Kitöltött tétel – szakmai ellenőrzés szükséges.</b></p>';
      box.innerHTML=`<p><b>${esc(row.name)}</b> · Munkamennyiség: <b>${esc(amount(row.qty))} ${esc(row.unit)}</b></p><p>Normaidő: <b>${esc(amount(row.budget.norm))} óra/${esc(row.unit)}</b> · Munkaóra: <b>${row.budget.norm==null?'MEGADANDÓ':esc(amount(l.hours))}</b> · Alkalmazott óradíj: <b>${esc(amount(l.rate))} Ft/óra</b></p><p>Anyag: ${esc(money(l.material))}${l.issues.some(i=>/anyag|Ár|fajlagos/i.test(i))?' (csak ismert rész)':''} · Munkadíj: ${esc(money(l.labor))}${row.budget.norm==null?' (normaidő hiányzik)':''}</p>${missing}<p class="building-muted">${l.complete?'Tétel számítva, még ellenőrizendő.':'NEM végleges ajánlati ár. A hiányzó árakat vagy normaidőt a Részletek szerkesztésnél kell ellenőrzött forrásból pótolni.'}</p>`;
      $b('quickAdd').disabled=false;
    } catch(error) {
      box.textContent=error.message||String(error);$b('quickAdd').disabled=true;
    }
  }
  function quickOverall(){
    const box=$b('quickOverall');if(!box||!state.enabled)return;
    const a=D.audit(catalog(),materials(),norms());
    $b('quickDataQuality').textContent='Szakmai adattár állapota: '+a.missingWorkNorms+'/'+a.totalWorkItems+' munkatételnél nincs saját igazolt normaidő-hozzárendelés, '+a.missingPrices+'/'+a.totalMaterials+' anyagnak nincs ára, '+a.missingRatios+'/'+a.totalMaterials+' anyagnak nincs fajlagosa. A hiányokat nem tekintjük 0 Ft-nak. A betöltött adatok alkalmazását a konkrét munkaváltozathoz kell ellenőrizni.';
    const t=budgetTotal();
    box.innerHTML=`<b>${named().length} ajánlatsor</b> · Ismert nettó részösszeg: <b>${esc(money(t.net))}</b> · Összes ismert munkaóra: <b>${esc(amount(t.hours))}</b> · ${t.complete?'Minden sor kitöltött, szakmai jóváhagyás szükséges.':`<strong>${t.missingCount} sor HIÁNYOS – a részösszeg nem végleges ajánlati ár.</strong>`}`;
  }
  for(const id of ['quickSearch','quickTrade'])$b(id).addEventListener(id==='quickSearch'?'input':'change',quickChoices);
  $b('quickItem').addEventListener('change',quickModes);
  $b('quickMethod').addEventListener('change',quickInputLayout);
  for(const id of ['quickQuantity','quickLength','quickWidth','quickHeight','quickDepth','quickOpenings'])$b(id).addEventListener('input',quickPreview);
  $b('quickAdd').onclick=()=>run(()=>{
    const row=quickDraft();E.lineCost(row,state.settings); // validates before mutating the quote
    const candidate=[...named(),row];E.calculate(candidate,state.settings);
    items=candidate;selected=items.length-1;
    renderItems();calcAndRender();renderEditor();quickOverall();
    toast('A munkatétel bekerült az ajánlatba.');
    if(!E.lineCost(row,state.settings).complete)$b('quickPreview').scrollIntoView({block:'nearest'});
  });
  $b('quickMaterialTemplate').onclick=()=>run(()=>{
    const text=D.template(materials()),url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
    a.href=url;a.download='szakipiac-anyagar-fajlagos-70-anyag-SABLON.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $b('quickMaterialImport').onchange=async event=>{
    const field=event.target,file=field.files?.[0];if(!file)return;
    const contextItems=items,contextEpoch=quoteContextEpoch;
    try{
      if(file.size>2000000)throw Error('Az anyag-CSV legfeljebb 2 MB lehet.');
      const parsed=D.importMaterialData(await file.text(),materials(),E);
      if(contextItems!==items||quoteContextEpoch!==contextEpoch)throw Error('Időközben másik ajánlat nyílt; az importot meg kell ismételni.');
      if(!confirm(parsed.prices+' anyagár és '+parsed.ratios+' fajlagos kerül a projekt katalógusába; a mentett ajánlatsorok változatlanok. Folytatod?'))return;
      atomicRegistryUpdate({registry_version:1,material_catalog:parsed.entries,norm_catalog:E.copy(norms())});
      quickPreview();quickOverall();toast('Anyagadatok betöltve a katalógusba, a régi ajánlatok változatlanok.');
    }catch(error){fail(error);}finally{field.value='';}
  };
  $b('quickNormTemplate').onclick=()=>run(()=>{
    const text=Q.normTemplate(catalog()),url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
    a.href=url;a.download='szakipiac-188-tetel-normaidok-SABLON.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $b('quickNormImport').onchange=async event=>{
    const field=event.target, file=field.files?.[0];if(!file)return;
    const contextItems=items,contextEpoch=quoteContextEpoch;
    try {
      if(file.size>2000000)throw Error('A norma CSV legfeljebb 2 MB lehet.');
      const parsed=Q.importNorms(await file.text(),catalog(),E,norms());
      if(contextItems!==items||quoteContextEpoch!==contextEpoch)throw Error('Időközben másik ajánlatot nyitottál; az import megszakadt.');
      if(!confirm(parsed.count+' ellenőrizhető normaidőt töltesz a katalógusba. A meglévő ajánlatsorok nem módosulnak. Folytatod?'))return;
      atomicRegistryUpdate({registry_version:1,material_catalog:E.copy(materials()),norm_catalog:parsed.entries});
      quickPreview();toast(parsed.count+' norma beolvasva. A már meglévő ajánlatok normái nem változtak.');
    }catch(error){fail(error);}finally{field.value='';}
  };
  quickChoices();
  const oldShare=window.shareQuoteWithClient;
  window.shareQuoteWithClient=async function(id,days){const {data,error}=await supa.from('ajanlatok').select('payload').eq('id',id).single();if(error)return toast('Az ajánlat teljessége nem ellenőrizhető.','error');if(data?.payload?.building_budget?.enabled)return toast('A részletes munkaváltozat ügyfélelfogadása még nincs bekötve. JSON/PDF/CSV menthető.','error');return oldShare(id,days);};
  $b('buildingEnable').onclick=()=>run(()=>{if($b('currency').value!=='HUF')throw Error('A részletes munkaváltozat csak HUF-ban használható.');state.enabled=true;if(state.settings.rate==null){state.settings=E.settings({...state.settings,rate:Q.OFFICIAL_RATE});state.rate_reference=Q.reference();}if(state.settings.rate_includes_overhead==null&&state.settings.overhead_percent===0)state.settings.rate_includes_overhead=true;items=items.map(E.adopt);settingsForms();renderItems();calcAndRender();renderCatalog();});
  $b('buildingSample').onclick=()=>run(()=>{if(named().length&&!confirm('A mintaprojekt lecseréli a jelenlegi szerkesztett ajánlatot. Előtte ments JSON-fájlt. Folytatod?'))return;const p=E.sample(base);window.applyPayload(p);detachQuoteVersion();$b('quote_status').value='draft';calcAndRender();});
  $b('buildingComponentSample').onclick=()=>run(()=>{if(named().length&&!confirm('Az összetevős minta lecseréli a jelenlegi ajánlatot. Előtte ments JSON-fájlt. Folytatod?'))return;window.applyPayload(E.componentSample(base));detachQuoteVersion();$b('quote_status').value='draft';calcAndRender();});
  $b('buildingTradeSample').onclick=()=>run(()=>{if(named().length&&!confirm('A több szakágas minta lecseréli a jelenlegi ajánlatot. Előtte ments JSON-fájlt. Folytatod?'))return;const p=E.tradeSample(base);p.building_budget.settings.rate=Q.OFFICIAL_RATE;p.building_budget.rate_reference=Q.reference();window.applyPayload(p);detachQuoteVersion();$b('quote_status').value='draft';calcAndRender();});
  $b('buildingCalculate').onclick=()=>run(()=>{
    const geo={};for(const key of Object.keys(geometryLabels))geo[key]=E.number($b('bg-'+key).value,geometryLabels[key]);
    const newRows=E.geometryRows(geo,catalog());const candidates=items.filter(r=>String(r.name||'').trim());
    for(const row of newRows){const index=candidates.findIndex(r=>r.budget?.calc_key===row.budget.calc_key);if(index<0)candidates.push(row);else {const old=candidates[index];candidates[index]=E.updateComponentGeometry({...old,qty:row.qty,budget:{...old.budget,material_factor:row.budget.material_factor,materials:row.budget.materials,quantity_source:row.budget.quantity_source}},geo);}}
    E.calculate(candidates,state.settings);state.geometry=geo;items=candidates;renderItems();calcAndRender();renderEditor();
  });
  $b('buildingSearch').oninput=renderCatalog;$b('buildingTrade').onchange=renderCatalog;
  $b('buildingCatalog').onclick=e=>{const button=e.target.closest('[data-building-add]');if(!button)return;run(()=>{items=items.filter(r=>String(r.name||'').trim());items.push(E.fromCatalog(catalog().find(r=>r.id===button.dataset.buildingAdd)));selected=items.length-1;renderItems();calcAndRender();renderEditor();});};
  $b('buildingRows').onclick=e=>run(()=>{const edit=e.target.closest('[data-building-edit]'),del=e.target.closest('[data-building-delete]');if(edit){selected=Number(edit.dataset.buildingEdit);renderEditor();$b('buildingEditor').scrollIntoView({block:'nearest'});}if(del){items.splice(Number(del.dataset.buildingDelete),1);selected=-1;renderItems();calcAndRender();renderEditor();}});
  $b('buildingCustom').onclick=()=>run(()=>{const name=$b('buildingCustomName').value.trim(),unit=$b('buildingCustomUnit').value.trim();if(!name||!unit)throw Error('Megnevezés és mértékegység szükséges.');if(state.custom_catalog.length>=500)throw Error('Legfeljebb 500 saját tétel tárolható.');const row={id:'sajat-'+crypto.randomUUID(),szakag:$b('buildingCustomTrade').value,megnevezes:name,egyseg:unit,anyag_atlag:null,norma_ora_atlag:null,forras:'Saját tétel, ár még nincs megadva',price_kind:'missing',norm_kind:'unknown'};state.custom_catalog.push(row);items=items.filter(r=>String(r.name||'').trim());items.push(E.fromCatalog(row));selected=items.length-1;renderCatalog();renderItems();calcAndRender();renderEditor();});
  $b('buildingCsv').onclick=()=>run(()=>{const blob=new Blob([E.csv(payloadNow(),base)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='szakipiac-reszletes-koltsegvetes.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  document.addEventListener('click',event=>{if(state.enabled&&$b('buildingError').textContent&&event.target.closest('#btnSave,#btnExportJson,#btnPdfPro,#btnPdfProBottom,#btnPrint,#btnPrintBottom,#buildingCsv')){event.preventDefault();event.stopImmediatePropagation();toast('Mentés és export előtt javítsd a jelzett hibás mezőt.','error');}},true);
  // The existing file import applies the validated snapshot before changing quote identity.
  window.SzakiPiacBuildingUI={state,render,catalog,snapshot,budgetTotal};
  settingsForms();renderCatalog();render();renderLibraries();
})();

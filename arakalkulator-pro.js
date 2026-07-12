(function () {
  const REGION_FACTORS = {
    "Budapest": 1.18, "Pest": 1.10, "Győr-Moson-Sopron": 1.08,
    "Fejér": 1.05, "Veszprém": 1.04, "Komárom-Esztergom": 1.04,
    "Hajdú-Bihar": 1.02, "Csongrád-Csanád": 1.02, "Baranya": 1.00,
    "Bács-Kiskun": 1.00, "Békés": 0.95, "Borsod-Abaúj-Zemplén": 0.96,
    "Heves": 0.98, "Jász-Nagykun-Szolnok": 0.96, "Nógrád": 0.94,
    "Somogy": 0.98, "Szabolcs-Szatmár-Bereg": 0.95, "Tolna": 0.97,
    "Vas": 1.02, "Zala": 1.00, "Országos átlag": 1.00
  };
  const QUALITY_FACTORS = { alap: 0.88, kozep: 1, premium: 1.32 };
  const DEFAULT_OVERHEAD_RATE = 6764;
  let catalog = [];

  function pricingSettings() {
    return {
      band: document.getElementById("price_band")?.value || "atlag",
      quality: document.getElementById("material_quality")?.value || "kozep",
      region: document.getElementById("price_region")?.value || "Országos átlag",
      method: document.getElementById("pricing_method")?.value || "norma"
    };
  }
  function regionFactor() { return REGION_FACTORS[pricingSettings().region] || 1; }
  function qualityFactor() { return QUALITY_FACTORS[pricingSettings().quality] || 1; }
  function bandValue(item, kind) {
    const band = pricingSettings().band;
    return safeNum(item?.ranges?.[kind]?.[band] ?? item?.[kind === "mat" ? "mat_unit_price" : "lab_unit_price"]);
  }
  function effectiveMat(item) { return bandValue(item, "mat") * qualityFactor() * regionFactor() * materialMarginFactor(); }
  function normHours(item) {
    const band = pricingSettings().band;
    const value = safeNum(item?.norms?.[band] ?? item?.norm_ora_atlag);
    return value > 0 ? safeNum(item.qty) * value : 0;
  }
  function effectiveLab(item) {
    if (pricingSettings().method === "norma" && normHours(item) > 0) {
      return (normHours(item) / Math.max(1, safeNum(item.qty))) * Math.max(0, safeNum($("overhead_rate").value)) * regionFactor();
    }
    return bandValue(item, "lab") * regionFactor();
  }

  function conditionSettings() {
    return {
      building: $("condition_building")?.value || "csaladi",
      floor: Math.max(0, safeNum($("condition_floor")?.value)),
      lift: $("condition_lift")?.value || "igen",
      occupied: $("condition_occupied")?.checked || false,
      access: $("condition_access")?.value || "jo",
      parking: Math.max(0, safeNum($("condition_parking")?.value)),
      waste: $("condition_waste")?.value || "nincs"
    };
  }

  function conditionCosts(baseLabor, baseHours, rate) {
    const c = conditionSettings(), details = [];
    let handlingHours = 0;
    if (c.floor > 0 && c.lift === "nem") handlingHours = (baseHours * Math.min(.05 * c.floor, .30)) + (.35 * c.floor);
    else if (c.floor > 0 && c.lift === "korlatozott") handlingHours = (baseHours * Math.min(.02 * c.floor, .12)) + (.15 * c.floor);
    const handling = handlingHours * rate;
    if (handling > 0) details.push({ label:`Anyagmozgatás (${c.floor}. emelet, ${c.lift === "nem" ? "lift nélkül" : "korlátozott lifttel"})`, amount:handling, info:"A becsült fel- és lehordási többletidő alapján." });
    const parkingHours = c.parking >= 100 ? 3 : c.parking >= 50 ? 1.5 : c.parking >= 20 ? .75 : 0;
    const parking = parkingHours * rate;
    if (parking > 0) details.push({ label:`Rakodás és mozgatás (${c.parking} m)`, amount:parking, info:"A parkolóhely és a munkaterület közötti távolság alapján." });
    if (c.occupied) details.push({ label:"Lakott ingatlan miatti többletmunka", amount:baseLabor * .10, info:"Takarás, szakaszos munkavégzés és fokozott védelem becsült többlete." });
    if (c.access === "nehez") details.push({ label:"Nehezen megközelíthető munkaterület", amount:baseLabor * .08, info:"Szűk vagy korlátozott munkaterület miatti időkorrekció." });
    if (c.waste !== "nincs") details.push({ label:c.waste === "sok" ? "Nagy mennyiségű sitt kezelése" : "Sitt összegyűjtése és mozgatása", amount:rate * (c.waste === "sok" ? 6 : 2), info:"Becsült rakodási és belső mozgatási idő; a konténer díja külön tétel lehet." });
    return { details, total:details.reduce((sum, x) => sum + x.amount, 0), extraHours:handlingHours + parkingHours };
  }
  function syncSelectedBand() {
    items.forEach(item => {
      if (!item.ranges) return;
      item.mat_unit_price = bandValue(item, "mat");
      item.lab_unit_price = bandValue(item, "lab");
    });
  }

  function injectPricingControls() {
    const settingsCard = document.querySelector("#overhead_rate")?.closest(".bg-white");
    if (!settingsCard || document.getElementById("price_region")) return;
    const counties = Object.keys(REGION_FACTORS).map(x => `<option value="${x}" ${x === "Országos átlag" ? "selected" : ""}>${x}</option>`).join("");
    const box = document.createElement("div");
    box.className = "mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4";
    box.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div><div class="font-extrabold text-emerald-950">Ellenőrzött referenciaár-beállítások</div><div id="pricesUpdated" class="text-xs text-emerald-800">Árak betöltése…</div></div>
        <a href="ar-admin.html" id="priceAdminLink" class="hidden rounded-xl bg-slate-900 px-3 py-2 text-xs font-extrabold text-white no-print">Árak szerkesztése</a>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <label class="text-sm font-bold">Számítás módja<select id="pricing_method" class="mt-1 w-full rounded-xl border p-2"><option value="norma" selected>Normaidő × rezsióradíj</option><option value="referencia">Referencia munkadíj</option></select></label>
        <label class="text-sm font-bold">Ársáv<select id="price_band" class="mt-1 w-full rounded-xl border p-2"><option value="min">Minimum</option><option value="atlag" selected>Átlag</option><option value="max">Maximum</option></select></label>
        <label class="text-sm font-bold">Vármegye / terület<select id="price_region" class="mt-1 w-full rounded-xl border p-2">${counties}</select></label>
        <label class="text-sm font-bold">Anyagminőség<select id="material_quality" class="mt-1 w-full rounded-xl border p-2"><option value="alap">Alap</option><option value="kozep" selected>Közép</option><option value="premium">Prémium</option></select></label>
      </div>
      <p class="mt-3 text-xs text-emerald-900">Normaidős számításnál a munkadíj a mennyiség, a tétel normamideje és a rezsióradíj alapján készül. A szakember a végső ajánlat előtt minden tételt jóváhagy.</p>`;
    settingsCard.insertBefore(box, settingsCard.children[1]);
    ["pricing_method","price_band","price_region","material_quality"].forEach(id => document.getElementById(id).addEventListener("change", () => { if (id === "price_band") syncSelectedBand(); renderItems(); calcAndRender(); }));

    if (safeNum($("overhead_rate").value) <= 0) $("overhead_rate").value = DEFAULT_OVERHEAD_RATE;
    const conditions = document.createElement("details");
    conditions.id = "projectConditions";
    conditions.className = "mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 no-print";
    conditions.innerHTML = `<summary class="cursor-pointer font-extrabold text-slate-900">Munkakörülmények <span class="ml-2 text-xs font-normal text-slate-500">Csak akkor nyisd le, ha eltérnek az alaphelyzettől</span></summary>
      <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <label class="text-xs font-bold">Épület<select id="condition_building" class="mt-1 w-full rounded-lg border p-2"><option value="csaladi">Családi ház</option><option value="tarsashaz">Társasház</option><option value="ipari">Ipari / egyéb</option></select></label>
        <label class="text-xs font-bold">Emelet<input id="condition_floor" type="number" min="0" value="0" class="mt-1 w-full rounded-lg border p-2"></label>
        <label class="text-xs font-bold">Használható lift<select id="condition_lift" class="mt-1 w-full rounded-lg border p-2"><option value="igen">Igen / földszint</option><option value="korlatozott">Korlátozott</option><option value="nem">Nincs</option></select></label>
        <label class="text-xs font-bold">Parkolási távolság<input id="condition_parking" type="number" min="0" value="0" class="mt-1 w-full rounded-lg border p-2" placeholder="méter"></label>
        <label class="text-xs font-bold">Megközelítés<select id="condition_access" class="mt-1 w-full rounded-lg border p-2"><option value="jo">Könnyű</option><option value="nehez">Nehéz / szűk</option></select></label>
        <label class="text-xs font-bold">Sitt mennyisége<select id="condition_waste" class="mt-1 w-full rounded-lg border p-2"><option value="nincs">Nincs</option><option value="keves">Kevés</option><option value="sok">Sok</option></select></label>
        <label class="col-span-2 flex items-center gap-2 rounded-lg border bg-white p-2 text-xs font-bold"><input id="condition_occupied" type="checkbox" class="h-4 w-4"> Lakott ingatlan</label>
      </div>
      <p class="mt-3 text-xs text-slate-600">A többletek külön, magyarázható járulékos költségként jelennek meg, nem rejtett általános felárként.</p>`;
    settingsCard.insertBefore(conditions, settingsCard.children[2]);
    conditions.querySelectorAll("input,select").forEach(el => { el.addEventListener("input", calcAndRender); el.addEventListener("change", calcAndRender); });

    const globalUnit = document.getElementById("global_unit")?.closest("div");
    if (globalUnit) globalUnit.classList.add("hidden");
    const globalLabel = document.querySelector('label[for="global_qty"]');
    if (globalLabel) globalLabel.textContent = "Kijelölt tételek mennyisége";

    const grid = document.querySelector("[data-pkg=laminalt]")?.parentElement;
    if (grid) {
      [
        ["jarulekos-bontas","Bontás","fa-hammer"], ["jarulekos-szallitas","Szállítás","fa-truck"],
        ["jarulekos-kiszallas","Kiszállás","fa-route"], ["jarulekos-hulladek","Hulladék","fa-dumpster"],
        ["jarulekos-gep","Géphasználat","fa-screwdriver-wrench"]
      ].forEach(([id,label,icon]) => {
        const b = document.createElement("button"); b.dataset.priceId = id;
        b.className = "rounded-2xl border bg-gradient-to-br from-orange-50 to-white p-4 hover:shadow-soft transition";
        b.innerHTML = `<div class="text-orange-700 text-xl"><i class="fa-solid ${icon}"></i></div><div class="mt-2 text-[11px] font-black tracking-widest uppercase">${label}</div><div class="text-[11px] text-gray-500 mt-1">külön tétel</div>`;
        b.addEventListener("click", () => addCatalogItem(id)); grid.insertBefore(b, document.getElementById("btnAddCustomRow"));
      });
    }

    const printArea = document.getElementById("printArea");
    if (printArea && !document.getElementById("estimateDisclaimer")) {
      const breakdown = document.createElement("div"); breakdown.id = "printCostBreakdown";
      breakdown.className = "mt-5 rounded-xl border border-slate-200 p-4 text-sm";
      printArea.appendChild(breakdown);
      const note = document.createElement("div"); note.id = "estimateDisclaimer";
      note.className = "mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950";
      note.innerHTML = `<b>Fontos:</b> Ez előzetes költségbecslés, nem végleges vállalási ár. A végleges ajánlat helyszíni felmérés, műszaki egyeztetés és szakemberi jóváhagyás után érvényes.`;
      printArea.appendChild(note);
    }
  }

  function catalogToItem(row) {
    const canUseNorm = row.egyseg !== "alkalom" && safeNum(row.munka_atlag) > 0;
    const derivedNorm = value => canUseNorm ? safeNum(value) / DEFAULT_OVERHEAD_RATE : 0;
    return {
      price_id: row.id, name: row.megnevezes, type: row.tipus || "anyag",
      qty: safeNum(row.alap_mennyiseg) || 1, unit: row.egyseg,
      mat_unit_price: safeNum(row.anyag_atlag), lab_unit_price: safeNum(row.munka_atlag), hours: 0, selected: false,
      source: row.forras || "", updated_at: row.frissitve || "", scope: row.munkatartalom || "",
      norm_ora_atlag: safeNum(row.norma_ora_atlag) || derivedNorm(row.munka_atlag),
      norms: {
        min:safeNum(row.norma_ora_min) || derivedNorm(row.munka_min),
        atlag:safeNum(row.norma_ora_atlag) || derivedNorm(row.munka_atlag),
        max:safeNum(row.norma_ora_max) || derivedNorm(row.munka_max)
      },
      ranges: { mat: { min:safeNum(row.anyag_min), atlag:safeNum(row.anyag_atlag), max:safeNum(row.anyag_max) }, lab: { min:safeNum(row.munka_min), atlag:safeNum(row.munka_atlag), max:safeNum(row.munka_max) } }
    };
  }
  function addCatalogItem(id) {
    const row = catalog.find(x => x.id === id); if (!row) return toast("Ez a referenciaár még nem töltődött be.", "error");
    items.push(catalogToItem(row)); renderItems(); calcAndRender(); toast("Tétel hozzáadva ✅");
  }

  async function loadCatalog() {
    const { data, error } = await supa.from("epitoipari_arak").select("*").eq("aktiv", true).order("szakag").order("megnevezes");
    if (error || !data?.length) {
      document.getElementById("pricesUpdated").textContent = "Az online árkatalógus nem érhető el; a beépített referenciaárak használhatók.";
      return;
    }
    catalog = data;
    const dates = data.map(x => x.frissitve).filter(Boolean).sort();
    document.getElementById("pricesUpdated").textContent = `Árak frissítve: ${dates[dates.length-1] || "nincs dátum"} • ${data.length} aktív tétel`;
    const session = await refreshSession();
    if ((session?.user?.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase()) document.getElementById("priceAdminLink")?.classList.remove("hidden");
  }

  const oldRenderItems = renderItems;
  window.renderItems = function () {
    oldRenderItems();
    document.querySelectorAll("#itemsBody tr").forEach((tr, i) => {
      const item = items[i]; if (!item?.ranges) return;
      [[5,"mat"],[6,"lab"]].forEach(([cell,kind]) => {
        const r = item.ranges[kind]; const div = document.createElement("div");
        div.className = "mt-1 text-[10px] leading-tight text-emerald-700";
        div.textContent = `min ${fmtMoney(r.min,$("currency").value)} • átlag ${fmtMoney(r.atlag,$("currency").value)} • max ${fmtMoney(r.max,$("currency").value)}`;
        tr.children[cell]?.appendChild(div);
      });
      if (item.norms?.atlag > 0) {
        const note=document.createElement("div"); note.className="mt-1 text-[10px] text-indigo-700";
        note.textContent=`Normaidő: ${item.norms.min || item.norms.atlag}–${item.norms.max || item.norms.atlag} óra/${item.unit}`;
        tr.children[7]?.appendChild(note);
      }
    });
  };
  window.rowNet = it => safeNum(it.qty) * (effectiveMat(it) + effectiveLab(it));
  window.totals = function () {
    const currency = $("currency").value;
    const sumMat = items.reduce((a,it) => a + safeNum(it.qty)*effectiveMat(it),0);
    const sumLab = items.reduce((a,it) => a + safeNum(it.qty)*effectiveLab(it),0);
    const subtotalNet = sumMat + sumLab;
    const manualHours = pricingSettings().method === "norma" ? items.reduce((a,it)=>a+(normHours(it)>0?0:(it.type === "munka" ? safeNum(it.hours) : 0)),0) : totalHours();
    const overheadNet = manualHours * Math.max(0,safeNum($("overhead_rate").value));
    const calculatedNormHours = items.reduce((a,it)=>a+normHours(it),0);
    const conditions = conditionCosts(sumLab + overheadNet, calculatedNormHours + manualHours, Math.max(0,safeNum($("overhead_rate").value)) * regionFactor());
    const discountNet = Math.max(0,safeNum($("discount_net").value));
    const baseNet = Math.max(0,subtotalNet+overheadNet+conditions.total-discountNet);
    const profitNet = baseNet*Math.max(0,safeNum($("profit_percent").value))/100;
    const netTotal = baseNet+profitNet, vatRate=$("vat_enabled").checked?Math.max(0,safeNum($("vat_rate").value)):0;
    const vatAmount=netTotal*vatRate/100, grossTotal=netTotal+vatAmount;
    return {currency,sumMat,sumLab,subtotalNet,overheadNet,ancillaryNet:conditions.total,ancillaryDetails:conditions.details,discountNet,profitNet,vatRate,vatAmount,netTotal,grossTotal,totalHours:calculatedNormHours+manualHours+conditions.extraHours,regionFactor:regionFactor(),qualityFactor:qualityFactor(),pricing:pricingSettings(),conditions:conditionSettings()};
  };
  const oldCalc = calcAndRender;
  window.calcAndRender = function () {
    oldCalc(); const t=totals();
    renderTransparentSummary(t);
    $("print_items").innerHTML=items.map(it=>`<tr class="border-b"><td class="p-2 font-semibold">${escapeHtml(it.name||"—")}</td><td class="p-2">${escapeHtml(it.type)}</td><td class="p-2">${escapeHtml(it.qty)}</td><td class="p-2">${escapeHtml(it.unit)}</td><td class="p-2">${escapeHtml(fmtMoney(effectiveMat(it),t.currency))}</td><td class="p-2">${escapeHtml(fmtMoney(effectiveLab(it),t.currency))}</td><td class="p-2 font-bold">${escapeHtml(fmtMoney(rowNet(it),t.currency))}</td></tr>`).join("");
  };

  function renderTransparentSummary(t) {
    const summary = $("sum_mat")?.closest(".space-y-2");
    if (!summary) return;
    let box = $("transparentCostDetails");
    if (!box) {
      box = document.createElement("details"); box.id="transparentCostDetails";
      box.className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm";
      summary.parentElement.insertBefore(box, summary.nextSibling);
    }
    const rows = [
      {label:"Anyagköltség",amount:t.sumMat,info:"A mennyiség, az ársáv és a választott anyagminőség alapján."},
      {label:"Munkadíj",amount:t.sumLab+t.overheadNet,info:t.pricing.method === "norma" ? "A mennyiség × normaidő × rezsióradíj alapján." : "A kiválasztott referencia-munkadíjak alapján."},
      {label:"Járulékos költségek",amount:t.ancillaryNet,info:"Anyagmozgatás, rakodás, hozzáférés és egyéb megadott munkakörülmények."}
    ];
    box.innerHTML=`<summary class="cursor-pointer font-extrabold">Mit tartalmaz a becslés?</summary><div class="mt-3 space-y-2">${rows.map(x=>`<div><div class="flex justify-between gap-3"><b>${x.label}</b><b>${fmtMoney(x.amount,t.currency)}</b></div><p class="text-xs text-slate-500">${x.info}</p></div>`).join("")}${t.ancillaryDetails.length?`<div class="border-t pt-2"><b>Járulékos költségek részletesen</b>${t.ancillaryDetails.map(x=>`<div class="mt-2 flex justify-between gap-3"><span title="${escapeHtml(x.info)}">${escapeHtml(x.label)} ⓘ</span><b>${fmtMoney(x.amount,t.currency)}</b></div>`).join("")}</div>`:"<p class=\"border-t pt-2 text-xs text-slate-500\">Nincs megadott körülményből származó többletköltség.</p>"}</div>`;
    const printBreakdown=$("printCostBreakdown");
    if(printBreakdown) printBreakdown.innerHTML=`<div class="font-bold mb-2">Részletes költségbontás</div>${rows.map(x=>`<div class="flex justify-between"><span>${x.label}</span><b>${fmtMoney(x.amount,t.currency)}</b></div>`).join("")}${t.ancillaryDetails.map(x=>`<div class="ml-3 mt-1 flex justify-between text-xs text-slate-600"><span>${escapeHtml(x.label)}</span><span>${fmtMoney(x.amount,t.currency)}</span></div>`).join("")}`;
    $("sum_overhead").textContent=fmtMoney(t.overheadNet+t.ancillaryNet,t.currency);
    $("sum_overhead").parentElement.firstElementChild.textContent="Járulékos / külön munka (nettó)";
    $("p_sum_overhead").textContent=fmtMoney(t.overheadNet+t.ancillaryNet,t.currency);
  }
  window.addPackage = function (key) {
    const rows=catalog.filter(x=>x.szakag===key); if(!rows.length)return toast("Ehhez a szakághoz még nincs online árkatalógus.","error");
    rows.forEach(row=>items.push(catalogToItem(row))); renderItems(); calcAndRender(); toast(`${rows.length} saját mértékegységű tétel hozzáadva ✅`);
  };
  window.applyGlobal = function () {
    const q=Math.max(0,safeNum($("global_qty").value)); let changed=0;
    items.forEach(it=>{if(it.selected){it.qty=q||it.qty;changed++;}});
    if(!changed)return toast("Nincs kijelölt sor.","info"); renderItems();calcAndRender();toast(`Mennyiség beállítva ${changed} tételnél; a saját mértékegységek megmaradtak ✅`);
  };
  const oldPayloadNow=payloadNow;
  window.payloadNow=function(){
    const p=oldPayloadNow();
    p.settings={...p.settings,...pricingSettings(),...conditionSettings(),region_factor:regionFactor(),quality_factor:qualityFactor()};
    p.cost_breakdown=totals().ancillaryDetails;
    p.items=items.map(item=>({...item,reference_mat_unit_price:safeNum(item.mat_unit_price),reference_lab_unit_price:safeNum(item.lab_unit_price),mat_unit_price:effectiveMat(item),lab_unit_price:effectiveLab(item),applied_region_factor:regionFactor(),applied_quality_factor:qualityFactor()}));
    p.price_catalog_updated=document.getElementById("pricesUpdated")?.textContent||"";
    p.estimate_status="elozetes_becsles_szakemberi_jovahagyasra_var";
    return p;
  };
  const oldApplyPayload=applyPayload;
  window.applyPayload=function(p){oldApplyPayload(p); const s=p?.settings||{}; if(s.band)$("price_band").value=s.band;if(s.quality)$("material_quality").value=s.quality;if(s.region)$("price_region").value=s.region;if(s.method)$("pricing_method").value=s.method;if(s.building)$("condition_building").value=s.building;if(s.floor!=null)$("condition_floor").value=s.floor;if(s.lift)$("condition_lift").value=s.lift;if(s.access)$("condition_access").value=s.access;if(s.parking!=null)$("condition_parking").value=s.parking;if(s.waste)$("condition_waste").value=s.waste;if(s.occupied!=null)$("condition_occupied").checked=!!s.occupied;renderItems();calcAndRender();};

  injectPricingControls();
  loadCatalog().then(()=>{renderItems();calcAndRender();applyUsageGate(window.__session?.data?.session||null);});
})();

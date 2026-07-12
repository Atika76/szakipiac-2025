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
  let catalog = [];

  function pricingSettings() {
    return {
      band: document.getElementById("price_band")?.value || "atlag",
      quality: document.getElementById("material_quality")?.value || "kozep",
      region: document.getElementById("price_region")?.value || "Országos átlag"
    };
  }
  function regionFactor() { return REGION_FACTORS[pricingSettings().region] || 1; }
  function qualityFactor() { return QUALITY_FACTORS[pricingSettings().quality] || 1; }
  function bandValue(item, kind) {
    const band = pricingSettings().band;
    return safeNum(item?.ranges?.[kind]?.[band] ?? item?.[kind === "mat" ? "mat_unit_price" : "lab_unit_price"]);
  }
  function effectiveMat(item) { return bandValue(item, "mat") * qualityFactor() * regionFactor() * materialMarginFactor(); }
  function effectiveLab(item) { return bandValue(item, "lab") * regionFactor(); }
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
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label class="text-sm font-bold">Ársáv<select id="price_band" class="mt-1 w-full rounded-xl border p-2"><option value="min">Minimum</option><option value="atlag" selected>Átlag</option><option value="max">Maximum</option></select></label>
        <label class="text-sm font-bold">Vármegye / terület<select id="price_region" class="mt-1 w-full rounded-xl border p-2">${counties}</select></label>
        <label class="text-sm font-bold">Anyagminőség<select id="material_quality" class="mt-1 w-full rounded-xl border p-2"><option value="alap">Alap</option><option value="kozep" selected>Közép</option><option value="premium">Prémium</option></select></label>
      </div>
      <p class="mt-3 text-xs text-emerald-900">A területi szorzó az anyag- és munkadíjra, a minőségi szorzó csak az anyagra vonatkozik. A szakember a végső ajánlat előtt minden tételt jóváhagy.</p>`;
    settingsCard.insertBefore(box, settingsCard.children[1]);
    ["price_band","price_region","material_quality"].forEach(id => document.getElementById(id).addEventListener("change", () => { if (id === "price_band") syncSelectedBand(); renderItems(); calcAndRender(); }));

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
      const note = document.createElement("div"); note.id = "estimateDisclaimer";
      note.className = "mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950";
      note.innerHTML = `<b>Fontos:</b> Ez előzetes költségbecslés, nem végleges vállalási ár. A végleges ajánlat helyszíni felmérés, műszaki egyeztetés és szakemberi jóváhagyás után érvényes.`;
      printArea.appendChild(note);
    }
  }

  function catalogToItem(row) {
    return {
      price_id: row.id, name: row.megnevezes, type: row.tipus || "anyag",
      qty: safeNum(row.alap_mennyiseg) || 1, unit: row.egyseg,
      mat_unit_price: safeNum(row.anyag_atlag), lab_unit_price: safeNum(row.munka_atlag), hours: 0, selected: false,
      source: row.forras || "", updated_at: row.frissitve || "",
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
    });
  };
  window.rowNet = it => safeNum(it.qty) * (effectiveMat(it) + effectiveLab(it));
  window.totals = function () {
    const currency = $("currency").value;
    const sumMat = items.reduce((a,it) => a + safeNum(it.qty)*effectiveMat(it),0);
    const sumLab = items.reduce((a,it) => a + safeNum(it.qty)*effectiveLab(it),0);
    const subtotalNet = sumMat + sumLab;
    const overheadNet = totalHours() * Math.max(0,safeNum($("overhead_rate").value));
    const discountNet = Math.max(0,safeNum($("discount_net").value));
    const baseNet = Math.max(0,subtotalNet+overheadNet-discountNet);
    const profitNet = baseNet*Math.max(0,safeNum($("profit_percent").value))/100;
    const netTotal = baseNet+profitNet, vatRate=$("vat_enabled").checked?Math.max(0,safeNum($("vat_rate").value)):0;
    const vatAmount=netTotal*vatRate/100, grossTotal=netTotal+vatAmount;
    return {currency,sumMat,sumLab,subtotalNet,overheadNet,discountNet,profitNet,vatRate,vatAmount,netTotal,grossTotal,totalHours:totalHours(),regionFactor:regionFactor(),qualityFactor:qualityFactor(),pricing:pricingSettings()};
  };
  const oldCalc = calcAndRender;
  window.calcAndRender = function () {
    oldCalc(); const t=totals();
    $("print_items").innerHTML=items.map(it=>`<tr class="border-b"><td class="p-2 font-semibold">${escapeHtml(it.name||"—")}</td><td class="p-2">${escapeHtml(it.type)}</td><td class="p-2">${escapeHtml(it.qty)}</td><td class="p-2">${escapeHtml(it.unit)}</td><td class="p-2">${escapeHtml(fmtMoney(effectiveMat(it),t.currency))}</td><td class="p-2">${escapeHtml(fmtMoney(effectiveLab(it),t.currency))}</td><td class="p-2 font-bold">${escapeHtml(fmtMoney(rowNet(it),t.currency))}</td></tr>`).join("");
  };
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
    p.settings={...p.settings,...pricingSettings(),region_factor:regionFactor(),quality_factor:qualityFactor()};
    p.items=items.map(item=>({...item,reference_mat_unit_price:safeNum(item.mat_unit_price),reference_lab_unit_price:safeNum(item.lab_unit_price),mat_unit_price:effectiveMat(item),lab_unit_price:effectiveLab(item),applied_region_factor:regionFactor(),applied_quality_factor:qualityFactor()}));
    p.price_catalog_updated=document.getElementById("pricesUpdated")?.textContent||"";
    p.estimate_status="elozetes_becsles_szakemberi_jovahagyasra_var";
    return p;
  };
  const oldApplyPayload=applyPayload;
  window.applyPayload=function(p){oldApplyPayload(p); if(p?.settings?.band)$("price_band").value=p.settings.band;if(p?.settings?.quality)$("material_quality").value=p.settings.quality;if(p?.settings?.region)$("price_region").value=p.settings.region;renderItems();calcAndRender();};

  injectPricingControls();
  loadCatalog().then(()=>{renderItems();calcAndRender();applyUsageGate(window.__session?.data?.session||null);});
})();

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SzakiPiacQuoteWorkshop = api;
  if (typeof document !== "undefined") api.mount();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const round = (value, digits = 2) => {
    const p = 10 ** digits;
    return Math.round((Number(value) || 0) * p) / p;
  };
  const positive = value => Math.max(0, Number(String(value ?? 0).replace(",", ".")) || 0);
  const field = (id, label, value, unit, advanced = false, options = null) => ({ id, label, value, unit, advanced, options });
  const material = (name, qty, unit, note = "") => ({ name, qty: round(qty), unit, note });
  const line = (priceId, qty, fallback = null, label = null, unit = null, factors = {}) => ({ priceId, qty: round(qty), fallback, label, unit, ...factors });
  const ref = (name, unit, mat, lab, norm = 0) => ({ name, unit, mat, lab, norm });
  const REFERENCE_FALLBACKS = {
    "szerkezet-gepi-asas": ref("Gépi alapárok ásás", "m³", 0, 3500, 0.52),
    "szerkezet-savalap": ref("Sávalap betonozás (C16/20)", "m³", 35000, 15500, 2.29),
    "szerkezet-fofal": ref("Főfalazás (30-as tégla)", "m²", 12500, 8500, 1.26),
    "szerkezet-valaszfal": ref("Válaszfalazás (10-es tégla)", "m²", 6800, 5500, 0.81),
    "festo-elokeszites": ref("Felület-előkészítés és alapozás", "m²", 450, 850, 0.13),
    "festo-glett": ref("Glettelés és csiszolás 2 rétegben", "m²", 1100, 2850, 0.42),
    "festo-festes": ref("Festés 2 rétegben, fehér", "m²", 850, 1600, 0.24),
    "burkolo-padlo": ref("Padlóburkolás hidegburkolattal", "m²", 6200, 9800, 1.45),
    "burkolo-labazat": ref("Lábazat rakása", "fm", 1800, 2500, 0.37),
    "karton-fal": ref("Gipszkarton válaszfal, dupla lap", "m²", 9500, 8200, 1.21),
    "homlokzat-eps": ref("Komplett homlokzati hőszigetelés, 15 cm EPS", "m²", 12500, 15000, 2.22),
    "laminalt-padlo": ref("Laminált padló fektetése alátéttel", "m²", 4800, 3500, 0.52),
    "laminalt-szegely": ref("Szegélyléc rakása", "fm", 1200, 1800, 0.27),
    "vakolas-gepi": ref("Gépi vakolás oldalfalon", "m²", 3800, 5200, 0.77),
    "acs-folia-lec": ref("Tetőlécezés és fóliázás", "m²", 3950, 3450, 0.51),
    "acs-cserep": ref("Cserépfedés alapcserepekkel", "m²", 8800, 5800, 0.86),
    "acs-eresz": ref("Ereszcsatorna rendszer szerelése", "fm", 5800, 4800, 0.71),
    "aljzat-estrich": ref("Estrich betonozás", "m²", 4500, 4200, 0.62),
    "villany-kiallas": ref("Villamos alapszerelés kiállásonként", "db", 5500, 14500, 2.14),
    "viz-kiallas": ref("Vízvezeték-kiállás készítése", "db", 19500, 23500, 3.47)
  };

  const TEMPLATES = {
    fence: {
      category: "Szerkezet", name: "Kerítésalap zsalukővel", icon: "🧱",
      help: "Sávalap, vasalás, zsalukőfal és a zsalukő kitöltőbetonja egy számításban.",
      fields: [field("length", "Kerítés hossza", 20, "m"), field("width", "Alap szélessége", 40, "cm"), field("depth", "Alap mélysége", 80, "cm"), field("rows", "Zsalukő sorok", 2, "sor"), field("blockLength", "Zsalukő hossza", 50, "cm", true), field("steel", "Becsült betonacél", 80, "kg/m³", true)],
      calculate(v) {
        const foundation = v.length * v.width / 100 * v.depth / 100;
        const blocks = Math.ceil(v.length / (v.blockLength / 100) * v.rows * 1.05);
        const blockArea = v.length * v.rows * 0.2;
        const fill = blocks * 0.012;
        const concrete = (foundation + fill) * 1.05;
        const steel = foundation * v.steel * 1.08;
        return {
          title: `${round(v.length)} fm kerítésalap ${round(v.rows)} sor zsalukővel`,
          lines: [
            line("szerkezet-gepi-asas", foundation),
            line("szerkezet-savalap", concrete),
            line("guided-zsaluko", blockArea, ref("Zsalukő falazása és kibetonozása", "m²", 12000, 10000, 1.35)),
            line("guided-betonacel", steel, ref("Betonacél szerelése", "kg", 430, 420, 0.055))
          ],
          materials: [material("C16/20 beton, 5% tartalékkal", concrete, "m³"), material("Zsalukő, 5% tartalékkal", blocks, "db"), material("Betonacél, becsült", steel, "kg", "A végleges átmérőt és kiosztást statikus terv határozza meg.")],
          warning: "A vasalás csak mennyiségi becslés. Teherhordó szerkezetnél statikus terv szükséges."
        };
      }
    },
    slab: {
      category: "Beton", name: "Garázs / helyiség vasalt aljzatbeton", icon: "🏗️",
      help: "Felületből és vastagságból számol betont, hálót, fóliát és kivitelezési tételt.",
      fields: [field("area", "Alapterület", 36, "m²"), field("thickness", "Beton vastagsága", 12, "cm"), field("waste", "Beton tartalék", 5, "%", true), field("meshSheet", "Háló hasznos fedése", 10.8, "m²/tábla", true)],
      calculate(v) {
        const concrete = v.area * v.thickness / 100 * (1 + v.waste / 100);
        const mesh = Math.ceil(v.area * 1.1 / v.meshSheet);
        return { title: `${round(v.area)} m² vasalt aljzatbeton`, lines: [line("guided-vasalt-aljzat", v.area, ref("Vasalt aljzatbeton készítése", "m²", 10500, 8500, 1.15), `${round(v.thickness)} cm vasalt aljzatbeton készítése`, null, { matFactor: Math.max(0.45, v.thickness / 12), labFactor: Math.max(0.8, 0.85 + v.thickness / 80) })], materials: [material("Beton", concrete, "m³"), material("Hegesztett háló", mesh, "tábla"), material("PE fólia átfedéssel", v.area * 1.15, "m²")], warning: "A betonminőséget, rétegrendet és vasalást a terhelés és a talajviszonyok alapján szakember hagyja jóvá." };
      }
    },
    mainWall: {
      category: "Falazás", name: "Főfal készítése", icon: "🏠", help: "A nyílások levonásával számolja a nettó falfelületet és a falazóelemet.",
      fields: [field("length", "Fal teljes hossza", 12, "m"), field("height", "Fal magassága", 2.8, "m"), field("openings", "Ajtó- és ablaknyílások", 5, "m²"), field("blocks", "Falazóelem igénye", 10.7, "db/m²", true), field("waste", "Veszteség", 5, "%", true)],
      calculate(v) { const area = Math.max(0, v.length * v.height - v.openings); const blocks = Math.ceil(area * v.blocks * (1 + v.waste / 100)); return { title: `${round(area)} m² főfal készítése`, lines: [line("szerkezet-fofal", area)], materials: [material("30 cm falazóelem", blocks, "db"), material("Falazóhabarcs, tájékoztató", area * 20, "kg")], warning: "Teherhordó falnál a szerkezet, áthidalók és koszorúk méretezését terv szerint kell elvégezni." }; }
    },
    partition: {
      category: "Falazás", name: "Válaszfal készítése", icon: "🧱", help: "Nettó falfelületet, falazóelemet és habarcsot számol.",
      fields: [field("length", "Fal teljes hossza", 10, "m"), field("height", "Fal magassága", 2.7, "m"), field("openings", "Ajtónyílások", 2, "m²"), field("blocks", "Falazóelem igénye", 8, "db/m²", true), field("waste", "Veszteség", 5, "%", true)],
      calculate(v) { const area = Math.max(0, v.length * v.height - v.openings); return { title: `${round(area)} m² válaszfal készítése`, lines: [line("szerkezet-valaszfal", area)], materials: [material("Válaszfal elem", Math.ceil(area * v.blocks * (1 + v.waste / 100)), "db"), material("Falazóhabarcs, tájékoztató", area * 12, "kg")] }; }
    },
    painting: {
      category: "Felületképzés", name: "Szoba festése", icon: "🎨", help: "A helyiség méreteiből számolja a fal- és mennyezetfelületet, festéket és alapozót.",
      fields: [field("length", "Helyiség hossza", 5, "m"), field("width", "Helyiség szélessége", 4, "m"), field("height", "Belmagasság", 2.7, "m"), field("openings", "Nyílások", 5, "m²"), field("ceiling", "Mennyezet beszámítása", 1, "", false, [[1,"Igen"],[0,"Nem"]]), field("coats", "Festékrétegek", 2, "réteg", true), field("coverage", "Festék kiadóssága", 10, "m²/l/réteg", true)],
      calculate(v) { const area = Math.max(0, 2 * (v.length + v.width) * v.height - v.openings + (v.ceiling ? v.length * v.width : 0)); return { title: `${round(area)} m² festési felület`, lines: [line("festo-elokeszites", area), line("festo-glett", area), line("festo-festes", area, null, `${round(v.coats)} réteg festés`, null, { matFactor: Math.max(0.5, v.coats / 2), labFactor: Math.max(0.6, v.coats / 2) })], materials: [material("Festék, 5% tartalékkal", area * v.coats / v.coverage * 1.05, "liter"), material("Mélyalapozó", area * 0.1, "liter"), material("Glett, teljes glettelésnél", area, "kg")] }; }
    },
    tiling: {
      category: "Burkolás", name: "Padló hidegburkolása", icon: "🔲", help: "Burkolandó és rendelendő lapfelületet, ragasztót, fugát és lábazatot számol.",
      fields: [field("area", "Burkolandó felület", 20, "m²"), field("waste", "Vágási veszteség", 10, "%"), field("base", "Lábazat hossza", 18, "fm"), field("adhesive", "Ragasztó igénye", 4.5, "kg/m²", true)],
      calculate(v) { const ordered = v.area * (1 + v.waste / 100); return { title: `${round(v.area)} m² padlóburkolás`, lines: [line("burkolo-padlo", v.area, null, null, null, { matFactor: 1 + v.waste / 100 }), ...(v.base > 0 ? [line("burkolo-labazat", v.base)] : [])], materials: [material("Burkolólap", ordered, "m²"), material("Csemperagasztó", v.area * v.adhesive, "kg"), material("Fugázó, tájékoztató", v.area * 0.35, "kg"), material("Lábazat", v.base * 1.05, "fm")] }; }
    },
    drywall: {
      category: "Szárazépítés", name: "Gipszkarton válaszfal", icon: "⬜", help: "Falgeometriából számol burkolt felületet, lapot, profilt, szigetelést és csavart.",
      fields: [field("length", "Fal hossza", 5, "m"), field("height", "Fal magassága", 2.7, "m"), field("openings", "Nyílások", 2, "m²"), field("layers", "Laprétegek oldalanként", 2, "réteg"), field("waste", "Tartalék", 10, "%", true)],
      calculate(v) { const wall = Math.max(0, v.length * v.height - v.openings); const board = wall * 2 * v.layers * (1 + v.waste / 100); const layerFactor = Math.max(0.5, v.layers / 2); return { title: `${round(wall)} m² gipszkarton válaszfal`, lines: [line("karton-fal", wall, null, `${round(v.layers)} réteg/oldal gipszkarton válaszfal`, null, { matFactor: layerFactor, labFactor: 0.65 + layerFactor * 0.35 })], materials: [material("Gipszkarton lapfelület", board, "m²"), material("120×240 cm lap", Math.ceil(board / 2.88), "db"), material("CW profil, tájékoztató", v.length * 2 + Math.ceil(v.length / 0.6) * v.height, "fm"), material("UW profil", v.length * 2, "fm"), material("Szigetelőanyag", wall * 1.05, "m²"), material("Gyorsépítő csavar", board * 20, "db")] }; }
    },
    facade: {
      category: "Szigetelés", name: "Homlokzati hőszigetelés", icon: "🏡", help: "A nyílások levonásával számolja a homlokzatot és a rendszer fő anyagait.",
      fields: [field("perimeter", "Épület kerülete", 40, "m"), field("height", "Homlokzat magassága", 6, "m"), field("openings", "Nyílások", 35, "m²"), field("waste", "Tartalék", 7, "%", true)],
      calculate(v) { const area = Math.max(0, v.perimeter * v.height - v.openings); const ordered = area * (1 + v.waste / 100); return { title: `${round(area)} m² homlokzati hőszigetelés`, lines: [line("homlokzat-eps", area)], materials: [material("15 cm EPS", ordered, "m²"), material("Ragasztó és ágyazó", area * 9, "kg"), material("Üvegszövet háló", area * 1.1, "m²"), material("Dübel", Math.ceil(area * 6), "db")] }; }
    },
    laminate: {
      category: "Burkolás", name: "Laminált padló", icon: "🪵", help: "Padlófelületből számolja a rendelési felületet, alátétet és szegélyt.",
      fields: [field("area", "Padlófelület", 36, "m²"), field("perimeter", "Szegélyhossz", 26, "fm"), field("waste", "Vágási veszteség", 8, "%", true)],
      calculate(v) { return { title: `${round(v.area)} m² laminált padló`, lines: [line("laminalt-padlo", v.area, null, null, null, { matFactor: 1 + v.waste / 100 }), line("laminalt-szegely", v.perimeter)], materials: [material("Laminált padló", v.area * (1 + v.waste / 100), "m²"), material("Alátét", v.area * 1.05, "m²"), material("Szegélyléc", v.perimeter * 1.05, "fm")] }; }
    },
    plaster: {
      category: "Felületképzés", name: "Vakolás", icon: "🪣", help: "Felületből, vastagságból és fajlagos anyagigényből számol.",
      fields: [field("area", "Vakolandó felület", 80, "m²"), field("thickness", "Átlagos vastagság", 10, "mm"), field("consumption", "Anyagigény", 1.4, "kg/m²/mm", true)],
      calculate(v) { const kg = v.area * v.thickness * v.consumption; return { title: `${round(v.area)} m² gépi vakolás`, lines: [line("vakolas-gepi", v.area)], materials: [material("Vakolóanyag", kg, "kg"), material("25 kg-os zsák", Math.ceil(kg / 25), "zsák")] }; }
    },
    roof: {
      category: "Tető", name: "Tetőfedés", icon: "🏠", help: "Tetőfelülethez lécezést, fóliát, fedést és igény szerint ereszt számol.",
      fields: [field("area", "Tetőfelület", 120, "m²"), field("gutter", "Ereszcsatorna", 35, "fm"), field("waste", "Cserép tartalék", 8, "%", true)],
      calculate(v) { return { title: `${round(v.area)} m² tetőfedés`, lines: [line("acs-folia-lec", v.area), line("acs-cserep", v.area), ...(v.gutter > 0 ? [line("acs-eresz", v.gutter)] : [])], materials: [material("Alátétfólia átfedéssel", v.area * 1.15, "m²"), material("Tetőcserép rendelési felület", v.area * (1 + v.waste / 100), "m²"), material("Ereszcsatorna", v.gutter * 1.05, "fm")] }; }
    },
    screed: {
      category: "Beton", name: "Estrich aljzat", icon: "📐", help: "Felület és vastagság alapján számolja az estrich térfogatát és a kivitelezési tételt.",
      fields: [field("area", "Aljzat felülete", 60, "m²"), field("thickness", "Estrich vastagsága", 6, "cm"), field("waste", "Tartalék", 5, "%", true)],
      calculate(v) { return { title: `${round(v.area)} m² estrich aljzat`, lines: [line("aljzat-estrich", v.area, null, `${round(v.thickness)} cm estrich aljzat`, null, { matFactor: Math.max(0.5, v.thickness / 6), labFactor: Math.max(0.8, 0.85 + v.thickness / 40) })], materials: [material("Estrich habarcs", v.area * v.thickness / 100 * (1 + v.waste / 100), "m³"), material("Peremszigetelő szalag, becsült", Math.sqrt(v.area) * 4 * 1.1, "fm")] }; }
    },
    utilities: {
      category: "Gépészet", name: "Víz- és villanykiállások", icon: "⚡", help: "Darabszám alapján adja az alapkiállásokat az ajánlathoz.",
      fields: [field("electric", "Villanykiállások", 20, "db"), field("water", "Vízkiállások", 6, "db")],
      calculate(v) { return { title: "Gépészeti alapszerelés", lines: [...(v.electric > 0 ? [line("villany-kiallas", v.electric)] : []), ...(v.water > 0 ? [line("viz-kiallas", v.water)] : [])], materials: [material("Villanykiállás", v.electric, "db"), material("Vízkiállás", v.water, "db")], warning: "A vezetékhossz, elosztó, szerelvények és gépészeti berendezések helyszíni felmérés után pontosíthatók." }; }
    }
  };

  function calculateTemplate(id, values) {
    const template = TEMPLATES[id];
    if (!template) throw new Error("Ismeretlen munkatípus.");
    const normalized = {};
    template.fields.forEach(item => normalized[item.id] = positive(values?.[item.id] ?? item.value));
    return template.calculate(normalized);
  }

  function fallbackItem(spec, fallback) {
    if (!fallback) return null;
    return {
      price_id: spec.priceId,
      name: spec.label || fallback.name,
      type: "anyag",
      qty: spec.qty,
      unit: spec.unit || fallback.unit,
      mat_unit_price: fallback.mat,
      lab_unit_price: fallback.lab,
      hours: 0,
      selected: false,
      source: "SzakiPiac 360 beépített referencia",
      updated_at: "2026-07-18",
      scope: "A végleges egységár a tételsorban módosítható.",
      norm_ora_atlag: fallback.norm,
      norms: { min: fallback.norm * 0.82, atlag: fallback.norm, max: fallback.norm * 1.35 },
      ranges: {
        mat: { min: fallback.mat * 0.82, atlag: fallback.mat, max: fallback.mat * 1.25 },
        lab: { min: fallback.lab * 0.8, atlag: fallback.lab, max: fallback.lab * 1.35 }
      }
    };
  }

  function mount() {
    const byId = id => document.getElementById(id);
    const step = byId("step1");
    if (!step || byId("guidedQuoteBuilder")) return;
    let lastResult = null;

    const intro = step.firstElementChild;
    const oldGrid = step.querySelector("[data-pkg]")?.parentElement;
    const oldGlobal = byId("btnApplyGlobal")?.closest(".mt-6");
    const manual = document.createElement("details");
    manual.className = "mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4";
    manual.innerHTML = `<summary class="cursor-pointer font-extrabold text-slate-900">Kézi tételfelvétel és gyors szakági csomagok <span class="ml-2 text-xs font-normal text-slate-500">haladó használathoz</span></summary>`;
    if (oldGrid) manual.appendChild(oldGrid);
    if (oldGlobal) manual.appendChild(oldGlobal);
    step.appendChild(manual);

    const builder = document.createElement("section");
    builder.id = "guidedQuoteBuilder";
    builder.className = "mt-5 rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 sm:p-5";
    builder.innerHTML = `
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><div class="text-sm font-black text-indigo-700">AJÁNLOTT</div><h3 class="text-xl font-black text-slate-950">Mit szeretnél beárazni?</h3><p class="mt-1 text-sm text-slate-600">Válassz munkát, add meg a méreteket, és a rendszer elkészíti a tételes ár- és anyagszámítást.</p></div>
        <div class="inline-flex rounded-xl border bg-white p-1" aria-label="Számítás részletessége"><button type="button" data-mode="simple" class="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-black text-white">Egyszerű</button><button type="button" data-mode="advanced" class="rounded-lg px-3 py-2 text-sm font-black text-slate-600">Haladó</button></div>
      </div>
      <div class="mt-4 grid gap-3 sm:grid-cols-2"><label class="text-sm font-bold text-slate-800">Szakág<select id="guidedCategory" class="mt-1 w-full rounded-xl border bg-white p-3"></select></label><label class="text-sm font-bold text-slate-800">Munka típusa<select id="guidedTemplate" class="mt-1 w-full rounded-xl border bg-white p-3"></select></label></div>
      <div id="guidedHelp" class="mt-3 rounded-xl bg-white p-3 text-sm text-slate-700"></div>
      <div id="guidedFields" class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"></div>
      <div id="guidedPreview" class="mt-4 hidden rounded-xl border border-emerald-200 bg-emerald-50 p-4"></div>
      <button id="guidedCalculate" type="button" class="mt-4 w-full rounded-xl bg-indigo-700 px-4 py-3 font-black text-white hover:bg-indigo-800">Kiszámítás és hozzáadás az ajánlathoz →</button>`;
    step.insertBefore(builder, manual);
    intro.querySelector("h2").innerHTML = `<i class="fa-solid fa-wand-magic-sparkles text-indigo-600 mr-2"></i>Vezetett árajánlat-készítés`;
    intro.querySelector("p").textContent = "Először válassz konkrét munkát. A kézi szakági csomagok lejjebb, külön lenyitható részen maradtak meg.";

    const category = byId("guidedCategory");
    const selector = byId("guidedTemplate");
    const categories = [...new Set(Object.values(TEMPLATES).map(item => item.category))];
    category.innerHTML = categories.map(name => `<option>${name}</option>`).join("");
    let mode = "simple";

    function templatesForCategory() { return Object.entries(TEMPLATES).filter(([, item]) => item.category === category.value); }
    function renderTemplateOptions() { selector.innerHTML = templatesForCategory().map(([id, item]) => `<option value="${id}">${item.icon} ${item.name}</option>`).join(""); renderFields(); }
    function renderFields() {
      const template = TEMPLATES[selector.value];
      if (!template) return;
      byId("guidedHelp").innerHTML = `<b>${template.icon} ${template.name}</b><div class="mt-1 text-xs text-slate-600">${template.help}</div>`;
      byId("guidedFields").innerHTML = template.fields.filter(item => mode === "advanced" || !item.advanced).map(item => {
        const control = item.options
          ? `<select data-guided-field="${item.id}" class="mt-1 w-full rounded-xl border bg-white p-3 font-bold">${item.options.map(([value, label]) => `<option value="${value}" ${Number(value) === Number(item.value) ? "selected" : ""}>${label}</option>`).join("")}</select>`
          : `<div class="relative mt-1"><input data-guided-field="${item.id}" type="number" min="0" step="0.01" value="${item.value}" class="w-full rounded-xl border bg-white p-3 pr-20 font-bold"><span class="pointer-events-none absolute right-3 top-3 text-sm text-slate-500">${item.unit}</span></div>`;
        return `<label class="text-sm font-bold text-slate-800 ${item.advanced ? "rounded-xl border border-dashed border-indigo-200 bg-indigo-50 p-3" : ""}">${item.label}${control}</label>`;
      }).join("");
      byId("guidedPreview").classList.add("hidden");
    }

    category.addEventListener("change", renderTemplateOptions);
    selector.addEventListener("change", renderFields);
    builder.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => {
      mode = button.dataset.mode;
      builder.querySelectorAll("[data-mode]").forEach(item => item.className = `rounded-lg px-3 py-2 text-sm font-black ${item === button ? "bg-indigo-700 text-white" : "text-slate-600"}`);
      renderFields();
    }));

    byId("guidedCalculate").addEventListener("click", () => {
      const template = TEMPLATES[selector.value];
      const values = {};
      template.fields.forEach(item => {
        const visible = builder.querySelector(`[data-guided-field="${item.id}"]`);
        values[item.id] = visible ? positive(visible.value) : positive(item.value);
      });
      const result = calculateTemplate(selector.value, values);
      if (!result.lines.length || result.lines.every(item => item.qty <= 0)) return window.toast?.("Adj meg nullánál nagyobb méretet.", "error");
      const batchId = `guided-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      items = items.filter(item => String(item.name || "").trim() || positive(item.mat_unit_price) || positive(item.lab_unit_price));
      result.lines.filter(item => item.qty > 0).forEach(spec => {
        const catalogItem = window.SzakiPiacPriceCatalog?.get(spec.priceId);
        const item = catalogItem || fallbackItem(spec, spec.fallback || REFERENCE_FALLBACKS[spec.priceId]);
        if (!item) return;
        item.qty = spec.qty;
        if (spec.label) item.name = spec.label;
        if (spec.unit) item.unit = spec.unit;
        const matFactor = positive(spec.matFactor) || 1;
        const labFactor = positive(spec.labFactor) || 1;
        item.mat_unit_price = round(item.mat_unit_price * matFactor);
        item.lab_unit_price = round(item.lab_unit_price * labFactor);
        if (item.ranges) {
          Object.keys(item.ranges.mat || {}).forEach(key => item.ranges.mat[key] = round(item.ranges.mat[key] * matFactor));
          Object.keys(item.ranges.lab || {}).forEach(key => item.ranges.lab[key] = round(item.ranges.lab[key] * labFactor));
        }
        if (item.norms) Object.keys(item.norms).forEach(key => item.norms[key] = round(item.norms[key] * labFactor, 3));
        if (item.norm_ora_atlag) item.norm_ora_atlag = round(item.norm_ora_atlag * labFactor, 3);
        item.guided_template = selector.value;
        item.guided_batch = batchId;
        items.push(item);
      });
      lastResult = { id: batchId, template: selector.value, values, ...result };
      window.__guidedQuoteCalculations = [...(window.__guidedQuoteCalculations || []), lastResult];
      if (!byId("project_name").value.trim()) byId("project_name").value = result.title;
      renderItems();
      calcAndRender();
      const preview = byId("guidedPreview");
      preview.classList.remove("hidden");
      preview.innerHTML = `<div class="font-black text-emerald-950">✓ ${result.title}</div><div class="mt-2 grid gap-1 text-sm text-emerald-900 sm:grid-cols-2">${result.materials.map(item => `<div><b>${item.name}:</b> ${item.qty.toLocaleString("hu-HU")} ${item.unit}</div>`).join("")}</div>${result.warning ? `<div class="mt-3 rounded-lg bg-amber-100 p-2 text-xs font-bold text-amber-950">${result.warning}</div>` : ""}<button type="button" id="guidedGoToItems" class="mt-3 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-black text-white">Tételek és árak ellenőrzése →</button>`;
      byId("guidedGoToItems").onclick = () => window.goToQuoteStep?.("step2");
      window.toast?.("A számítás bekerült az ajánlatba. Ellenőrizd az egységárakat és a mennyiségeket ✅");
    });

    const materialBox = document.createElement("section");
    materialBox.id = "quoteMaterialSummary";
    materialBox.className = "mt-5 hidden rounded-2xl border border-cyan-200 bg-cyan-50 p-4";
    byId("step2").appendChild(materialBox);

    const projectGrid = byId("project_name").closest(".grid");
    const meta = document.createElement("details");
    meta.id = "professionalQuoteData";
    meta.open = true;
    meta.className = "mb-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 no-print";
    meta.innerHTML = `<summary class="cursor-pointer font-black text-indigo-950">Ajánlat azonosítása és feltételei</summary><div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label class="text-xs font-bold">Ajánlatszám<input id="quote_number" class="mt-1 w-full rounded-lg border p-2 font-bold"></label>
      <label class="text-xs font-bold">Állapot<select id="quote_status" class="mt-1 w-full rounded-lg border p-2"><option value="draft">Piszkozat</option><option value="sent">Elküldve</option><option value="accepted">Elfogadva</option><option value="rejected">Elutasítva</option></select></label>
      <label class="text-xs font-bold">Érvényesség<input id="quote_valid_days" type="number" min="1" value="30" class="mt-1 w-full rounded-lg border p-2"><span class="text-[11px] text-slate-500">nap</span></label>
      <label class="text-xs font-bold">Előleg<input id="quote_deposit" type="number" min="0" max="100" value="0" class="mt-1 w-full rounded-lg border p-2"><span class="text-[11px] text-slate-500">%</span></label>
      <label class="text-xs font-bold sm:col-span-2">Fizetési feltétel<input id="quote_payment_terms" value="Átutalás, a felek megállapodása szerint" class="mt-1 w-full rounded-lg border p-2"></label>
      <label class="text-xs font-bold">Vállalkozó / cégnév<input id="contractor_name" class="mt-1 w-full rounded-lg border p-2"></label>
      <label class="text-xs font-bold">Adószám<input id="contractor_tax" class="mt-1 w-full rounded-lg border p-2"></label>
      <label class="text-xs font-bold">Vállalkozó címe<input id="contractor_address" class="mt-1 w-full rounded-lg border p-2"></label>
    </div></details>`;
    byId("step3").insertBefore(meta, projectGrid);

    const duplicate = document.createElement("button");
    duplicate.id = "btnDuplicateQuote";
    duplicate.className = "px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-800 font-bold hover:bg-indigo-100 no-print";
    duplicate.textContent = "Másolat készítése";
    byId("btnReset").parentElement.insertBefore(duplicate, byId("btnReset"));

    function newNumber() {
      const now = new Date();
      const date = now.toISOString().slice(0, 10).replaceAll("-", "");
      return `SZP-${date}-${String(now.getTime()).slice(-4)}`;
    }
    byId("quote_number").value = newNumber();
    duplicate.addEventListener("click", () => {
      currentQuoteId = null;
      byId("quote_number").value = newNumber();
      byId("quote_status").value = "draft";
      calcAndRender();
      window.toast?.("Új ajánlatmásolat készült. Mentéskor külön ajánlatként jön létre ✅");
    });

    const printHeader = byId("print_date").parentElement.parentElement;
    printHeader.insertAdjacentHTML("beforeend", `<div><span class="font-semibold">Ajánlatszám:</span> <span id="print_quote_number">—</span></div><div><span class="font-semibold">Érvényes:</span> <span id="print_quote_validity">—</span></div>`);
    const printBrand = byId("print_project").closest(".flex").firstElementChild;
    printBrand.insertAdjacentHTML("beforeend", `<div id="print_contractor" class="mt-3 text-sm text-gray-700"></div>`);
    const printMaterial = document.createElement("div");
    printMaterial.id = "printMaterialSummary";
    printMaterial.className = "mt-5 hidden rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm";
    byId("printArea").appendChild(printMaterial);
    const printTerms = document.createElement("div");
    printTerms.id = "printQuoteTerms";
    printTerms.className = "mt-5 rounded-xl border border-slate-200 p-4 text-sm";
    byId("printArea").appendChild(printTerms);
    const profitPrintRow = byId("p_sum_profit")?.parentElement;
    if (profitPrintRow) profitPrintRow.classList.add("hidden");

    const oldPayload = window.payloadNow;
    window.payloadNow = function () {
      const payload = oldPayload();
      payload.quote_meta = {
        number: byId("quote_number").value, status: byId("quote_status").value,
        valid_days: positive(byId("quote_valid_days").value), deposit_percent: positive(byId("quote_deposit").value),
        payment_terms: byId("quote_payment_terms").value,
        contractor: { name: byId("contractor_name").value, tax_number: byId("contractor_tax").value, address: byId("contractor_address").value }
      };
      payload.guided_calculations = window.__guidedQuoteCalculations || [];
      return payload;
    };
    const oldApply = window.applyPayload;
    window.applyPayload = function (payload) {
      oldApply(payload);
      const quote = payload?.quote_meta || {};
      byId("quote_number").value = quote.number || newNumber();
      byId("quote_status").value = quote.status || "draft";
      byId("quote_valid_days").value = quote.valid_days || 30;
      byId("quote_deposit").value = quote.deposit_percent || 0;
      byId("quote_payment_terms").value = quote.payment_terms || "Átutalás, a felek megállapodása szerint";
      byId("contractor_name").value = quote.contractor?.name || "";
      byId("contractor_tax").value = quote.contractor?.tax_number || "";
      byId("contractor_address").value = quote.contractor?.address || "";
      window.__guidedQuoteCalculations = Array.isArray(payload?.guided_calculations)
        ? payload.guided_calculations
        : (payload?.guided_calculation ? [payload.guided_calculation] : []);
      renderProfessional();
    };

    function renderProfessional() {
      const calculations = window.__guidedQuoteCalculations || [];
      materialBox.classList.toggle("hidden", !calculations.length);
      materialBox.innerHTML = calculations.length ? `<div><h3 class="font-black text-cyan-950">Automatikus anyagkimutatás</h3><p class="text-xs text-cyan-800">Munkánként külön látható. Rendelés előtt ellenőrizd a gyártói kiadósságot, csomagméretet és műszaki tervet.</p></div><div class="mt-3 space-y-3">${calculations.map(result => `<div class="rounded-xl bg-white p-3"><div class="flex items-start justify-between gap-3"><div class="font-black text-cyan-950">${result.title || "Számított munka"}</div><button type="button" data-remove-guided="${result.id || ""}" class="no-print text-xs font-black text-red-600">Számítás törlése</button></div><div class="mt-2 grid gap-1 text-sm sm:grid-cols-2">${(result.materials || []).map(item => `<div><b>${item.name}:</b> ${item.qty.toLocaleString("hu-HU")} ${item.unit}${item.note ? `<div class="text-xs text-amber-700">${item.note}</div>` : ""}</div>`).join("")}</div>${result.warning ? `<div class="mt-2 rounded-lg bg-amber-100 p-2 text-xs font-bold text-amber-950">${result.warning}</div>` : ""}</div>`).join("")}</div>` : "";
      materialBox.querySelectorAll("[data-remove-guided]").forEach(button => button.addEventListener("click", () => {
        const id = button.dataset.removeGuided;
        window.__guidedQuoteCalculations = calculations.filter(result => String(result.id || "") !== id);
        items = items.filter(item => String(item.guided_batch || "") !== id);
        renderItems();
        calcAndRender();
      }));
      byId("print_quote_number").textContent = byId("quote_number").value || "—";
      const days = positive(byId("quote_valid_days").value) || 30;
      const valid = new Date(); valid.setDate(valid.getDate() + days);
      byId("print_quote_validity").textContent = `${valid.toLocaleDateString("hu-HU")} (${days} nap)`;
      printMaterial.classList.toggle("hidden", !calculations.length);
      printMaterial.innerHTML = calculations.length ? `<div class="font-bold mb-2">Tájékoztató anyagkimutatás</div>${calculations.map(result => `<div class="mb-3"><b>${result.title}</b><div class="mt-1 grid grid-cols-2 gap-x-6 gap-y-1">${(result.materials || []).map(item => `<div class="flex justify-between gap-3"><span>${item.name}</span><b>${item.qty.toLocaleString("hu-HU")} ${item.unit}</b></div>`).join("")}</div>${result.warning ? `<p class="mt-1 text-xs text-amber-800">${result.warning}</p>` : ""}</div>`).join("")}` : "";
      const escape = value => String(value || "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
      byId("print_contractor").innerHTML = [byId("contractor_name").value, byId("contractor_tax").value ? `Adószám: ${byId("contractor_tax").value}` : "", byId("contractor_address").value].filter(Boolean).map(value => `<div>${escape(value)}</div>`).join("");
      printTerms.innerHTML = `<div class="font-bold mb-2">Ajánlati és fizetési feltételek</div><div><b>Fizetés:</b> ${escape(byId("quote_payment_terms").value || "—")}</div><div><b>Előleg:</b> ${positive(byId("quote_deposit").value)}%</div><div><b>Érvényesség:</b> ${days} nap</div>`;
    }
    const oldCalc = window.calcAndRender;
    window.calcAndRender = function () { oldCalc(); renderProfessional(); };
    meta.querySelectorAll("input,select").forEach(element => { element.addEventListener("input", renderProfessional); element.addEventListener("change", renderProfessional); });

    renderTemplateOptions();
    renderProfessional();
  }

  return { templates: TEMPLATES, calculateTemplate, mount };
});

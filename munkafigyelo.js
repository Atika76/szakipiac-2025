const VAPID_PUBLIC_KEY = "BI9GtCoUOzjMo4ILFJ84E2Ud1nWzt58dd8g3efiESKRXb71BRD2okYXt0lqCR4-VE5-Y2R89aQ2_eKQdLs9b_Qk";

const SZAKMAK = [
  "Ács", "Asztalos", "Bádogos", "Burkoló", "Épületgépész", "Festő-mázoló",
  "Gipszkartonos", "Kertépítő", "Klímaszerelő", "Kőműves", "Lakatos",
  "Napelem-szerelő", "Szigetelő", "Takarító", "Tetőfedő", "Térkövező",
  "Víz- és gázszerelő", "Villanyszerelő", "Generálkivitelező", "Egyéb szakember"
];

const MEGYEK = [
  "Budapest", "Bács-Kiskun", "Baranya", "Békés", "Borsod-Abaúj-Zemplén",
  "Csongrád-Csanád", "Fejér", "Győr-Moson-Sopron", "Hajdú-Bihar", "Heves",
  "Jász-Nagykun-Szolnok", "Komárom-Esztergom", "Nógrád", "Pest", "Somogy",
  "Szabolcs-Szatmár-Bereg", "Tolna", "Vas", "Veszprém", "Zala", "Országos"
];

const SURGOSSEG = {
  normal: { label: "Rugalmas", badge: "bg-slate-100 text-slate-700" },
  hamarosan: { label: "Hamarosan", badge: "bg-amber-100 text-amber-800" },
  surgos: { label: "Sürgős", badge: "bg-rose-100 text-rose-700" }
};

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

function formatDate(value, withTime = false) {
  if (!value) return "—";
  const options = withTime
    ? { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }
    : { year: "numeric", month: "2-digit", day: "2-digit" };
  return new Date(value).toLocaleString("hu-HU", options);
}

function formatMoney(value) {
  return value == null || value === "" ? "" : `${Number(value).toLocaleString("hu-HU")} Ft`;
}

function budgetText(job) {
  if (job.koltseg_min != null && job.koltseg_max != null) return `${formatMoney(job.koltseg_min)} – ${formatMoney(job.koltseg_max)}`;
  if (job.koltseg_min != null) return `${formatMoney(job.koltseg_min)}-tól`;
  if (job.koltseg_max != null) return `Legfeljebb ${formatMoney(job.koltseg_max)}`;
  return "Megegyezés szerint";
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

export function createMunkafigyelo({ client, showToast, trackEvent, adminEmail }) {
  let root = null;
  let publicJobs = [];
  let currentTab = "jobs";
  let session = null;

  async function refreshSession() {
    const result = await client.auth.getSession();
    session = result.data.session;
    return session;
  }

  function optionList(items, placeholder) {
    return `<option value="">${esc(placeholder)}</option>${items.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join("")}`;
  }

  function tabButton(id, icon, label) {
    return `<button type="button" data-mf-tab="${id}" class="mf-tab px-4 py-3 rounded-xl font-extrabold text-sm whitespace-nowrap transition">${icon} ${label}</button>`;
  }

  async function showPage() {
    root = document.getElementById("munkafigyelo-page");
    if (!root) return;
    await refreshSession();
    root.innerHTML = `
      <section class="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700 text-white shadow-xl mb-6">
        <div class="p-6 md:p-10 relative">
          <div class="absolute -right-10 -top-16 w-64 h-64 rounded-full bg-white/10"></div>
          <div class="relative max-w-3xl">
            <div class="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold mb-4">🔔 INGYENES MUNKAÉRTESÍTŐ</div>
            <h1 class="text-3xl md:text-5xl font-black tracking-tight">Munkafigyelő</h1>
            <p class="mt-3 text-emerald-50 text-base md:text-lg">Valódi megrendelői munkák szakembereknek. Keress a közeledben, kérj értesítést, és vedd fel a kapcsolatot anélkül, hogy bárki e-mail-címe nyilvánossá válna.</p>
            <div class="mt-6 flex flex-wrap gap-3">
              <button type="button" data-mf-tab-jump="form" class="bg-amber-400 text-emerald-950 px-5 py-3 rounded-xl font-black hover:bg-amber-300">+ Munkát adok fel</button>
              <button type="button" data-mf-tab-jump="push" class="bg-white/10 border border-white/30 px-5 py-3 rounded-xl font-bold hover:bg-white/20">🔔 Értesítést kérek</button>
            </div>
          </div>
        </div>
      </section>

      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 mb-6 overflow-x-auto">
        <div class="flex gap-2 min-w-max">
          ${tabButton("jobs", "🔎", "Munkák")}
          ${tabButton("form", "➕", "Munka feladása")}
          ${tabButton("mine", "📋", "Saját hirdetéseim")}
          ${tabButton("push", "🔔", "Értesítéseim")}
        </div>
      </div>
      <div id="mf-panel" aria-live="polite"></div>
      <details class="mt-6 bg-white border border-slate-200 rounded-2xl p-4 text-sm text-slate-600">
        <summary class="font-black text-slate-800 cursor-pointer">Adatvédelem és biztonság</summary>
        <div class="mt-3 space-y-2 leading-relaxed">
          <p>A hirdető e-mail-címe, telefonszáma és felhasználói azonosítója nem jelenik meg a nyilvános munkalistában. A kapcsolatfelvétel a SzakiPiac belső üzenetrendszerében történik.</p>
          <p>A munkahirdetés alapértelmezetten 30 napig aktív, de a feladó korábban lezárhatja vagy törölheti. A push feliratkozás bármikor kikapcsolható.</p>
          <p>Adatvédelmi vagy törlési kérés: <a href="mailto:atika.76@windowslive.com" class="font-bold text-emerald-700 hover:underline">atika.76@windowslive.com</a></p>
        </div>
      </details>
      <div id="mf-modal" class="hidden fixed inset-0 z-[150] bg-slate-950/60 p-4 overflow-y-auto"></div>
    `;
    bindShell();
    await switchTab(currentTab);
    trackEvent?.("munkafigyelo_open", { logged_in: !!session });
  }

  function bindShell() {
    root.querySelectorAll("[data-mf-tab], [data-mf-tab-jump]").forEach(button => {
      button.addEventListener("click", () => switchTab(button.dataset.mfTab || button.dataset.mfTabJump));
    });
  }

  async function switchTab(tab) {
    currentTab = tab;
    root.querySelectorAll(".mf-tab").forEach(button => {
      const active = button.dataset.mfTab === tab;
      button.className = `mf-tab px-4 py-3 rounded-xl font-extrabold text-sm whitespace-nowrap transition ${active ? "bg-emerald-700 text-white shadow" : "text-slate-600 hover:bg-slate-100"}`;
    });
    const panel = root.querySelector("#mf-panel");
    panel.innerHTML = `<div class="py-16 text-center"><div class="loader"></div><p class="text-sm text-slate-500">Betöltés…</p></div>`;
    if (tab === "jobs") await renderJobsPanel(panel);
    if (tab === "form") await renderFormPanel(panel);
    if (tab === "mine") await renderMinePanel(panel);
    if (tab === "push") await renderPushPanel(panel);
  }

  async function loadPublicJobs() {
    const { data, error } = await client.from("munkafigyelo_nyilvanos").select("*").order("created_at", { ascending: false }).limit(250);
    if (error) throw error;
    publicJobs = data || [];
  }

  async function renderJobsPanel(panel) {
    try {
      await loadPublicJobs();
      panel.innerHTML = `
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label class="md:col-span-2"><span class="text-xs font-bold text-slate-600">Keresés</span><input id="mf-search" type="search" placeholder="Pl. fürdőszoba, tető, kerítés…" class="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"></label>
            <label><span class="text-xs font-bold text-slate-600">Szakma</span><select id="mf-trade" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3">${optionList(SZAKMAK, "Minden szakma")}</select></label>
            <label><span class="text-xs font-bold text-slate-600">Megye</span><select id="mf-county" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3">${optionList(MEGYEK, "Minden megye")}</select></label>
          </div>
          <div class="mt-3 flex flex-wrap gap-2 items-center">
            <button data-urgency="" class="mf-urgency rounded-full px-3 py-1.5 text-xs font-bold bg-emerald-700 text-white">Mind</button>
            <button data-urgency="surgos" class="mf-urgency rounded-full px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700">Sürgős</button>
            <button data-urgency="hamarosan" class="mf-urgency rounded-full px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700">Hamarosan</button>
            <span id="mf-result-count" class="ml-auto text-sm font-bold text-slate-500"></span>
          </div>
        </div>
        <div id="mf-job-list" class="space-y-4"></div>
      `;
      let urgency = "";
      const apply = () => {
        const q = panel.querySelector("#mf-search").value.trim().toLocaleLowerCase("hu-HU");
        const trade = panel.querySelector("#mf-trade").value;
        const county = panel.querySelector("#mf-county").value;
        const filtered = publicJobs.filter(job => {
          const text = `${job.cim} ${job.leiras} ${job.telepules} ${job.szakma}`.toLocaleLowerCase("hu-HU");
          return (!q || text.includes(q)) && (!trade || job.szakma === trade) && (!county || job.megye === county) && (!urgency || job.surgosseg === urgency);
        });
        panel.querySelector("#mf-result-count").textContent = `${filtered.length} munka`;
        renderJobCards(panel.querySelector("#mf-job-list"), filtered);
      };
      panel.querySelectorAll("input,select").forEach(el => el.addEventListener("input", apply));
      panel.querySelectorAll(".mf-urgency").forEach(button => button.addEventListener("click", () => {
        urgency = button.dataset.urgency;
        panel.querySelectorAll(".mf-urgency").forEach(x => x.className = `mf-urgency rounded-full px-3 py-1.5 text-xs font-bold ${x === button ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-700"}`);
        apply();
      }));
      apply();
    } catch (error) {
      panel.innerHTML = errorBox(error, "A Munkafigyelő adatbázisa még nem érhető el.");
    }
  }

  function renderJobCards(target, jobs) {
    if (!jobs.length) {
      target.innerHTML = `<div class="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center"><div class="text-4xl">🔎</div><h3 class="mt-3 font-black text-lg">Nincs találat ezekkel a szűrőkkel</h3><p class="text-slate-500 text-sm mt-1">Próbálj másik szakmát vagy megyét.</p></div>`;
      return;
    }
    target.innerHTML = jobs.map(job => {
      const urgency = SURGOSSEG[job.surgosseg] || SURGOSSEG.normal;
      const sourceUrl = safeUrl(job.forras_url);
      return `
        <article class="sp-card bg-white rounded-2xl border border-slate-200 shadow-sm p-5" data-job-id="${esc(job.id)}">
          <div class="flex flex-col sm:flex-row gap-4 justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap gap-2 mb-2">
                <span class="rounded-full px-2.5 py-1 text-xs font-extrabold bg-emerald-100 text-emerald-800">${esc(job.szakma)}</span>
                <span class="rounded-full px-2.5 py-1 text-xs font-bold ${urgency.badge}">${esc(urgency.label)}</span>
                ${job.forras_tipus !== "megrendelo" ? `<span class="rounded-full px-2.5 py-1 text-xs font-bold bg-blue-100 text-blue-700">Nyilvános forrás</span>` : ""}
              </div>
              <h2 class="text-xl font-black text-slate-900 leading-tight">${esc(job.cim)}</h2>
              <div class="mt-2 text-sm text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                <span>📍 ${esc(job.telepules)}, ${esc(job.megye)}</span>
                <span>💰 ${esc(budgetText(job))}</span>
                ${job.kezdes_datum ? `<span>📅 Kezdés: ${esc(formatDate(job.kezdes_datum))}</span>` : ""}
              </div>
            </div>
            <div class="text-xs text-slate-500 shrink-0 sm:text-right">Feladva<br><b>${esc(formatDate(job.created_at, true))}</b></div>
          </div>
          <p class="mt-4 text-slate-700 whitespace-pre-line leading-relaxed">${esc(job.leiras)}</p>
          <div class="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
            ${job.kapcsolat_elerheto ? `<button type="button" data-contact="${esc(job.id)}" class="bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-extrabold hover:bg-emerald-800">Kapcsolatfelvétel</button>` : ""}
            ${sourceUrl ? `<a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer" class="bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2.5 rounded-xl font-bold hover:bg-blue-100">Eredeti hirdetés ↗</a>` : ""}
            <button type="button" data-report="${esc(job.id)}" class="ml-auto text-xs font-bold text-slate-500 hover:text-rose-600 px-2 py-2">⚑ Visszaélés jelentése</button>
          </div>
        </article>`;
    }).join("");
    target.querySelectorAll("[data-contact]").forEach(button => button.addEventListener("click", () => openContact(button.dataset.contact)));
    target.querySelectorAll("[data-report]").forEach(button => button.addEventListener("click", () => openReport(button.dataset.report)));
  }

  async function requireLogin(message) {
    await refreshSession();
    if (session) return true;
    showToast(message || "Ehhez előbb be kell jelentkezni.", "info");
    location.hash = "#auth";
    return false;
  }

  function showModal(html) {
    const modal = root.querySelector("#mf-modal");
    modal.innerHTML = `<div class="max-w-xl mx-auto my-8 bg-white rounded-2xl shadow-2xl p-6 relative"><button type="button" data-modal-close class="absolute right-4 top-3 text-2xl text-slate-400 hover:text-slate-800" aria-label="Bezárás">×</button>${html}</div>`;
    modal.classList.remove("hidden");
    modal.querySelector("[data-modal-close]").addEventListener("click", closeModal);
    modal.addEventListener("click", event => { if (event.target === modal) closeModal(); }, { once: true });
  }

  function closeModal() {
    const modal = root?.querySelector("#mf-modal");
    if (modal) { modal.classList.add("hidden"); modal.innerHTML = ""; }
  }

  async function openContact(id) {
    if (!await requireLogin("A biztonságos kapcsolatfelvételhez jelentkezz be.")) return;
    showModal(`<h2 class="text-xl font-black">Kapcsolatfelvétel a megrendelővel</h2><p class="mt-2 text-sm text-slate-600">Az üzenet a SzakiPiac belső rendszerében érkezik meg. A megrendelő e-mail-címe nem válik láthatóvá.</p><form id="mf-contact-form" class="mt-5"><label class="text-sm font-bold">Üzeneted<textarea required minlength="10" maxlength="2000" rows="6" class="mt-1 w-full rounded-xl border border-slate-300 p-3" placeholder="Írd le röviden, miben tudsz segíteni, és mikor tudnál kezdeni."></textarea></label><button class="mt-4 w-full bg-emerald-700 text-white rounded-xl py-3 font-black">Üzenet elküldése</button></form>`);
    root.querySelector("#mf-contact-form").addEventListener("submit", async event => {
      event.preventDefault();
      const button = event.currentTarget.querySelector("button");
      button.disabled = true; button.textContent = "Küldés…";
      const message = event.currentTarget.querySelector("textarea").value.trim();
      const { error } = await client.rpc("munkafigyelo_kapcsolat_kuldese", { p_hirdetes_id: id, p_uzenet: message });
      if (error) { showToast(error.message, "error"); button.disabled = false; button.textContent = "Üzenet elküldése"; return; }
      closeModal();
      showToast("Az üzenet megérkezett a megrendelőhöz.");
      trackEvent?.("munkafigyelo_contact", { ad_id: id });
    });
  }

  async function openReport(id) {
    if (!await requireLogin("A visszaélés jelentéséhez jelentkezz be.")) return;
    showModal(`<h2 class="text-xl font-black">Visszaélés jelentése</h2><form id="mf-report-form" class="mt-5 space-y-4"><label class="block text-sm font-bold">Mi a probléma?<select name="ok" class="mt-1 w-full rounded-xl border border-slate-300 p-3"><option value="spam">Spam vagy reklám</option><option value="teves">Téves / félrevezető</option><option value="lejart">Már nem aktuális</option><option value="jogserto">Jog- vagy szabálysértő</option><option value="egyeb">Egyéb</option></select></label><label class="block text-sm font-bold">Megjegyzés (nem kötelező)<textarea name="megjegyzes" maxlength="1000" rows="4" class="mt-1 w-full rounded-xl border border-slate-300 p-3"></textarea></label><button class="w-full bg-rose-600 text-white rounded-xl py-3 font-black">Jelentés elküldése</button></form>`);
    root.querySelector("#mf-report-form").addEventListener("submit", async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const { error } = await client.from("munkafigyelo_jelentesek").insert({ hirdetes_id: id, reporter_id: session.user.id, ok: form.get("ok"), megjegyzes: form.get("megjegyzes") || null });
      if (error) return showToast(error.code === "23505" ? "Ezt a hirdetést már jelentetted." : error.message, "error");
      closeModal(); showToast("Köszönjük, az admin megvizsgálja a jelentést.");
    });
  }

  function formHtml(job = null) {
    const minDate = new Date().toISOString().slice(0, 10);
    return `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-7">
        <div class="flex items-start justify-between gap-4 mb-6"><div><h2 class="text-2xl font-black">${job ? "Munka módosítása" : "Új munka feladása"}</h2><p class="text-sm text-slate-600 mt-1">30 napig ingyenesen megjelenik. A kapcsolati adataid rejtve maradnak.</p></div><span class="bg-emerald-100 text-emerald-800 rounded-full px-3 py-1 text-xs font-black">INGYENES</span></div>
        <form id="mf-job-form" data-edit-id="${esc(job?.id || "")}" class="space-y-5">
          <label class="block text-sm font-bold">Milyen munkára keresel szakembert? *<input name="cim" required minlength="8" maxlength="120" value="${esc(job?.cim || "")}" class="mt-1 w-full rounded-xl border border-slate-300 p-3" placeholder="Pl. Fürdőszoba burkolásához keresek szakembert"></label>
          <label class="block text-sm font-bold">Részletes leírás *<textarea name="leiras" required minlength="30" maxlength="4000" rows="7" class="mt-1 w-full rounded-xl border border-slate-300 p-3" placeholder="Mekkora a munka, mi a jelenlegi állapot, milyen elképzelésed van?">${esc(job?.leiras || "")}</textarea><span class="block text-xs text-slate-500 mt-1">Ne írj ide telefonszámot vagy e-mail-címet.</span></label>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label class="text-sm font-bold">Szakma *<select name="szakma" required class="mt-1 w-full rounded-xl border border-slate-300 p-3">${optionList(SZAKMAK, "Válassz szakmát")}</select></label>
            <label class="text-sm font-bold">Megye *<select name="megye" required class="mt-1 w-full rounded-xl border border-slate-300 p-3">${optionList(MEGYEK, "Válassz megyét")}</select></label>
            <label class="text-sm font-bold">Település *<input name="telepules" required minlength="2" maxlength="100" value="${esc(job?.telepules || "")}" class="mt-1 w-full rounded-xl border border-slate-300 p-3"></label>
            <label class="text-sm font-bold">Irányítószám<input name="iranyitoszam" inputmode="numeric" maxlength="10" value="${esc(job?.iranyitoszam || "")}" class="mt-1 w-full rounded-xl border border-slate-300 p-3"></label>
            <label class="text-sm font-bold">Kezdés időpontja<input name="kezdes_datum" type="date" min="${minDate}" value="${esc(job?.kezdes_datum || "")}" class="mt-1 w-full rounded-xl border border-slate-300 p-3"></label>
            <label class="text-sm font-bold">Sürgősség<select name="surgosseg" class="mt-1 w-full rounded-xl border border-slate-300 p-3"><option value="normal">Rugalmas</option><option value="hamarosan">Hamarosan (1–2 héten belül)</option><option value="surgos">Sürgős</option></select></label>
            <label class="text-sm font-bold">Becsült keret minimum (Ft)<input name="koltseg_min" type="number" min="0" step="1000" value="${esc(job?.koltseg_min ?? "")}" class="mt-1 w-full rounded-xl border border-slate-300 p-3"></label>
            <label class="text-sm font-bold">Becsült keret maximum (Ft)<input name="koltseg_max" type="number" min="0" step="1000" value="${esc(job?.koltseg_max ?? "")}" class="mt-1 w-full rounded-xl border border-slate-300 p-3"></label>
          </div>
          <label class="flex items-start gap-3 rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm"><input name="terms" type="checkbox" required class="mt-1"><span>Megerősítem, hogy valós munkát adok fel, és a leírás nem tartalmaz nyilvános kapcsolati adatot.</span></label>
          <div class="flex flex-wrap gap-3"><button class="bg-emerald-700 text-white px-6 py-3 rounded-xl font-black hover:bg-emerald-800">${job ? "Módosítás mentése" : "Munka közzététele"}</button>${job ? `<button type="button" data-cancel-edit class="px-5 py-3 rounded-xl border border-slate-300 font-bold">Mégse</button>` : ""}</div>
        </form>
      </div>`;
  }

  async function renderFormPanel(panel, editJob = null) {
    if (!await requireLogin("Munka feladásához jelentkezz be vagy regisztrálj.")) return;
    panel.innerHTML = formHtml(editJob);
    const form = panel.querySelector("#mf-job-form");
    if (editJob) {
      form.elements.szakma.value = editJob.szakma;
      form.elements.megye.value = editJob.megye;
      form.elements.surgosseg.value = editJob.surgosseg;
      form.querySelector("[data-cancel-edit]")?.addEventListener("click", () => switchTab("mine"));
    }
    form.addEventListener("submit", saveJob);
  }

  async function saveJob(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const min = data.get("koltseg_min") ? Number(data.get("koltseg_min")) : null;
    const max = data.get("koltseg_max") ? Number(data.get("koltseg_max")) : null;
    if (min != null && max != null && max < min) return showToast("A maximális keret nem lehet kisebb a minimálisnál.", "error");
    const contactPattern = /(?:\+?36[\s-]?)?(?:\d[\s-]?){8,}|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i;
    if (contactPattern.test(String(data.get("leiras")))) return showToast("A leírásból töröld a telefonszámot vagy e-mail-címet. A kapcsolatfelvételt biztonságosan kezeljük.", "error");
    const payload = {
      owner_id: session.user.id,
      cim: String(data.get("cim")).trim(), leiras: String(data.get("leiras")).trim(),
      szakma: data.get("szakma"), megye: data.get("megye"), telepules: String(data.get("telepules")).trim(),
      iranyitoszam: String(data.get("iranyitoszam") || "").trim() || null,
      surgosseg: data.get("surgosseg"), koltseg_min: min, koltseg_max: max,
      kezdes_datum: data.get("kezdes_datum") || null
    };
    const button = form.querySelector("button[type=submit]");
    button.disabled = true; button.textContent = "Mentés…";
    const editId = form.dataset.editId;
    let result;
    if (editId) result = await client.from("munkafigyelo_hirdetesek").update(payload).eq("id", editId).select().single();
    else result = await client.from("munkafigyelo_hirdetesek").insert({ ...payload, allapot: "aktiv", forras_tipus: "megrendelo" }).select().single();
    if (result.error) { button.disabled = false; button.textContent = editId ? "Módosítás mentése" : "Munka közzététele"; return showToast(result.error.message, "error"); }
    showToast(editId ? "A munka módosítva." : "A munka megjelent a Munkafigyelőben.");
    trackEvent?.(editId ? "munkafigyelo_ad_updated" : "munkafigyelo_ad_created", { ad_id: result.data.id, szakma: payload.szakma, megye: payload.megye });
    if (!editId) client.functions.invoke("munkafigyelo-push", { body: { hirdetesId: result.data.id } }).catch(() => {});
    await switchTab("mine");
  }

  async function renderMinePanel(panel) {
    if (!await requireLogin("A saját hirdetéseidhez jelentkezz be.")) return;
    const { data, error } = await client.from("munkafigyelo_hirdetesek").select("*").eq("owner_id", session.user.id).order("created_at", { ascending: false });
    if (error) { panel.innerHTML = errorBox(error); return; }
    panel.innerHTML = `<div class="flex items-center justify-between mb-4"><div><h2 class="text-2xl font-black">Saját hirdetéseim</h2><p class="text-sm text-slate-500">Módosíthatod, lezárhatod vagy törölheted a munkákat.</p></div><button data-new-job class="bg-emerald-700 text-white rounded-xl px-4 py-2.5 font-black">+ Új munka</button></div><div class="space-y-3">${(data || []).map(myJobRow).join("") || `<div class="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-500">Még nem adtál fel munkát.</div>`}</div>`;
    panel.querySelector("[data-new-job]")?.addEventListener("click", () => switchTab("form"));
    panel.querySelectorAll("[data-edit-job]").forEach(b => b.addEventListener("click", async () => {
      currentTab = "form"; root.querySelectorAll(".mf-tab").forEach(x => x.className = `mf-tab px-4 py-3 rounded-xl font-extrabold text-sm whitespace-nowrap transition ${x.dataset.mfTab === "form" ? "bg-emerald-700 text-white shadow" : "text-slate-600 hover:bg-slate-100"}`);
      await renderFormPanel(panel, data.find(x => x.id === b.dataset.editJob));
    }));
    panel.querySelectorAll("[data-status-job]").forEach(b => b.addEventListener("click", () => updateOwnStatus(b.dataset.statusJob, b.dataset.status)));
    panel.querySelectorAll("[data-delete-job]").forEach(b => b.addEventListener("click", () => deleteOwnJob(b.dataset.deleteJob)));
  }

  function myJobRow(job) {
    const expired = new Date(job.lejar_at) <= new Date();
    const labels = { aktiv: "Aktív", lezart: "Lezárva", betoltve: "Szakember megtalálva", letiltva: "Admin által letiltva" };
    return `<article class="bg-white border border-slate-200 rounded-2xl p-5"><div class="flex flex-col md:flex-row md:items-start justify-between gap-4"><div><div class="flex flex-wrap gap-2 mb-2"><span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">${esc(job.szakma)}</span><span class="rounded-full ${job.allapot === "aktiv" && !expired ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"} px-2.5 py-1 text-xs font-bold">${expired ? "Lejárt" : esc(labels[job.allapot] || job.allapot)}</span></div><h3 class="font-black text-lg">${esc(job.cim)}</h3><p class="text-sm text-slate-500 mt-1">${esc(job.telepules)} · Lejárat: ${esc(formatDate(job.lejar_at))}</p></div><div class="flex flex-wrap gap-2">${job.allapot !== "letiltva" ? `<button data-edit-job="${esc(job.id)}" class="px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold">Módosítás</button>${job.allapot === "aktiv" ? `<button data-status-job="${esc(job.id)}" data-status="betoltve" class="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-bold">Szakember megvan</button><button data-status-job="${esc(job.id)}" data-status="lezart" class="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold">Lezárás</button>` : `<button data-status-job="${esc(job.id)}" data-status="aktiv" class="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-bold">Újranyitás</button>`}` : ""}<button data-delete-job="${esc(job.id)}" class="px-3 py-2 rounded-lg text-rose-600 text-sm font-bold">Törlés</button></div></div></article>`;
  }

  async function updateOwnStatus(id, status) {
    const payload = { allapot: status };
    if (status === "aktiv") payload.lejar_at = new Date(Date.now() + 30 * 86400000).toISOString();
    const { error } = await client.from("munkafigyelo_hirdetesek").update(payload).eq("id", id);
    if (error) return showToast(error.message, "error");
    showToast("A hirdetés állapota frissült."); await switchTab("mine");
  }

  async function deleteOwnJob(id) {
    if (!confirm("Biztosan végleg törlöd ezt a munkát?")) return;
    const { error } = await client.from("munkafigyelo_hirdetesek").delete().eq("id", id);
    if (error) return showToast(error.message, "error");
    showToast("A hirdetés törölve."); await switchTab("mine");
  }

  async function renderPushPanel(panel) {
    if (!await requireLogin("Az értesítések beállításához jelentkezz be.")) return;
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    let subscription = null;
    if (supported) {
      const reg = await navigator.serviceWorker.register("/service-worker.js");
      subscription = await reg.pushManager.getSubscription();
    }
    let saved = null;
    if (subscription) {
      const result = await client.from("munkafigyelo_push_feliratkozasok").select("*").eq("endpoint", subscription.endpoint).maybeSingle();
      saved = result.data;
    }
    panel.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-7">
        <div class="flex items-start gap-4"><div class="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-2xl">🔔</div><div><h2 class="text-2xl font-black">Munkaértesítések</h2><p class="text-sm text-slate-600 mt-1">Csak azokról az új munkákról küldünk push üzenetet, amelyek megfelelnek a választásaidnak.</p></div></div>
        ${!supported ? `<div class="mt-6 bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl">Ez a böngésző nem támogatja a webes push értesítést. Próbáld Chrome, Edge vagy Android böngészőben.</div>` : `
        <form id="mf-push-form" class="mt-7 space-y-6">
          <fieldset><legend class="font-black mb-3">Szakmák</legend><p class="text-xs text-slate-500 mb-3">Ha egyet sem jelölsz, minden szakmáról értesítünk.</p><div class="grid grid-cols-2 md:grid-cols-3 gap-2">${checkboxes("szakmak", SZAKMAK, saved?.szakmak || [])}</div></fieldset>
          <fieldset><legend class="font-black mb-3">Megyék</legend><p class="text-xs text-slate-500 mb-3">Ha egyet sem jelölsz, az egész országot figyeljük.</p><div class="grid grid-cols-2 md:grid-cols-3 gap-2">${checkboxes("megyek", MEGYEK, saved?.megyek || [])}</div></fieldset>
          <fieldset><legend class="font-black mb-3">Sürgősség</legend><div class="grid grid-cols-1 sm:grid-cols-3 gap-2">${checkboxes("surgossegek", ["normal", "hamarosan", "surgos"], saved?.surgossegek || ["normal", "hamarosan", "surgos"], x => SURGOSSEG[x].label)}</div></fieldset>
          <div class="flex flex-wrap gap-3"><button class="bg-emerald-700 text-white px-6 py-3 rounded-xl font-black">${subscription ? "Beállítások mentése" : "Push értesítés bekapcsolása"}</button>${subscription ? `<button type="button" data-push-off class="px-5 py-3 rounded-xl border border-rose-200 text-rose-600 font-bold">Kikapcsolás ezen az eszközön</button>` : ""}</div>
          <p class="text-xs text-slate-500">Az értesítést bármikor kikapcsolhatod. A böngésző technikai azonosítóját csak a push üzenetek kézbesítéséhez tároljuk.</p>
        </form>`}
      </div>`;
    if (!supported) return;
    panel.querySelector("#mf-push-form").addEventListener("submit", savePush);
    panel.querySelector("[data-push-off]")?.addEventListener("click", disablePush);
  }

  function checkboxes(name, values, selected, label = x => x) {
    return values.map(value => `<label class="flex gap-2 items-start rounded-xl border border-slate-200 p-2.5 text-xs font-semibold hover:bg-slate-50"><input type="checkbox" name="${name}" value="${esc(value)}" ${selected.includes(value) ? "checked" : ""} class="mt-0.5"><span>${esc(label(value))}</span></label>`).join("");
  }

  async function savePush(event) {
    event.preventDefault();
    if (Notification.permission === "denied") return showToast("A böngészőben le van tiltva az értesítés. A címsor melletti lakatnál engedélyezheted.", "error");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return showToast("Az értesítés nem lett engedélyezve.", "info");
    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    const json = subscription.toJSON();
    const form = new FormData(event.currentTarget);
    const values = name => form.getAll(name);
    const payload = { user_id: session.user.id, endpoint: subscription.endpoint, p256dh: json.keys.p256dh, auth_key: json.keys.auth, szakmak: values("szakmak"), megyek: values("megyek"), surgossegek: values("surgossegek"), aktiv: true };
    const { error } = await client.from("munkafigyelo_push_feliratkozasok").upsert(payload, { onConflict: "endpoint" });
    if (error) return showToast(error.message, "error");
    showToast("A munkaértesítés beállításai elmentve."); trackEvent?.("munkafigyelo_push_enabled", {}); await renderPushPanel(root.querySelector("#mf-panel"));
  }

  async function disablePush() {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      await client.from("munkafigyelo_push_feliratkozasok").delete().eq("endpoint", subscription.endpoint);
      await subscription.unsubscribe();
    }
    showToast("A push értesítés kikapcsolva ezen az eszközön."); await renderPushPanel(root.querySelector("#mf-panel"));
  }

  function errorBox(error, title = "Nem sikerült betölteni az adatokat.") {
    return `<div class="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-5"><h3 class="font-black">${esc(title)}</h3><p class="text-sm mt-1">${esc(error?.message || error || "Ismeretlen hiba")}</p></div>`;
  }

  async function renderAdmin(target, adminSession) {
    if (!target || !adminSession || adminSession.user.email.toLowerCase() !== adminEmail.toLowerCase()) return;
    const [{ data: jobs, error: jobError }, { data: reports, error: reportError }] = await Promise.all([
      client.from("munkafigyelo_hirdetesek").select("*").order("created_at", { ascending: false }).limit(300),
      client.from("munkafigyelo_jelentesek").select("*").order("created_at", { ascending: false }).limit(200)
    ]);
    if (jobError || reportError) { target.innerHTML = errorBox(jobError || reportError, "A Munkafigyelő admin-adatbázisa még nincs telepítve."); return; }
    const active = jobs.filter(x => x.allapot === "aktiv" && new Date(x.lejar_at) > new Date()).length;
    const newReports = reports.filter(x => x.allapot === "uj").length;
    target.innerHTML = `
      <section class="mt-8 border-t-4 border-emerald-600 pt-7">
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-5"><div><h2 class="text-2xl font-black">Munkafigyelő admin</h2><p class="text-sm text-slate-600">Megrendelői munkák, nyilvános források és jelentések kezelése.</p></div><a href="#munkafigyelo" class="font-bold text-emerald-700 hover:underline">Munkafigyelő megnyitása →</a></div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6"><div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4"><div class="text-sm text-emerald-700">Aktív munkák</div><div class="text-3xl font-black">${active}</div></div><div class="bg-slate-50 border border-slate-200 rounded-xl p-4"><div class="text-sm text-slate-600">Összes munka</div><div class="text-3xl font-black">${jobs.length}</div></div><div class="bg-rose-50 border border-rose-200 rounded-xl p-4"><div class="text-sm text-rose-700">Új jelentések</div><div class="text-3xl font-black">${newReports}</div></div></div>
        <details class="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6"><summary class="font-black cursor-pointer">+ Nyilvános forrásból származó munka felvétele</summary>${externalForm()}</details>
        ${newReports ? `<div class="mb-6"><h3 class="font-black text-lg mb-3">Kezeletlen jelentések</h3><div class="space-y-2">${reports.filter(x => x.allapot === "uj").map(report => `<div class="border border-rose-200 bg-rose-50 rounded-xl p-3 flex flex-col md:flex-row md:items-center gap-3 justify-between"><div><b>${esc(report.ok)}</b><div class="text-sm text-slate-600">${esc(report.megjegyzes || "Nincs megjegyzés")} · ${esc(formatDate(report.created_at, true))}</div><div class="text-xs text-slate-500 break-all">Hirdetés: ${esc(report.hirdetes_id)}</div></div><div class="flex gap-2"><button data-admin-report="${esc(report.id)}" data-report-status="kezelve" class="bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-bold">Kezelve</button><button data-admin-report="${esc(report.id)}" data-report-status="elutasitva" class="border border-slate-300 px-3 py-2 rounded-lg text-xs font-bold">Elutasítás</button></div></div>`).join("")}</div></div>` : ""}
        <div class="overflow-x-auto border border-slate-200 rounded-xl"><table class="min-w-[900px] w-full text-sm"><thead class="bg-slate-100 text-left"><tr><th class="p-3">Munka</th><th class="p-3">Hely / szakma</th><th class="p-3">Forrás</th><th class="p-3">Állapot</th><th class="p-3">Művelet</th></tr></thead><tbody>${jobs.map(adminJobRow).join("") || `<tr><td colspan="5" class="p-8 text-center text-slate-500">Még nincs munka.</td></tr>`}</tbody></table></div>
      </section>`;
    target.querySelector("#mf-admin-external")?.addEventListener("submit", saveExternal);
    target.querySelectorAll("[data-admin-status]").forEach(b => b.addEventListener("click", () => adminSetStatus(b.dataset.adminStatus, b.dataset.status, target, adminSession)));
    target.querySelectorAll("[data-admin-delete]").forEach(b => b.addEventListener("click", () => adminDelete(b.dataset.adminDelete, target, adminSession)));
    target.querySelectorAll("[data-admin-report]").forEach(b => b.addEventListener("click", () => adminReport(b.dataset.adminReport, b.dataset.reportStatus, target, adminSession)));
  }

  function externalForm() {
    return `<form id="mf-admin-external" class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3"><input name="cim" required minlength="8" maxlength="120" placeholder="Munka címe" class="rounded-lg border p-2.5"><select name="szakma" required class="rounded-lg border p-2.5">${optionList(SZAKMAK, "Szakma")}</select><select name="megye" required class="rounded-lg border p-2.5">${optionList(MEGYEK, "Megye")}</select><input name="telepules" required placeholder="Település" class="rounded-lg border p-2.5"><input name="forras_url" type="url" required placeholder="https://eredeti-hirdetes.hu/..." class="rounded-lg border p-2.5 md:col-span-2"><textarea name="leiras" required minlength="30" maxlength="4000" rows="4" placeholder="A nyilvános munkakiírás rövid leírása" class="rounded-lg border p-2.5 md:col-span-2"></textarea><select name="surgosseg" class="rounded-lg border p-2.5"><option value="normal">Rugalmas</option><option value="hamarosan">Hamarosan</option><option value="surgos">Sürgős</option></select><select name="forras_tipus" class="rounded-lg border p-2.5"><option value="nyilvanos_forras">Nyilvános forrás</option><option value="kozbeszerzes">Közbeszerzés</option></select><button class="md:col-span-2 bg-blue-700 text-white rounded-lg p-3 font-black">Közzététel és push küldése</button></form>`;
  }

  function adminJobRow(job) {
    return `<tr class="border-t"><td class="p-3"><b>${esc(job.cim)}</b><div class="text-xs text-slate-500">${esc(formatDate(job.created_at, true))}</div></td><td class="p-3">${esc(job.telepules)}, ${esc(job.megye)}<div class="text-xs font-bold text-emerald-700">${esc(job.szakma)}</div></td><td class="p-3">${esc(job.forras_tipus)}</td><td class="p-3 font-bold">${esc(job.allapot)}</td><td class="p-3"><div class="flex flex-wrap gap-2">${job.allapot !== "aktiv" ? `<button data-admin-status="${esc(job.id)}" data-status="aktiv" class="text-emerald-700 font-bold">Aktiválás</button>` : `<button data-admin-status="${esc(job.id)}" data-status="lezart" class="text-slate-700 font-bold">Lezárás</button><button data-admin-status="${esc(job.id)}" data-status="letiltva" class="text-amber-700 font-bold">Letiltás</button>`}<button data-admin-delete="${esc(job.id)}" class="text-rose-600 font-bold">Törlés</button></div></td></tr>`;
  }

  async function saveExternal(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(data.entries());
    const { data: job, error } = await client.from("munkafigyelo_hirdetesek").insert({ ...payload, owner_id: null, allapot: "aktiv", lejar_at: new Date(Date.now() + 30 * 86400000).toISOString() }).select().single();
    if (error) return showToast(error.message, "error");
    showToast("A nyilvános munka közzétéve.");
    await client.functions.invoke("munkafigyelo-push", { body: { hirdetesId: job.id } });
    location.hash = "#admin"; await window.__renderMunkafigyeloAdmin?.();
  }

  async function adminSetStatus(id, status, target, adminSession) {
    const payload = { allapot: status };
    if (status === "aktiv") { payload.lejar_at = new Date(Date.now() + 30 * 86400000).toISOString(); payload.push_kuldve_at = null; }
    const { error } = await client.from("munkafigyelo_hirdetesek").update(payload).eq("id", id);
    if (error) return showToast(error.message, "error");
    if (status === "aktiv") client.functions.invoke("munkafigyelo-push", { body: { hirdetesId: id } }).catch(() => {});
    showToast("A munka állapota frissült."); await renderAdmin(target, adminSession);
  }

  async function adminDelete(id, target, adminSession) {
    if (!confirm("Biztosan végleg törlöd ezt a Munkafigyelő-hirdetést?")) return;
    const { error } = await client.from("munkafigyelo_hirdetesek").delete().eq("id", id);
    if (error) return showToast(error.message, "error");
    showToast("A munka törölve."); await renderAdmin(target, adminSession);
  }

  async function adminReport(id, status, target, adminSession) {
    const { error } = await client.from("munkafigyelo_jelentesek").update({ allapot: status }).eq("id", id);
    if (error) return showToast(error.message, "error");
    showToast("A jelentés kezelve."); await renderAdmin(target, adminSession);
  }

  return { showPage, renderAdmin };
}

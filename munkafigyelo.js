const VAPID_PUBLIC_KEY = "BI9GtCoUOzjMo4ILFJ84E2Ud1nWzt58dd8g3efiESKRXb71BRD2okYXt0lqCR4-VE5-Y2R89aQ2_eKQdLs9b_Qk";
const SAVED_KEY = "szakipiac_munkafigyelo_saved_v3";

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

const SURGOSSEGEK = [
  ["normal", "Normál"],
  ["hamarosan", "Hamarosan"],
  ["surgos", "Sürgős"]
];

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function optionList(values, emptyLabel, selected = "") {
  return `<option value="">${esc(emptyLabel)}</option>${values.map(value =>
    `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(value)}</option>`
  ).join("")}`;
}

function urgencyOptions(selected = "") {
  return `<option value="">Minden sürgősség</option>${SURGOSSEGEK.map(([value, label]) =>
    `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`
  ).join("")}`;
}

function typeLabel(type) {
  return ({
    megrendelo: "Megrendelői munka",
    nyilvanos_forras: "Nyilvános forrás",
    kozbeszerzes: "TED közbeszerzés"
  })[type] || "Külső munka";
}

function typeBadge(type) {
  return ({
    megrendelo: "bg-blue-50 text-blue-700 border-blue-200",
    nyilvanos_forras: "bg-emerald-50 text-emerald-700 border-emerald-200",
    kozbeszerzes: "bg-violet-50 text-violet-700 border-violet-200"
  })[type] || "bg-slate-50 text-slate-700 border-slate-200";
}

function urgencyLabel(value) {
  return Object.fromEntries(SURGOSSEGEK)[value] || "Normál";
}

function formatDate(value) {
  if (!value) return "Nincs megadva";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Nincs megadva" : date.toLocaleDateString("hu-HU");
}

function budgetText(lead) {
  const formatter = new Intl.NumberFormat("hu-HU");
  if (lead.koltseg_min != null && lead.koltseg_max != null) return `${formatter.format(lead.koltseg_min)}–${formatter.format(lead.koltseg_max)} Ft`;
  if (lead.koltseg_min != null) return `${formatter.format(lead.koltseg_min)} Ft-tól`;
  if (lead.koltseg_max != null) return `${formatter.format(lead.koltseg_max)} Ft-ig`;
  return "Nincs megadva";
}

function normalizeLead(row) {
  return {
    ...row,
    id: String(row.id || ""),
    cim: String(row.cim || "Külső munka"),
    leiras: String(row.leiras || ""),
    szakma: String(row.szakma || "Egyéb szakember"),
    megye: String(row.megye || "Országos"),
    telepules: String(row.telepules || ""),
    surgosseg: String(row.surgosseg || "normal"),
    forras_tipus: ["megrendelo", "nyilvanos_forras", "kozbeszerzes"].includes(row.forras_tipus) ? row.forras_tipus : "nyilvanos_forras",
    forras_url: safeUrl(row.forras_url),
    kapcsolat_elerheto: Boolean(row.kapcsolat_elerheto)
  };
}

function savedIds() {
  try { return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || "[]")); }
  catch { return new Set(); }
}

function saveIds(ids) {
  localStorage.setItem(SAVED_KEY, JSON.stringify([...ids]));
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from([...atob(base64)].map(char => char.charCodeAt(0)));
}

export function createMunkafigyelo({ client, showToast = () => {}, trackEvent = () => {}, adminEmail = "" }) {
  let root = null;
  let activeType = "all";
  let allLeads = [];
  let lastLoadError = null;
  let currentSession = null;

  async function refreshSession() {
    const { data } = await client.auth.getSession();
    currentSession = data?.session || null;
    return currentSession;
  }

  async function loadLeads() {
    lastLoadError = null;
    const result = await client
      .from("munkafigyelo_nyilvanos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (result.error) {
      lastLoadError = result.error;
      console.warn("Munkafigyelő betöltési hiba:", result.error);
      return [];
    }

    return (result.data || [])
      .map(normalizeLead)
      .filter(lead => lead.forras_tipus === "megrendelo" || Boolean(lead.forras_url));
  }

  function filteredLeads() {
    const query = (root?.querySelector("[data-mf-search]")?.value || "").trim().toLowerCase();
    const szakma = root?.querySelector("[data-mf-szakma]")?.value || "";
    const megye = root?.querySelector("[data-mf-megye]")?.value || "";
    return allLeads.filter(lead => {
      if (activeType !== "all" && lead.forras_tipus !== activeType) return false;
      if (szakma && lead.szakma !== szakma) return false;
      if (megye && lead.megye !== megye && lead.megye !== "Országos") return false;
      if (query && !`${lead.cim} ${lead.leiras} ${lead.szakma} ${lead.megye} ${lead.telepules}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }

  function card(lead) {
    const saved = savedIds().has(lead.id);
    const isTed = lead.forras_tipus === "kozbeszerzes";
    const canContact = lead.forras_tipus === "megrendelo" && lead.kapcsolat_elerheto;
    const location = [lead.iranyitoszam, lead.telepules, lead.megye].filter(Boolean).join(" ") || "Országos";
    const openLabel = isTed ? "TED hirdetmény megnyitása" : "Eredeti hirdetés megnyitása";
    const sourceText = isTed ? "TED EU közbeszerzés" : typeLabel(lead.forras_tipus);
    return `<article class="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 hover:shadow-md transition" data-lead-id="${esc(lead.id)}">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap gap-2 mb-2">
            <span class="inline-flex border rounded-full px-3 py-1 text-xs font-black ${typeBadge(lead.forras_tipus)}">${isTed ? "🏛️ " : ""}${typeLabel(lead.forras_tipus)}</span>
            <span class="inline-flex bg-slate-100 text-slate-700 rounded-full px-3 py-1 text-xs font-black">${esc(lead.szakma)}</span>
            <span class="inline-flex bg-orange-50 text-orange-700 rounded-full px-3 py-1 text-xs font-black">${urgencyLabel(lead.surgosseg)}</span>
          </div>
          <h3 class="text-xl font-black text-slate-900 leading-tight">${esc(lead.cim)}</h3>
          <p class="text-sm text-slate-500 mt-1">📍 ${esc(location)} · ${formatDate(lead.created_at)}</p>
        </div>
        <button type="button" data-save-lead="${esc(lead.id)}" class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-black hover:bg-slate-50">${saved ? "★ Mentve" : "☆ Mentés"}</button>
      </div>
      <p class="text-slate-700 mt-4 whitespace-pre-line line-clamp-4">${esc(lead.leiras)}</p>
      <div class="grid grid-cols-1 2xl:grid-cols-3 gap-3 mt-4 text-sm">
        <div class="rounded-xl bg-slate-50 p-3"><b>Keret:</b><br>${esc(budgetText(lead))}</div>
        <div class="rounded-xl bg-slate-50 p-3"><b>Kezdés / határidő:</b><br>${esc(formatDate(lead.kezdes_datum || lead.lejar_at))}</div>
        <div class="rounded-xl bg-slate-50 p-3"><b>Forrás:</b><br>${esc(sourceText)}</div>
      </div>
      <div class="flex flex-wrap gap-3 mt-5">
        ${lead.forras_url ? `<a href="${esc(lead.forras_url)}" target="_blank" rel="noopener noreferrer" class="bg-emerald-700 text-white rounded-xl px-4 py-2.5 font-black hover:bg-emerald-800">${openLabel}</a>` : ""}
        ${canContact ? `<button type="button" data-contact-lead="${esc(lead.id)}" class="bg-blue-700 text-white rounded-xl px-4 py-2.5 font-black hover:bg-blue-800">Kapcsolatfelvétel</button>` : ""}
        <button type="button" data-details-lead="${esc(lead.id)}" class="border border-slate-300 rounded-xl px-4 py-2.5 font-black hover:bg-slate-50">Részletek</button>
      </div>
    </article>`;
  }

  function renderList(customLeads = null, customLabel = null) {
    const list = root?.querySelector("[data-mf-list]");
    const leads = customLeads || filteredLeads();
    if (!list) return;
    root.querySelector("[data-mf-count]").textContent = customLabel || `${leads.length} találat`;
    list.innerHTML = leads.length
      ? leads.map(card).join("")
      : `<div class="md:col-span-2 bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500 font-bold">Most nincs találat ezekkel a szűrőkkel.</div>`;
    wireListButtons();
  }

  function setType(type) {
    activeType = type;
    root.querySelectorAll("[data-mf-type]").forEach(button => {
      const active = button.dataset.mfType === type;
      button.className = `px-4 py-2.5 rounded-xl text-sm font-black border transition ${active ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`;
    });
    renderList();
  }

  function togglePanel(name) {
    const pushPanel = root.querySelector("[data-push-panel]");
    const savedPanel = root.querySelector("[data-saved-panel]");
    if (pushPanel) pushPanel.classList.toggle("hidden", name !== "push" || !pushPanel.classList.contains("hidden"));
    if (savedPanel) savedPanel.classList.toggle("hidden", name !== "saved" || !savedPanel.classList.contains("hidden"));
  }

  function renderSavedPanel() {
    const box = root.querySelector("[data-saved-panel]");
    if (!box) return;
    const saved = allLeads.filter(item => savedIds().has(item.id));
    box.innerHTML = `<div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-black text-slate-900">★ Mentett munkák</h2>
          <p class="text-sm text-slate-600">${saved.length ? `${saved.length} mentett találat ezen az eszközön.` : "Még nincs mentett munka ezen az eszközön."}</p>
        </div>
        ${saved.length ? `<button type="button" data-show-saved-list class="bg-emerald-700 text-white rounded-xl px-4 py-2.5 font-black hover:bg-emerald-800">Mentettek listázása</button>` : ""}
      </div>
    </div>`;
    box.querySelector("[data-show-saved-list]")?.addEventListener("click", () => {
      renderList(saved, `${saved.length} mentett találat`);
    });
  }

  function wireListButtons() {
    root.querySelectorAll("[data-save-lead]").forEach(button => button.addEventListener("click", () => {
      const ids = savedIds();
      const id = button.dataset.saveLead;
      if (ids.has(id)) ids.delete(id); else ids.add(id);
      saveIds(ids);
      renderSavedPanel();
      renderList();
    }));

    root.querySelectorAll("[data-details-lead]").forEach(button => button.addEventListener("click", () => {
      const lead = allLeads.find(item => item.id === button.dataset.detailsLead);
      if (lead) alert(`${lead.cim}\n\n${lead.leiras}\n\nHely: ${lead.telepules} ${lead.megye}\nForrás: ${lead.forras_tipus === "kozbeszerzes" ? "TED EU közbeszerzés" : typeLabel(lead.forras_tipus)}`);
    }));

    root.querySelectorAll("[data-contact-lead]").forEach(button => button.addEventListener("click", async () => {
      const message = prompt("Írd meg röviden, miben tudsz segíteni a megrendelőnek:");
      if (!message) return;
      const session = await refreshSession();
      if (!session?.user) return showToast("Kapcsolatfelvételhez jelentkezz be.", "error");
      const result = await client.rpc("munkafigyelo_kapcsolat_kuldese", { p_hirdetes_id: button.dataset.contactLead, p_uzenet: message });
      if (result.error) return showToast(`Nem sikerült elküldeni: ${result.error.message}`, "error");
      showToast("Üzenet elküldve a megrendelőnek.");
    }));
  }

  function shellHtml() {
    return `<section class="max-w-7xl mx-auto px-4 py-8">
      <div class="rounded-3xl bg-gradient-to-br from-emerald-700 to-slate-900 text-white p-6 md:p-8 shadow-xl mb-6">
        <p class="uppercase tracking-[0.25em] text-emerald-100 text-xs font-black mb-2">SzakiPiac Munkafigyelő</p>
        <h1 class="text-3xl md:text-5xl font-black leading-tight">Friss munkák egy helyen</h1>
        <p class="text-emerald-50 mt-3 max-w-3xl">Külső forrásokból gyűjtött szakemberkeresések, megrendelői munkák és közbeszerzések egy helyen.</p>
      </div>

      ${lastLoadError ? `<div class="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-4 mb-5 text-sm font-bold">A munkák most nem tölthetők be. Kérjük, próbáld újra később.</div>` : ""}

      <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm mb-4">
        <div class="flex flex-wrap gap-2 mb-4">
          <button type="button" data-mf-type="all">Összes</button>
          <button type="button" data-mf-type="megrendelo">Megrendelői munkák</button>
          <button type="button" data-mf-type="kozbeszerzes">Közbeszerzések</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input data-mf-search placeholder="Keresés: burkoló, tető, felújítás..." class="md:col-span-2 rounded-xl border border-slate-300 p-3">
          <select data-mf-szakma class="rounded-xl border border-slate-300 p-3">${optionList(SZAKMAK, "Minden szakma")}</select>
          <select data-mf-megye class="rounded-xl border border-slate-300 p-3">${optionList(MEGYEK, "Minden megye")}</select>
        </div>
        <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div class="text-sm font-black text-slate-600" data-mf-count></div>
          <div class="flex flex-wrap gap-2">
            <button type="button" data-toggle-push class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-800 hover:bg-emerald-100">🔔 Értesítés beállítása</button>
            <button type="button" data-toggle-saved class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50">★ Mentett munkák</button>
          </div>
        </div>
        <div data-push-panel class="hidden mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <h2 class="text-lg font-black text-slate-900 mb-1">Értesítéseim</h2>
          <p class="text-sm text-slate-600 mb-4">Kérj értesítést a neked megfelelő új munkákról és közbeszerzésekről.</p>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select data-push-szakma class="rounded-xl border border-slate-300 p-3">${optionList(SZAKMAK, "Minden szakma")}</select>
            <select data-push-megye class="rounded-xl border border-slate-300 p-3">${optionList(MEGYEK, "Minden megye")}</select>
            <select data-push-surgosseg class="rounded-xl border border-slate-300 p-3">${urgencyOptions()}</select>
          </div>
          <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <button type="button" data-enable-push class="bg-emerald-700 text-white rounded-xl px-4 py-3 font-black hover:bg-emerald-800">Értesítést kérek</button>
            <button type="button" data-disable-push class="border border-slate-300 bg-white rounded-xl px-4 py-3 font-black hover:bg-slate-50">Értesítés kikapcsolása</button>
          </div>
          <div data-push-status class="hidden mt-3 rounded-xl border p-3 text-sm font-bold"></div>
        </div>
        <div data-saved-panel class="hidden mt-4"></div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4" data-mf-list></div>
    </section>`;
  }

  function pushStatus(message, isError = false) {
    const box = root.querySelector("[data-push-status]");
    if (!box) return;
    box.className = `mt-3 rounded-xl border p-3 text-sm font-bold ${isError ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`;
    box.textContent = message;
  }

  async function loadPushPreferences() {
    if (!currentSession?.user?.id || !("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    if (!subscription) return;
    const { data } = await client.from("munkafigyelo_push_feliratkozasok")
      .select("szakmak,megyek,surgossegek,aktiv")
      .eq("endpoint", subscription.endpoint)
      .maybeSingle();
    if (!data) return;
    root.querySelector("[data-push-szakma]").value = data.szakmak?.[0] || "";
    root.querySelector("[data-push-megye]").value = data.megyek?.[0] || "";
    root.querySelector("[data-push-surgosseg]").value = data.surgossegek?.[0] || "";
    if (data.aktiv) pushStatus("Az értesítés aktív ezen az eszközön.");
  }

  async function enablePush() {
    try {
      const session = await refreshSession();
      if (!session?.user?.id) throw new Error("Értesítéshez jelentkezz be.");
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Ez a böngésző nem támogatja a push értesítést.");
      if (await Notification.requestPermission() !== "granted") throw new Error("Az értesítési engedély nincs megadva.");
      const registration = await navigator.serviceWorker.register("/service-worker.js");
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
      const json = subscription.toJSON();
      const szakma = root.querySelector("[data-push-szakma]").value;
      const megye = root.querySelector("[data-push-megye]").value;
      const surgosseg = root.querySelector("[data-push-surgosseg]").value;
      const result = await client.from("munkafigyelo_push_feliratkozasok").upsert({
        user_id: session.user.id,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth_key: json.keys?.auth,
        szakmak: szakma ? [szakma] : [],
        megyek: megye ? [megye] : [],
        surgossegek: surgosseg ? [surgosseg] : [],
        aktiv: true,
        updated_at: new Date().toISOString()
      }, { onConflict: "endpoint" });
      if (result.error) throw result.error;
      pushStatus("Értesítés bekapcsolva a kiválasztott szűrőkkel.");
      showToast("Munkafigyelő értesítés bekapcsolva.");
    } catch (error) {
      pushStatus(error.message || String(error), true);
      showToast(`Értesítés hiba: ${error.message || error}`, "error");
    }
  }

  async function disablePush() {
    try {
      const registration = await navigator.serviceWorker?.getRegistration?.();
      const subscription = await registration?.pushManager?.getSubscription?.();
      if (subscription) {
        const result = await client.from("munkafigyelo_push_feliratkozasok")
          .update({ aktiv: false, updated_at: new Date().toISOString() })
          .eq("endpoint", subscription.endpoint);
        if (result.error) throw result.error;
        await subscription.unsubscribe();
      }
      pushStatus("Értesítés kikapcsolva ezen az eszközön.");
    } catch (error) {
      pushStatus(`Nem sikerült kikapcsolni: ${error.message || error}`, true);
    }
  }

  async function showPage() {
    root = document.getElementById("munkafigyelo-page");
    if (!root) return;
    root.innerHTML = `<section class="max-w-7xl mx-auto px-4 py-10"><div class="bg-white rounded-2xl border border-slate-200 p-8 text-center font-black">Munkafigyelő betöltése…</div></section>`;
    await refreshSession();
    allLeads = await loadLeads();
    root.innerHTML = shellHtml();
    root.querySelectorAll("[data-mf-type]").forEach(button => button.addEventListener("click", () => setType(button.dataset.mfType)));
    root.querySelector("[data-mf-search]")?.addEventListener("input", () => renderList());
    root.querySelector("[data-mf-szakma]")?.addEventListener("change", () => renderList());
    root.querySelector("[data-mf-megye]")?.addEventListener("change", () => renderList());
    root.querySelector("[data-toggle-push]")?.addEventListener("click", () => togglePanel("push"));
    root.querySelector("[data-toggle-saved]")?.addEventListener("click", () => { renderSavedPanel(); togglePanel("saved"); });
    root.querySelector("[data-enable-push]")?.addEventListener("click", enablePush);
    root.querySelector("[data-disable-push]")?.addEventListener("click", disablePush);
    setType("all");
    renderSavedPanel();
    await loadPushPreferences().catch(() => {});
    trackEvent("munkafigyelo_view", { count: allLeads.length });
  }

  async function renderAdmin(panel, session) {
    if (!panel) return;
    const email = (session?.user?.email || "").toLowerCase();
    if (!session?.user || (adminEmail && email !== adminEmail.toLowerCase())) {
      panel.innerHTML = `<div class="bg-white border border-slate-200 rounded-2xl p-6 text-slate-600">A Munkafigyelő admin rész csak adminnak látszik.</div>`;
      return;
    }
    panel.innerHTML = `<div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-7">
      <h2 class="text-2xl font-black mb-2">Külső munka / közbeszerzés hozzáadása</h2>
      <p class="text-sm text-slate-600 mb-5">Adminisztrációs eszköz ellenőrzött külső források rögzítéséhez.</p>
      <form data-admin-lead-form class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input name="cim" required minlength="8" placeholder="Cím" class="rounded-xl border border-slate-300 p-3 md:col-span-2">
        <textarea name="leiras" required minlength="20" rows="4" placeholder="Leírás" class="rounded-xl border border-slate-300 p-3 md:col-span-2"></textarea>
        <select name="szakma" required class="rounded-xl border border-slate-300 p-3">${optionList(SZAKMAK, "Szakma")}</select>
        <select name="megye" required class="rounded-xl border border-slate-300 p-3">${optionList(MEGYEK, "Megye")}</select>
        <input name="telepules" required placeholder="Település" class="rounded-xl border border-slate-300 p-3">
        <select name="forras_tipus" class="rounded-xl border border-slate-300 p-3"><option value="nyilvanos_forras">Nyilvános forrás</option><option value="kozbeszerzes">Közbeszerzés</option></select>
        <input name="forras_url" required type="url" placeholder="Forrás URL / TED link" class="rounded-xl border border-slate-300 p-3 md:col-span-2">
        <button class="bg-emerald-700 text-white rounded-xl px-5 py-3 font-black md:col-span-2">Külső rekord mentése</button>
        <div data-admin-status class="hidden md:col-span-2 rounded-xl border p-3 text-sm font-bold"></div>
      </form>
    </div>`;
    const form = panel.querySelector("[data-admin-lead-form]");
    const setStatus = (message, isError = false) => {
      const box = panel.querySelector("[data-admin-status]");
      box.className = `md:col-span-2 rounded-xl border p-3 text-sm font-bold ${isError ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`;
      box.textContent = message;
    };
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const data = new FormData(form);
      const payload = {
        cim: String(data.get("cim") || "").trim(),
        leiras: String(data.get("leiras") || "").trim(),
        szakma: data.get("szakma"),
        megye: data.get("megye"),
        telepules: String(data.get("telepules") || "").trim(),
        surgosseg: "normal",
        forras_tipus: data.get("forras_tipus") || "nyilvanos_forras",
        forras_url: safeUrl(data.get("forras_url")),
        allapot: "aktiv",
        lejar_at: new Date(Date.now() + 90 * 86400000).toISOString()
      };
      if (!payload.cim || !payload.leiras || !payload.forras_url) return setStatus("Cím, leírás és érvényes forrás URL kötelező.", true);
      const result = await client.from("munkafigyelo_hirdetesek").insert(payload).select("id").single();
      if (result.error) return setStatus(`Mentési hiba: ${result.error.message}`, true);
      setStatus("A külső rekord mentve.");
      client.functions.invoke("munkafigyelo-push", { body: { hirdetesId: result.data.id } }).catch(() => {});
      form.reset();
    });
  }

  return { showPage, renderAdmin };
}

/* =========================
   SzakiPiac oldaljavító patch
   - Hirdetés feladása: szolgáltatás kínálat / szakember keresés
   - AI szövegíró mindkét módhoz
   - Partner reklámkártyák rendezése
========================= */
(function initSzakiPiacFeltoltesEsReklamPatch() {
  const PATCH_FLAG = "spFeltoltesKeresesPatchV1";
  const PARTNER_FLAG = "spPartnerCardsV1";

  function toast(message, type = "success") {
    const el = document.getElementById("toast-notification");
    if (!el) return console.log(message);
    const bg = type === "error" ? "bg-red-600" : (type === "info" ? "bg-blue-600" : "bg-green-600");
    el.textContent = message;
    el.className = `fixed top-5 right-5 text-white py-3 px-6 rounded-lg shadow-xl transform transition-transform duration-300 z-[110] ${bg}`;
    el.classList.remove("translate-x-[120%]");
    setTimeout(() => el.classList.add("translate-x-[120%]"), 4200);
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function selectedAdKind() {
    return document.querySelector('input[name="adKind"]:checked')?.value || "kinalat";
  }

  function updateAdKindUI() {
    const isRequest = selectedAdKind() === "kereses";
    const info = document.getElementById("ad-kind-info");
    const packageSection = document.getElementById("package-section");
    const imageSection = document.getElementById("image-section");
    const videoWrapper = document.getElementById("video-wrapper");
    const aiInput = document.getElementById("ai-keywords");
    const cim = document.getElementById("cim");
    const leiras = document.getElementById("leiras");
    const ar = document.getElementById("ar");
    const weboldal = document.getElementById("weboldal");
    const submitButton = document.querySelector('#submit-area button[type="submit"]');
    const packageInfo = document.getElementById("package-info");
    const paypal = document.getElementById("paypal-container");

    if (info) {
      info.className = isRequest
        ? "mt-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-900"
        : "mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900";
      info.textContent = isRequest
        ? "A munkafeladás a Munkafigyelő / Megrendelői munkák alatt jelenik meg. Szakemberek innen tudnak érdeklődni."
        : "A hirdetés a főoldali szakember listában fog megjelenni.";
    }
    packageSection?.classList.toggle("hidden", isRequest);
    imageSection?.classList.toggle("hidden", isRequest);
    videoWrapper?.classList.toggle("hidden", isRequest);
    if (paypal && isRequest) paypal.style.display = "none";
    if (packageInfo && isRequest) packageInfo.textContent = "Megrendelői munkafeladás – ingyenes, a Munkafigyelőben jelenik meg.";
    if (aiInput) aiInput.placeholder = isRequest ? "Pl: fürdőszoba felújítás burkoló" : "Pl: szobafestés";
    if (cim) cim.placeholder = isRequest ? "Pl: Fürdőszoba felújításhoz burkolót keresek" : "Cím";
    if (leiras) leiras.placeholder = isRequest ? "Írd le röviden a munkát, helyszínt, határidőt és fontos részleteket..." : "Leírás";
    if (ar) {
      ar.placeholder = isRequest ? "Tervezett keret (Ft)" : "Ár (Ft)";
      ar.setAttribute("aria-label", isRequest ? "Tervezett keret forintban" : "Ár forintban");
    }
    if (weboldal) weboldal.placeholder = isRequest ? "Weboldal (nem kötelező)" : "Weboldal";
    if (submitButton) submitButton.textContent = isRequest ? "Munka feladása" : "Beküldés";
  }

  function addAdKindChooser() {
    const form = document.getElementById("ad-form");
    const aiBox = document.getElementById("ai-keywords")?.closest(".bg-indigo-50");
    if (!form || !aiBox || document.getElementById("ad-kind-box")) return;

    const box = document.createElement("div");
    box.id = "ad-kind-box";
    box.className = "bg-white border border-slate-200 p-4 rounded-xl mb-6 shadow-sm";
    box.innerHTML = `
      <h2 class="font-black text-slate-900 mb-3">Mit szeretnél feladni?</h2>
      <div class="grid md:grid-cols-2 gap-3">
        <label class="cursor-pointer rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex gap-3 items-start hover:bg-emerald-100">
          <input type="radio" name="adKind" value="kinalat" checked class="mt-1">
          <span><span class="block font-black text-emerald-900">Szolgáltatást / vállalkozást hirdetek</span><span class="block text-sm text-emerald-800 mt-1">Szakemberként vagy vállalkozóként munkát szeretnék kapni.</span></span>
        </label>
        <label class="cursor-pointer rounded-xl border border-blue-200 bg-blue-50 p-4 flex gap-3 items-start hover:bg-blue-100">
          <input type="radio" name="adKind" value="kereses" class="mt-1">
          <span><span class="block font-black text-blue-900">Munkára keresek szakembert</span><span class="block text-sm text-blue-800 mt-1">Megrendelőként felújításhoz, javításhoz vagy építéshez keresek szakembert.</span></span>
        </label>
      </div>
      <div id="ad-kind-info" class="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">A hirdetés a főoldali szakember listában fog megjelenni.</div>`;
    aiBox.parentNode.insertBefore(box, aiBox);
    box.querySelectorAll('input[name="adKind"]').forEach(input => input.addEventListener("change", updateAdKindUI));

    const title = aiBox.querySelector("h3");
    if (title) title.textContent = "✨ AI Szövegíró – kínálathoz és kereséshez";
    const modeWrap = aiBox.querySelector(".mt-3");
    if (modeWrap && !aiBox.querySelector("[data-ai-purpose-note]")) {
      const note = document.createElement("div");
      note.dataset.aiPurposeNote = "true";
      note.className = "text-xs text-indigo-700 mt-2";
      note.textContent = "Az AI automatikusan figyeli, hogy szolgáltatást kínálsz vagy szakembert keresel.";
      modeWrap.appendChild(note);
    }
  }

  function wrapAiWriter() {
    if (window.__spOriginalGenerateAI || typeof window.generateAI !== "function") return;
    window.__spOriginalGenerateAI = window.generateAI;
    window.generateAI = async function patchedGenerateAI() {
      const k = (document.getElementById("ai-keywords")?.value || "").trim();
      if (!k) return toast("Írj be kulcsszót!", "error");
      const mode = document.querySelector('input[name="aiMode"]:checked')?.value || "quick";
      const adKind = selectedAdKind();
      const purpose = adKind === "kereses"
        ? "Szakembert kereső megrendelői munkafeladás"
        : "Szolgáltatást kínáló szakember hirdetése";
      const btn = document.getElementById("ai-btn");
      if (btn) { btn.textContent = mode === "premium" ? "Prémium generálás..." : "Generálás..."; btn.disabled = true; }
      try {
        const res = await fetch("https://bxtpnotswnwrbycvfypz.supabase.co/functions/v1/generate-ad", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: `${purpose}: ${k}`, mode, purpose: adKind })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "AI hiba történt.");
        const title = data?.title || data?.cim || "";
        const desc = data?.description || data?.leiras || "";
        const cta = data?.cta ? ("\n\n" + data.cta) : "";
        if (title) document.getElementById("cim").value = title;
        if (desc) document.getElementById("leiras").value = desc + cta;
        toast(adKind === "kereses" ? "Megrendelői munkaszöveg generálva!" : "Hirdetés generálva!", "success");
      } catch (err) {
        console.error(err);
        toast("Nem sikerült generálni: " + (err?.message || "ismeretlen hiba"), "error");
      } finally {
        if (btn) { btn.textContent = "Írd meg!"; btn.disabled = false; }
      }
    };
  }

  async function saveRequestJob(event) {
    if (selectedAdKind() !== "kereses") return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const client = window.supaClient;
    if (!client) return toast("Supabase kapcsolat nem elérhető.", "error");
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user?.id) return toast("Munkafeladáshoz előbb jelentkezz be!", "error");

    const cim = (document.getElementById("cim")?.value || "").trim();
    const leiras = (document.getElementById("leiras")?.value || "").trim();
    const category = document.getElementById("kategoria")?.value || "Egyéb szakember";
    const city = (document.getElementById("varos")?.value || "").trim();
    if (!cim || !leiras || !category || !city) return toast("Cím, leírás, kategória és város kötelező.", "error");

    const arRaw = document.getElementById("ar")?.value;
    const arValue = arRaw ? parseInt(arRaw, 10) : null;
    const lejarat = new Date();
    lejarat.setDate(lejarat.getDate() + 30);

    toast("Munka mentése...", "info");
    const { data: insertedJob, error } = await client
      .from("munkafigyelo_hirdetesek")
      .insert({
        owner_id: session.user.id,
        cim,
        leiras,
        szakma: category,
        megye: "Országos",
        telepules: city,
        iranyitoszam: document.getElementById("iranyitoszam")?.value || "",
        surgosseg: "normal",
        koltseg_min: null,
        koltseg_max: Number.isFinite(arValue) ? arValue : null,
        allapot: "aktiv",
        forras_tipus: "megrendelo",
        forras_url: null,
        lejar_at: lejarat.toISOString()
      })
      .select("id,cim")
      .single();
    if (error) return toast("Nem sikerült menteni: " + error.message, "error");
    client.functions.invoke("munkafigyelo-push", { body: { hirdetesId: insertedJob?.id } }).catch(() => {});
    toast("Megrendelői munka feladva a Munkafigyelőbe!", "success");
    window.location.hash = "#munkafigyelo";
  }

  function patchFeltoltesPage() {
    const form = document.getElementById("ad-form");
    if (!form || form.dataset[PATCH_FLAG] === "true") return;
    form.dataset[PATCH_FLAG] = "true";
    addAdKindChooser();
    wrapAiWriter();
    form.addEventListener("submit", saveRequestJob, true);
    updateAdKindUI();
  }

  function patchPartnerCards() {
    const slider = document.getElementById("reklam-slider");
    if (!slider || slider.dataset[PARTNER_FLAG] === "true") return;
    slider.dataset[PARTNER_FLAG] = "true";
    const ads = [
      { title: "SzakiPiac-2025.hu", sub: "Hirdess, találj, dolgozz!", url: "#feltoltes", img: "https://raw.githubusercontent.com/Atika76/szakipiac-2025/main/szakipiac-reklam.png", bg: "from-yellow-300 to-orange-400", text: "text-slate-950" },
      { title: "Lidl", sub: "Akciók és ajánlatok", url: "https://www.lidl.hu/", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Lidl-Logo.svg/1200px-Lidl-Logo.svg.png", bg: "from-blue-700 to-yellow-300", text: "text-white" },
      { title: "PENNY", sub: "Heti ajánlatok", url: "https://www.penny.hu/", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Penny_logo.svg/1200px-Penny_logo.svg.png", bg: "from-red-600 to-yellow-300", text: "text-white" },
      { title: "ALDI", sub: "Aktuális ajánlatok", url: "https://www.aldi.hu/", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Aldi_S%C3%BCd_logo.svg/1200px-Aldi_S%C3%BCd_logo.svg.png", bg: "from-blue-900 to-orange-400", text: "text-white" },
      { title: "eMAG", sub: "Online ajánlatok", url: "https://www.emag.hu/", img: "https://upload.wikimedia.org/wikipedia/commons/a/af/Logo_eMAG_%282019%29.svg", bg: "from-red-500 to-blue-600", text: "text-white" },
      { title: "Alza", sub: "Elektronika és eszközök", url: "https://www.alza.hu/", img: "https://upload.wikimedia.org/wikipedia/commons/1/1f/Alza.cz_logo.svg", bg: "from-lime-500 to-emerald-700", text: "text-white" }
    ];
    let i = 0;
    function render() {
      const ad = ads[i];
      slider.innerHTML = `
        <a href="${esc(ad.url)}" target="${ad.url.startsWith("#") ? "_self" : "_blank"}" rel="noopener" class="block h-full w-full flex flex-col items-center justify-center bg-gradient-to-br ${ad.bg} ${ad.text}">
          <div class="h-full w-full flex flex-col items-center justify-center p-5 text-center">
            <div class="bg-white/90 rounded-2xl shadow-sm border border-white/60 w-full h-36 flex items-center justify-center p-4">
              <img src="${esc(ad.img)}" class="max-h-full max-w-full object-contain" alt="${esc(ad.title)} partner ajánlat" loading="lazy" decoding="async" onerror="this.style.display='none'; this.closest('div').innerHTML='<div class=\\'text-3xl font-black text-slate-900\\'>${esc(ad.title)}</div>'">
            </div>
            <div class="mt-4 text-xl font-black drop-shadow-sm">${esc(ad.title)}</div>
            <div class="text-sm font-bold opacity-95">${esc(ad.sub)}</div>
          </div>
        </a>
        <button type="button" data-sp-partner-prev aria-label="Előző partner ajánlat" class="absolute top-1/2 left-2 -translate-y-1/2 bg-white bg-opacity-80 p-2 rounded-full shadow hover:bg-opacity-100 z-10">❮</button>
        <button type="button" data-sp-partner-next aria-label="Következő partner ajánlat" class="absolute top-1/2 right-2 -translate-y-1/2 bg-white bg-opacity-80 p-2 rounded-full shadow hover:bg-opacity-100 z-10">❯</button>`;
      slider.querySelector("[data-sp-partner-prev]")?.addEventListener("click", () => { i = (i - 1 + ads.length) % ads.length; render(); });
      slider.querySelector("[data-sp-partner-next]")?.addEventListener("click", () => { i = (i + 1) % ads.length; render(); });
    }
    render();
    setInterval(() => { i = (i + 1) % ads.length; render(); }, 5000);
  }

  function runPatch() {
    patchPartnerCards();
    patchFeltoltesPage();
  }

  const observer = new MutationObserver(runPatch);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", runPatch);
  else runPatch();
})();

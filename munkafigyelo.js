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
    kozbeszerzes: "Közbeszerzés"
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
    const canContact = lead.forras_tipus === "megrendelo" && lead.kapcsolat_elerheto;
    return `<article class="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 hover:shadow-md transition" data-lead-id="${esc(lead.id)}">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap gap-2 mb-2">
            <span class="inline-flex border rounded-full px-3 py-1 text-xs font-black ${typeBadge(lead.forras_tipus)}">${typeLabel(lead.forras_tipus)}</span>
            <span class="inline-flex bg-slate-100 text-slate-700 rounded-full px-3 py-1 text-xs font-black">${esc(lead.szakma)}</span>
            <span class="inline-flex bg-orange-50 text-orange-700 rounded-full px-3 py-1 text-xs font-black">${urgencyLabel(lead.surgosseg)}</span>
          </div>
          <h3 class="text-xl font-black text-slate-900 leading-tight">${esc(lead.cim)}</h3>
          <p class="text-sm text-slate-500 mt-1">📍 ${esc([lead.iranyitoszam, lead.telepules, lead.megye].filter(Boolean).join(" "))} · ${formatDate(lead.created_at)}</p>
        </div>
        <button type="button" data-save-lead="${esc(lead.id)}" class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-black hover:bg-slate-50">${saved ? "★ Mentve" : "☆ Mentés"}</button>
      </div>
      <p class="text-slate-700 mt-4 whitespace-pre-line line-clamp-4">${esc(lead.leiras)}</p>
      <div class="grid grid-cols-1 2xl:grid-cols-3 gap-3 mt-4 text-sm">
        <div class="rounded-xl bg-slate-50 p-3"><b>Keret:</b><br>${esc(budgetText(lead))}</div>
        <div class="rounded-xl bg-slate-50 p-3"><b>Kezdés:</b><br>${esc(formatDate(lead.kezdes_datum))}</div>
        <div class="rounded-xl bg-slate-50 p-3"><b>Forrás:</b><br>${esc(typeLabel(lead.forras_tipus))}</div>
      </div>
      <div class="flex flex-wrap gap-3 mt-5">
        ${lead.forras_url ? `<a href="${esc(lead.forras_url)}" target="_blank" rel="noopener noreferrer" class="bg-emerald-700 text-white rounded-xl px-4 py-2.5 font-black hover:bg-emerald-800">Eredeti hirdetés megnyitása</a>` : ""}
        ${canContact ? `<button type="button" data-contact-lead="${esc(lead.id)}" class="bg-blue-700 text-white rounded-xl px-4 py-2.5 font-black hover:bg-blue-800">Kapcsolatfelvétel</button>` : ""}
        <button type="button" data-details-lead="${esc(lead.id)}" class="border border-slate-300 rounded-xl px-4 py-2.5 font-black hover:bg-slate-50">Részletek</button>
      </div>
    </article>`;
  }

  function renderList() {
    const list = root?.querySelector("[data-mf-list]");
    const leads = filteredLeads();
    if (!list) return;
    root.querySelector("[data-mf-count]").textContent = `${leads.length} találat`;
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

  function wireListButtons() {
    root.querySelectorAll("[data-save-lead]").forEach(button => button.addEventListener("click", () => {
      const ids = savedIds();
      const id = button.dataset.saveLead;
      if (ids.has(id)) ids.delete(id); else ids.add(id);
      saveIds(ids);
      renderList();
    }));

    root.querySelectorAll("[data-details-lead]").forEach(button => button.addEventListener("click", () => {
      const lead = allLeads.find(item => item.id === button.dataset.detailsLead);
      if (lead) alert(`${lead.cim}\n\n${lead.leiras}\n\nHely: ${lead.telepules} ${lead.megye}\nForrás: ${typeLabel(lead.forras_tipus)}`);
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

      <div class="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        <div>
          <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm mb-4">
            <div class="flex flex-wrap gap-2 mb-4">
              <button type="button" data-mf-type="all">Friss munkák</button>
              <button type="button" data-mf-type="megrendelo">Megrendelői munkák</button>
              <button type="button" data-mf-type="nyilvanos_forras">Nyilvános források</button>
              <button type="button" data-mf-type="kozbeszerzes">Közbeszerzések</button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input data-mf-search placeholder="Keresés: burkoló, tető, felújítás..." class="md:col-span-2 rounded-xl border border-slate-300 p-3">
              <select data-mf-szakma class="rounded-xl border border-slate-300 p-3">${optionList(SZAKMAK, "Minden szakma")}</select>
              <select data-mf-megye class="rounded-xl border border-slate-300 p-3">${optionList(MEGYEK, "Minden megye")}</select>
            </div>
            <div class="mt-3 text-sm font-black text-slate-600" data-mf-count></div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4" data-mf-list></div>
        </div>

        <aside class="space-y-4">
          <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h2 class="text-xl font-black mb-2">Értesítéseim</h2>
            <p class="text-sm text-slate-600 mb-4">Kérj értesítést a neked megfelelő új külső munkákról és közbeszerzésekről.</p>
            <label class="block text-sm font-bold mb-1" for="mf-push-szakma">Szakma</label>
            <select id="mf-push-szakma" data-push-szakma class="w-full rounded-xl border border-slate-300 p-3 mb-3">${optionList(SZAKMAK, "Minden szakma")}</select>
            <label class="block text-sm font-bold mb-1" for="mf-push-megye">Megye</label>
            <select id="mf-push-megye" data-push-megye class="w-full rounded-xl border border-slate-300 p-3 mb-3">${optionList(MEGYEK, "Minden megye")}</select>
            <label class="block text-sm font-bold mb-1" for="mf-push-surgosseg">Sürgősség</label>
            <select id="mf-push-surgosseg" data-push-surgosseg class="w-full rounded-xl border border-slate-300 p-3 mb-4">${urgencyOptions()}</select>
            <button type="button" data-enable-push class="w-full bg-emerald-700 text-white rounded-xl px-4 py-3 font-black hover:bg-emerald-800">Értesítést kérek</button>
            <button type="button" data-disable-push class="w-full mt-2 border border-slate-300 rounded-xl px-4 py-3 font-black hover:bg-slate-50">Értesítés kikapcsolása</button>
            <div data-push-status class="hidden mt-3 rounded-xl border p-3 text-sm font-bold"></div>
          </div>
          <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h2 class="text-xl font-black mb-2">Mentett munkák</h2>
            <p class="text-sm text-slate-600 mb-3">A csillaggal mentett találatok ezen az eszközön maradnak.</p>
            <button type="button" data-show-saved class="w-full border border-slate-300 rounded-xl px-4 py-3 font-black hover:bg-slate-50">Mentettek mutatása</button>
          </div>
        </aside>
      </div>
    </section>`;
  }

  function pushStatus(message, isError = false) {
    const box = root.querySelector("[data-push-status]");
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
    root.querySelector("[data-mf-search]")?.addEventListener("input", renderList);
    root.querySelector("[data-mf-szakma]")?.addEventListener("change", renderList);
    root.querySelector("[data-mf-megye]")?.addEventListener("change", renderList);
    root.querySelector("[data-show-saved]")?.addEventListener("click", () => {
      const saved = allLeads.filter(item => savedIds().has(item.id));
      root.querySelector("[data-mf-list]").innerHTML = saved.length ? saved.map(card).join("") : `<div class="md:col-span-2 bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500 font-bold">Még nincs mentett munka.</div>`;
      root.querySelector("[data-mf-count]").textContent = `${saved.length} mentett találat`;
      wireListButtons();
    });
    root.querySelector("[data-enable-push]")?.addEventListener("click", enablePush);
    root.querySelector("[data-disable-push]")?.addEventListener("click", disablePush);
    setType("all");
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

(function () {
  "use strict";

  const materialTypes = {
    burkolas: { name: "Burkolás", labels: ["Burkolandó felület (m²)", "Vágási veszteség (%)", "Ragasztóigény (kg/m²)"], defaults: [20, 10, 4.5] },
    festes: { name: "Festés", labels: ["Festendő felület (m²)", "Rétegek száma", "Festék kiadóssága (m²/liter/réteg)"], defaults: [100, 2, 10] },
    beton: { name: "Beton", labels: ["Hossz (m)", "Szélesség (m)", "Vastagság (cm)"], defaults: [5, 4, 20] },
    falazas: { name: "Falazás", labels: ["Falfelület (m²)", "Elemigény (db/m²)", "Tartalék (%)"], defaults: [30, 10, 5] },
    gipszkarton: { name: "Gipszkarton", labels: ["Felület (m²)", "Rétegek száma", "Tartalék (%)"], defaults: [40, 1, 10] },
    szigeteles: { name: "Szigetelés", labels: ["Szigetelendő felület (m²)", "Tartalék (%)", "Csomag fedése (m²)"], defaults: [100, 7, 5] },
    laminalt: { name: "Laminált padló", labels: ["Padlófelület (m²)", "Vágási veszteség (%)", "Szegélyhossz (fm)"], defaults: [50, 8, 32] },
    vakolat: { name: "Vakolás", labels: ["Vakolandó felület (m²)", "Átlagos vastagság (mm)", "Anyagigény (kg/m²/mm)"], defaults: [80, 10, 1.4] }
  };

  const documentTypes = {
    vallalkozasi: "Vállalkozási szerződés",
    kivitelezesi: "Kivitelezési szerződés",
    felujitasi: "Felújítási szerződés",
    eloleg: "Előlegátvételi igazolás",
    teljesitesi: "Teljesítési igazolás",
    munkaterulet: "Munkaterület-átadási dokumentum"
  };

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  const num = value => Number(String(value ?? "0").replace(",", ".")) || 0;
  const fmt = value => `${Math.round(num(value)).toLocaleString("hu-HU")} Ft`;
  const dateHu = value => value ? new Date(value).toLocaleDateString("hu-HU") : "Nincs lejárat";
  const byId = id => document.getElementById(id);

  function calculateMaterial(type, a, b, c) {
    const first = Math.max(0, num(a));
    const second = Math.max(0, num(b));
    const third = Math.max(0, num(c));
    if (type === "burkolas") {
      const ordered = first * (1 + second / 100);
      return [["Burkolólap", ordered, "m²"], ["Ragasztó", first * third, "kg"], ["Fugázó (tájékoztató)", first * 0.35, "kg"]];
    }
    if (type === "festes") {
      const paint = third > 0 ? first * second / third * 1.05 : 0;
      return [["Festék", paint, "liter"], ["Alapozó", first * 0.1, "liter"], ["Glett (teljes glettelésnél)", first, "kg"]];
    }
    if (type === "beton") {
      const volume = first * second * (third / 100);
      return [["Nettó betontérfogat", volume, "m³"], ["Rendelendő beton 5% tartalékkal", volume * 1.05, "m³"]];
    }
    if (type === "falazas") {
      return [["Falazóelem", first * second * (1 + third / 100), "db"], ["Falazóhabarcs (tájékoztató)", first * 20, "kg"]];
    }
    if (type === "gipszkarton") {
      const boardArea = first * second * (1 + third / 100);
      return [["Gipszkarton lapfelület", boardArea, "m²"], ["Normál 120×240 cm lap", boardArea / 2.88, "db"], ["Csavar (tájékoztató)", first * second * 20, "db"]];
    }
    if (type === "szigeteles") {
      const area = first * (1 + second / 100);
      return [["Szigetelőanyag", area, "m²"], ["Csomag", third > 0 ? Math.ceil(area / third) : 0, "csomag"]];
    }
    if (type === "laminalt") {
      return [["Laminált padló", first * (1 + second / 100), "m²"], ["Alátét", first * 1.05, "m²"], ["Szegélyléc", third * 1.05, "fm"]];
    }
    return [["Vakolóanyag", first * second * third, "kg"], ["25 kg-os zsák", Math.ceil(first * second * third / 25), "zsák"]];
  }

  function documentHtml(values) {
    const typeName = documentTypes[values.type] || "Dokumentum";
    const template = {
      eloleg: {
        intro: "A Vállalkozó igazolja, a Megrendelő pedig tudomásul veszi az alább rögzített előleg átadását és átvételét.",
        section: "3. Átvett előleg és átvétel napja",
        amount: "Átvett előleg",
        deadline: "Átvétel napja"
      },
      teljesitesi: {
        intro: "A felek rögzítik, hogy az alább felsorolt munkák teljesítését közösen megvizsgálták, és az észrevételeket ebben a dokumentumban feltüntették.",
        section: "3. Teljesítés adatai",
        amount: "Igazolt teljesítés értéke",
        deadline: "Teljesítés napja"
      },
      munkaterulet: {
        intro: "A felek rögzítik a munkaterület átadásának és átvételének tényét, helyét, időpontját és ismert körülményeit.",
        section: "3. Átadás adatai",
        amount: null,
        deadline: "Munkaterület átadásának napja"
      }
    }[values.type] || {
      intro: "A Megrendelő megrendeli, a Vállalkozó pedig elvállalja az alábbi munkák elvégzését a jelen dokumentumban rögzített feltételekkel.",
      section: "3. Vállalkozói díj és határidő",
      amount: "Vállalkozói díj",
      deadline: "Teljesítési határidő"
    };
    return `
      <article class="mx-auto max-w-4xl bg-white p-8 text-slate-900" id="sp360-document-print">
        <h1 class="text-center text-2xl font-black uppercase">${esc(typeName)}</h1>
        <p class="mt-6">${template.intro}</p>
        <h2 class="mt-6 text-lg font-black">1. Felek</h2>
        <p><b>Vállalkozó:</b> ${esc(values.contractor || "—")}</p>
        <p><b>Megrendelő:</b> ${esc(values.client || "—")}</p>
        <h2 class="mt-6 text-lg font-black">2. Munka és helyszín</h2>
        <p><b>Projekt:</b> ${esc(values.project || "—")}</p>
        <p><b>Helyszín:</b> ${esc(values.location || "—")}</p>
        <p class="mt-2 whitespace-pre-line">${esc(values.scope || "—")}</p>
        <h2 class="mt-6 text-lg font-black">${template.section}</h2>
        ${template.amount ? `<p><b>${template.amount}:</b> ${esc(values.amount || "—")}</p>` : ""}
        <p><b>${template.deadline}:</b> ${esc(values.deadline || "—")}</p>
        <h2 class="mt-6 text-lg font-black">4. Megjegyzések</h2>
        <p class="whitespace-pre-line">${esc(values.notes || "Nincs külön megjegyzés.")}</p>
        <div class="mt-16 grid grid-cols-2 gap-12 text-center"><div class="border-t border-slate-500 pt-2">Vállalkozó</div><div class="border-t border-slate-500 pt-2">Megrendelő</div></div>
        <p class="mt-12 border-t pt-4 text-xs text-slate-500"><b>Fontos:</b> Ez szerkeszthető dokumentumminta, nem minősül jogi tanácsadásnak. Aláírás előtt a felek ellenőrizzék, és szükség esetén jogi szakemberrel vizsgáltassák felül.</p>
      </article>`;
  }

  async function render(container, options) {
    const client = options.client;
    const session = options.session;
    const toast = options.showToast || (() => {});
    const adminEmail = String(options.adminEmail || "").toLowerCase();
    const isAdmin = String(session?.user?.email || "").toLowerCase() === adminEmail;
    let entitlement = null;
    let usage = 0;
    let workspace = [];
    let workspaceCount = 0;
    let payments = [];
    let paypalConfigured = false;
    let welcomeGranted = false;

    if (session) {
      const welcomeResult = await client.rpc("szakipiac_360_claim_welcome");
      welcomeGranted = welcomeResult.data?.granted === true;
      const [entRes, usageRes, workRes, paymentRes, paypalRes] = await Promise.all([
        client.from("szakipiac_360_entitlements").select("plan,expires_at,source").eq("user_id", session.user.id).maybeSingle(),
        client.from("szakipiac_360_ai_usage").select("request_count").eq("user_id", session.user.id).eq("usage_date", new Date().toISOString().slice(0, 10)).maybeSingle(),
        client.from("szakipiac_360_workspace_items").select("id,item_type,title,source_type,source_id,payload,created_at").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(30),
        client.from("szakipiac_360_payments").select("id,product_code,amount,currency,status,created_at,completed_at").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(10),
        client.functions.invoke("paypal-order", { body: { action: "status" } })
      ]);
      entitlement = entRes.data || null;
      usage = Number(usageRes.data?.request_count || 0);
      workspace = workRes.data || [];
      payments = paymentRes.data || [];
      const workspaceCountResult = await client.from("szakipiac_360_workspace_items").select("id", { count: "exact", head: true }).eq("user_id", session.user.id);
      workspaceCount = Number(workspaceCountResult.count || 0);
      paypalConfigured = paypalRes.data?.configured === true;
    }

    const entitlementActive = Boolean(entitlement) && ["basic", "pro"].includes(entitlement?.plan) && (!entitlement.expires_at || new Date(entitlement.expires_at).getTime() >= Date.now());
    const activePlan = isAdmin ? "admin" : entitlementActive ? entitlement.plan : "free";
    const active360 = activePlan !== "free";
    const activePro = ["pro", "admin"].includes(activePlan);
    const planLabel = activePlan === "admin" ? "Admin" : activePlan === "pro" ? "360 PRO" : activePlan === "basic" ? "360 Alap" : "Ingyenes";
    const aiLimit = activePlan === "admin" ? "∞" : activePlan === "pro" ? 20 : activePlan === "basic" ? 10 : 3;
    const saveLimit = activePlan === "admin" || activePlan === "pro" ? "korlátlan" : activePlan === "basic" ? 30 : 3;
    const daysLeft = entitlement?.expires_at ? Math.ceil((new Date(entitlement.expires_at).getTime() - Date.now()) / 86400000) : null;
    const countTable = async table => {
      if (!session) return 0;
      const { count } = await client.from(table).select("id", { count: "exact", head: true }).eq("user_id", session.user.id);
      return Number(count || 0);
    };
    const [adCount, quoteCount, projectCount, inquiryCount] = session ? await Promise.all([
      countTable("hirdetesek"),
      countTable("ajanlatok"),
      countTable("kivitelezes_projektek"),
      client.from("szakember_messages").select("id", { count: "exact", head: true }).eq("to_user_id", session.user.id).eq("is_read", false).then(result => Number(result.count || 0))
    ]) : [0, 0, 0, 0];

    container.innerHTML = `
      <section class="rounded-3xl border border-indigo-200 bg-white p-5 shadow-sm md:p-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 class="text-2xl font-black text-slate-950">Saját 360 irányítópult</h2><p class="mt-1 text-slate-600">Ugyanazokat az ajánlatokat, projekteket és hirdetéseket mutatja, amelyeket a meglévő SzakiPiac modulokban mentettél.</p></div>
          <div class="rounded-2xl ${active360 ? "bg-emerald-100 text-emerald-950" : "bg-slate-100 text-slate-800"} px-5 py-3"><div class="text-xs font-black uppercase">Csomag</div><div class="text-xl font-black">${planLabel}</div><div class="text-xs">${isAdmin ? "Korlátlan adminisztrátori hozzáférés" : entitlement?.expires_at && entitlementActive ? `Lejárat: ${dateHu(entitlement.expires_at)}` : "Az ingyenes csomag nem jár le"}</div></div>
        </div>
        ${!session ? `<div class="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950"><b>Az irányítópult megtekinthető, használatához jelentkezz be.</b> <a class="font-black underline" href="#auth">Regisztráció / Belépés</a></div>` : ""}
        ${welcomeGranted ? `<div class="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950"><b>Ajándék 360 PRO hozzáférés aktiválva!</b> Az első 15 felhasználó egyikeként 30 napot kaptál.</div>` : ""}
        ${active360 && daysLeft !== null && daysLeft <= 7 ? `<div class="mt-5 rounded-2xl border border-orange-300 bg-orange-50 p-4 text-orange-950"><b>A 360 hozzáférésed ${Math.max(daysLeft, 0)} napon belül lejár.</b> Hosszabbítsd meg, hogy a mentéseid és a magasabb AI-keret megmaradjon.</div>` : ""}
        ${!active360 && entitlement?.expires_at ? `<div class="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900"><b>A 360 hozzáférésed lejárt.</b> A korábbi mentéseid megmaradtak és olvashatók; újraaktiválás után ismét korlátlanul menthetsz.</div>` : ""}
        <div class="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          ${[["Hirdetések",adCount],["Árajánlatok",quoteCount],["Projektek",projectCount],["Új érdeklődések",inquiryCount],["360 mentések",`${workspaceCount}/${saveLimit}`],["Gemini ma",`${usage}/${aiLimit}`]].map(([label,value])=>`<div class="rounded-2xl border bg-slate-50 p-4"><div class="text-xs font-bold text-slate-500">${label}</div><div class="mt-1 text-2xl font-black text-slate-950">${value}</div></div>`).join("")}
        </div>
        <div class="mt-5 flex flex-wrap gap-2" role="tablist">
          ${[["overview","Áttekintés"],["material","Anyagszámoló"],["profit",`${activePro ? "" : "🔒 "}Profitkalkulátor`],["documents",`${activePro ? "" : "🔒 "}Dokumentumok`]].map(([id,label],index)=>`<button type="button" data-sp360-tab="${id}" class="rounded-xl px-4 py-2 font-black ${index===0?"bg-indigo-700 text-white":"bg-slate-100 text-slate-700"}">${label}</button>`).join("")}
        </div>
        <div id="sp360-tab-content" class="mt-5"></div>
      </section>`;

    const tabContent = byId("sp360-tab-content");
    const lockToolIfGuest = () => {
      if (session) return;
      tabContent.querySelectorAll("input,select,textarea,button").forEach(element => {
        element.disabled = true;
        element.title = "A használathoz regisztráció vagy bejelentkezés szükséges.";
      });
    };
    const saveItem = async (itemType, title, payload, sourceType = null, sourceId = null) => {
      if (!session) return toast("Mentéshez jelentkezz be.", "error");
      const { error } = await client.rpc("szakipiac_360_save_workspace_item", { p_item_type: itemType, p_title: title, p_payload: payload, p_source_type: sourceType, p_source_id: sourceId });
      if (error) return toast(error.message, "error");
      toast("Mentés kész.", "success");
      const refreshed = await client.from("szakipiac_360_workspace_items").select("id,item_type,title,source_type,source_id,payload,created_at").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(30);
      workspace = refreshed.data || workspace;
      const countResult = await client.from("szakipiac_360_workspace_items").select("id", { count: "exact", head: true }).eq("user_id", session.user.id);
      workspaceCount = Number(countResult.count || workspaceCount);
    };

    const renderOverview = () => {
      const paymentLabel = code => ({
        plan_360_basic_30d: "360 Alap – 30 nap",
        plan_360_pro_30d: "360 PRO – 30 nap",
        plan_360_30d: "Korábbi 360 – 30 nap",
        ad_premium: "Prémium hirdetés",
        ad_extra: "Extra hirdetés"
      }[code] || code);
      tabContent.innerHTML = `
        <div class="grid gap-4 lg:grid-cols-2">
          <div class="rounded-2xl border border-slate-200 p-5"><h3 class="text-lg font-black">Meglévő munkáid</h3><div class="mt-4 grid gap-2"><a href="kalkulator.html" class="rounded-xl bg-orange-50 p-3 font-bold text-orange-900">${quoteCount} mentett árajánlat megnyitása</a><a href="kivitelezes-pro.html" class="rounded-xl bg-emerald-50 p-3 font-bold text-emerald-900">${projectCount} KivitelezésPRO projekt megnyitása</a><a href="#feltoltes" class="rounded-xl bg-blue-50 p-3 font-bold text-blue-900">${adCount} hirdetés kezelése</a><a href="uzenetek.html" class="rounded-xl bg-violet-50 p-3 font-bold text-violet-900">${inquiryCount} új érdeklődés / üzenet megnyitása</a></div></div>
          <div class="rounded-2xl border border-slate-200 p-5"><h3 class="text-lg font-black">Jelenlegi hozzáférés</h3><p class="mt-2 text-sm text-slate-600"><b>${planLabel}</b>${isAdmin ? " – nincs lejárat és nincs fizetési kötelezettség." : active360 ? ` – aktív eddig: ${dateHu(entitlement?.expires_at)}.` : " – örök ingyenes csomag, nem jár le."}</p><div class="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><b>Egy közös fizetési felület:</b> PayPal és – jogosultságtól függően – bankkártya. A Prémium és Extra hirdetéskiemelés változatlanul megmarad.</div></div>
        </div>
        ${isAdmin ? "" : `<div class="mt-4 grid gap-4 lg:grid-cols-3">
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-5"><h3 class="text-xl font-black">Ingyenes</h3><div class="mt-2 text-3xl font-black">0 Ft</div><p class="mt-3 text-sm text-slate-600">Nem jár le · napi 3 Gemini · 3 mentés · alap anyagszámítás.</p></div>
          <div class="rounded-2xl border border-indigo-200 bg-indigo-50 p-5"><h3 class="text-xl font-black text-indigo-950">360 Alap</h3><div class="mt-2 text-3xl font-black text-indigo-950">1 990 Ft <span class="text-sm">/ 30 nap</span></div><p class="mt-3 text-sm text-indigo-900">Napi 10 Gemini · 30 mentés · anyagszámoló · árajánlat-mentés és PDF.</p><div id="sp360-basic-buttons" class="mt-4">${!session ? "Jelentkezz be a vásárláshoz." : !paypalConfigured ? "" : ""}</div></div>
          <div class="rounded-2xl border border-emerald-300 bg-emerald-50 p-5"><h3 class="text-xl font-black text-emerald-950">360 PRO</h3><div class="mt-2 text-3xl font-black text-emerald-950">4 990 Ft <span class="text-sm">/ 30 nap</span></div><p class="mt-3 text-sm text-emerald-900">Napi 20 Gemini · korlátlan mentés · profitkalkulátor · dokumentumok · teljes 360 eszköztár.</p><div id="sp360-pro-buttons" class="mt-4">${!session ? "Jelentkezz be a vásárláshoz." : ""}</div></div>
        </div>`}
        <div class="mt-4 grid gap-4 lg:grid-cols-2"><div class="rounded-2xl border border-slate-200 p-5"><div class="flex items-center justify-between gap-3"><h3 class="text-lg font-black">Legutóbbi 360 mentések</h3><span class="text-xs text-slate-500">A kereted: ${saveLimit}</span></div><div class="mt-3 space-y-2">${workspace.length ? workspace.slice(0,8).map(item=>`<div class="flex items-center justify-between rounded-xl bg-slate-50 p-3"><div><b>${esc(item.title)}</b><div class="text-xs text-slate-500">${esc(item.item_type)} · ${new Date(item.created_at).toLocaleString("hu-HU")}</div></div><button type="button" data-delete-workspace="${item.id}" class="text-sm font-bold text-red-600">Törlés</button></div>`).join("") : `<div class="text-sm text-slate-500">Még nincs külön 360 mentésed.</div>`}</div></div><div class="rounded-2xl border border-slate-200 p-5"><h3 class="text-lg font-black">Fizetési előzmények</h3><div class="mt-3 space-y-2">${payments.length ? payments.map(payment=>`<div class="rounded-xl bg-slate-50 p-3"><div class="flex justify-between gap-3"><b>${esc(paymentLabel(payment.product_code))}</b><span class="font-black">${num(payment.amount).toLocaleString("hu-HU")} ${esc(payment.currency)}</span></div><div class="mt-1 text-xs text-slate-500">${new Date(payment.created_at).toLocaleString("hu-HU")} · ${payment.status === "completed" ? "Sikeres" : payment.status === "pending" ? "Folyamatban" : "Sikertelen"}</div></div>`).join("") : `<div class="text-sm text-slate-500">Még nincs 360 fizetési előzményed.</div>`}</div></div></div>`;
      const renderPaymentButton = (productCode, selector, successText) => {
        if (!session || !paypalConfigured || !window.paypal || !document.querySelector(selector)) return;
        window.paypal.Buttons({
          style: { layout: "vertical", shape: "rect", label: "pay" },
          createOrder: async () => {
            const { data, error } = await client.functions.invoke("paypal-order", { body: { action: "create", product_code: productCode } });
            if (error || !data?.order_id) throw new Error(data?.error || error?.message || "A PayPal-rendelés nem indult el.");
            return data.order_id;
          },
          onApprove: async data => {
            const result = await client.functions.invoke("paypal-order", { body: { action: "capture", order_id: data.orderID } });
            if (result.error || !result.data?.verified) return toast(result.data?.error || result.error?.message || "A fizetés ellenőrzése nem sikerült.", "error");
            toast(successText, "success");
            await render(container, options);
          },
          onError: error => toast(error?.message || "PayPal-hiba történt.", "error")
        }).render(selector);
      };
      if (activePlan !== "pro") renderPaymentButton("plan_360_basic_30d", "#sp360-basic-buttons", "A 360 Alap csomag automatikusan aktiválva.");
      renderPaymentButton("plan_360_pro_30d", "#sp360-pro-buttons", "A 360 PRO csomag automatikusan aktiválva.");
      tabContent.querySelectorAll("[data-delete-workspace]").forEach(button => button.addEventListener("click", async () => {
        if (!confirm("Biztosan törlöd ezt a 360 mentést?")) return;
        const { error } = await client.from("szakipiac_360_workspace_items").delete().eq("id", button.dataset.deleteWorkspace);
        if (error) return toast(error.message, "error");
        workspace = workspace.filter(item => item.id !== button.dataset.deleteWorkspace);
        renderOverview();
      }));
    };

    const renderMaterial = () => {
      tabContent.innerHTML = `<div class="rounded-2xl border border-slate-200 p-5"><h3 class="text-xl font-black">Anyagszámoló</h3><p class="mt-1 text-sm text-slate-600">Saját képletekkel számol. Nem AI-becslés, az eredmény helyszíni adottságok és gyártói előírások alapján pontosítandó.</p><div class="mt-4 grid gap-3 md:grid-cols-4"><label class="font-bold">Munkatípus<select id="sp360-mat-type" class="mt-1 w-full rounded-xl border p-3">${Object.entries(materialTypes).map(([id,cfg])=>`<option value="${id}">${cfg.name}</option>`).join("")}</select></label>${[0,1,2].map(index=>`<label id="sp360-mat-label-${index}" class="font-bold"><span></span><input id="sp360-mat-${index}" type="number" min="0" step="0.01" class="mt-1 w-full rounded-xl border p-3"></label>`).join("")}</div><div class="mt-4 flex gap-2"><button id="sp360-mat-calc" class="rounded-xl bg-indigo-700 px-5 py-3 font-black text-white">Számítás</button><button id="sp360-mat-save" class="rounded-xl border border-indigo-300 px-5 py-3 font-black text-indigo-800" ${session?"":"disabled"}>Mentés</button></div><div id="sp360-mat-result" class="mt-4"></div></div>`;
      lockToolIfGuest();
      let result = [];
      const sync = () => {
        const cfg = materialTypes[byId("sp360-mat-type").value];
        cfg.labels.forEach((label,index)=>{ byId(`sp360-mat-label-${index}`).querySelector("span").textContent=label; byId(`sp360-mat-${index}`).value=cfg.defaults[index]; });
      };
      const calc = () => {
        const type=byId("sp360-mat-type").value;
        result=calculateMaterial(type,byId("sp360-mat-0").value,byId("sp360-mat-1").value,byId("sp360-mat-2").value);
        byId("sp360-mat-result").innerHTML=`<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">${result.map(([label,value,unit])=>`<div class="rounded-xl bg-emerald-50 p-4"><div class="text-xs font-bold text-emerald-700">${label}</div><div class="text-xl font-black text-emerald-950">${num(value).toLocaleString("hu-HU",{maximumFractionDigits:2})} ${unit}</div></div>`).join("")}</div>`;
      };
      byId("sp360-mat-type").addEventListener("change",()=>{sync();calc();}); byId("sp360-mat-calc").addEventListener("click",calc);
      byId("sp360-mat-save").addEventListener("click",()=>saveItem("material",`${materialTypes[byId("sp360-mat-type").value].name} anyagszámítás`,{type:byId("sp360-mat-type").value,inputs:[0,1,2].map(i=>num(byId(`sp360-mat-${i}`).value)),result}));
      sync();calc();
    };

    const renderProfit = () => {
      if (!activePro) {
        tabContent.innerHTML = `<div class="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-950"><h3 class="text-xl font-black">Profitkalkulátor – 360 PRO</h3><p class="mt-2">Ez a funkció a 360 PRO csomag része. Az oldal bemutatója megtekinthető, számítást és mentést PRO hozzáféréssel lehet végezni.</p><button type="button" data-back-to-plans class="mt-4 rounded-xl bg-emerald-700 px-5 py-3 font-black text-white">Csomagok megtekintése</button></div>`;
        tabContent.querySelector("[data-back-to-plans]")?.addEventListener("click", renderOverview);
        return;
      }
      const fields=[["revenue","Vállalási ár nettó"],["material","Anyagköltség"],["labor","Saját munkadíj / bérköltség"],["overhead","Rezsiköltség és kiszállás"],["subs","Alvállalkozók"],["tax","Adók és járulékok"],["target","Kívánt haszon (%)"]];
      tabContent.innerHTML=`<div class="rounded-2xl border border-slate-200 p-5"><h3 class="text-xl font-black">Profitkalkulátor</h3><p class="mt-1 text-sm text-slate-600">A mentett árajánlat profitmezőjét nem írja át; ez külön vállalkozói eredményelemzés ugyanazon költséglogika szerint.</p><div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">${fields.map(([id,label],i)=>`<label class="font-bold">${label}<input id="sp360-profit-${id}" type="number" min="0" step="1" value="${i===6?15:0}" class="mt-1 w-full rounded-xl border p-3"></label>`).join("")}</div><div class="mt-4 flex gap-2"><button id="sp360-profit-calc" class="rounded-xl bg-indigo-700 px-5 py-3 font-black text-white">Elemzés</button><button id="sp360-profit-save" class="rounded-xl border border-indigo-300 px-5 py-3 font-black text-indigo-800" ${session?"":"disabled"}>Mentés</button></div><div id="sp360-profit-result" class="mt-4"></div></div>`;
      lockToolIfGuest();
      let result={};
      const calc=()=>{const v=Object.fromEntries(fields.map(([id])=>[id,num(byId(`sp360-profit-${id}`).value)]));const costs=v.material+v.labor+v.overhead+v.subs+v.tax;const profit=v.revenue-costs;const margin=v.revenue>0?profit/v.revenue*100:0;const targetAmount=v.revenue*v.target/100;result={...v,costs,profit,margin,targetAmount,meetsTarget:profit>=targetAmount};byId("sp360-profit-result").innerHTML=`<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div class="rounded-xl bg-slate-100 p-4"><small>Összes költség</small><b class="block text-xl">${fmt(costs)}</b></div><div class="rounded-xl ${profit>=0?"bg-emerald-100":"bg-red-100"} p-4"><small>Várható eredmény</small><b class="block text-xl">${fmt(profit)}</b></div><div class="rounded-xl bg-blue-100 p-4"><small>Haszonkulcs</small><b class="block text-xl">${margin.toFixed(1)}%</b></div><div class="rounded-xl ${result.meetsTarget?"bg-emerald-100":"bg-orange-100"} p-4"><small>Cél</small><b class="block text-xl">${result.meetsTarget?"Teljesül":"Nem teljesül"}</b></div></div>`;};
      byId("sp360-profit-calc").addEventListener("click",calc);byId("sp360-profit-save").addEventListener("click",()=>saveItem("profit",`Profitelemzés ${new Date().toLocaleDateString("hu-HU")}`,result));calc();
    };

    const renderDocuments = () => {
      if (!activePro) {
        tabContent.innerHTML = `<div class="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-950"><h3 class="text-xl font-black">Dokumentumkészítő – 360 PRO</h3><p class="mt-2">Az ellenőrzött szerződés- és igazolásminták, a mentés és a PDF a 360 PRO csomag részei.</p><button type="button" data-back-to-plans class="mt-4 rounded-xl bg-emerald-700 px-5 py-3 font-black text-white">Csomagok megtekintése</button></div>`;
        tabContent.querySelector("[data-back-to-plans]")?.addEventListener("click", renderOverview);
        return;
      }
      tabContent.innerHTML=`<div class="rounded-2xl border border-slate-200 p-5"><h3 class="text-xl font-black">Ellenőrzött felépítésű dokumentumminták</h3><div class="mt-4 grid gap-3 md:grid-cols-2"><label class="font-bold">Dokumentum típusa<select id="sp360-doc-type" class="mt-1 w-full rounded-xl border p-3">${Object.entries(documentTypes).map(([id,label])=>`<option value="${id}">${label}</option>`).join("")}</select></label><label class="font-bold">Vállalkozó<input id="sp360-doc-contractor" class="mt-1 w-full rounded-xl border p-3"></label><label class="font-bold">Megrendelő<input id="sp360-doc-client" class="mt-1 w-full rounded-xl border p-3"></label><label class="font-bold">Projekt neve<input id="sp360-doc-project" class="mt-1 w-full rounded-xl border p-3"></label><label class="font-bold">Helyszín<input id="sp360-doc-location" class="mt-1 w-full rounded-xl border p-3"></label><label class="font-bold">Összeg<input id="sp360-doc-amount" class="mt-1 w-full rounded-xl border p-3" placeholder="Pl. 1 250 000 Ft + ÁFA"></label><label class="font-bold">Határidő<input id="sp360-doc-deadline" type="date" class="mt-1 w-full rounded-xl border p-3"></label><label class="font-bold md:col-span-2">Munka leírása<textarea id="sp360-doc-scope" rows="4" class="mt-1 w-full rounded-xl border p-3"></textarea></label><label class="font-bold md:col-span-2">Megjegyzések<textarea id="sp360-doc-notes" rows="3" class="mt-1 w-full rounded-xl border p-3"></textarea></label></div><div class="mt-4 flex flex-wrap gap-2"><button id="sp360-doc-generate" class="rounded-xl bg-indigo-700 px-5 py-3 font-black text-white">Dokumentum elkészítése</button><button id="sp360-doc-save" class="rounded-xl border border-indigo-300 px-5 py-3 font-black text-indigo-800" ${session?"":"disabled"}>Mentés</button><button id="sp360-doc-pdf" class="rounded-xl border border-slate-300 px-5 py-3 font-black">PDF</button></div><div id="sp360-doc-preview" class="mt-5 overflow-x-auto rounded-xl border bg-slate-50"></div></div>`;
      lockToolIfGuest();
      let values={};
      const generate=()=>{values={type:byId("sp360-doc-type").value,contractor:byId("sp360-doc-contractor").value,client:byId("sp360-doc-client").value,project:byId("sp360-doc-project").value,location:byId("sp360-doc-location").value,amount:byId("sp360-doc-amount").value,deadline:byId("sp360-doc-deadline").value,scope:byId("sp360-doc-scope").value,notes:byId("sp360-doc-notes").value};byId("sp360-doc-preview").innerHTML=documentHtml(values);};
      byId("sp360-doc-generate").addEventListener("click",generate);byId("sp360-doc-save").addEventListener("click",()=>{generate();saveItem("document",`${documentTypes[values.type]} - ${values.project||values.client||"dokumentum"}`,values);});byId("sp360-doc-pdf").addEventListener("click",()=>{generate();if(!window.html2pdf)return toast("A PDF-könyvtár nem töltődött be.","error");window.html2pdf().set({margin:10,filename:`${values.type}-${Date.now()}.pdf`,html2canvas:{scale:2},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"}}).from(byId("sp360-document-print")).save();});generate();
    };

    const tabs={overview:renderOverview,material:renderMaterial,profit:renderProfit,documents:renderDocuments};
    container.querySelectorAll("[data-sp360-tab]").forEach(button=>button.addEventListener("click",()=>{container.querySelectorAll("[data-sp360-tab]").forEach(item=>item.className="rounded-xl bg-slate-100 px-4 py-2 font-black text-slate-700");button.className="rounded-xl bg-indigo-700 px-4 py-2 font-black text-white";tabs[button.dataset.sp360Tab]();}));
    renderOverview();
  }

  window.SzakiPiac360Tools = { render };
})();

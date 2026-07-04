import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublic = Deno.env.get("MUNKAFIGYELO_VAPID_PUBLIC_KEY")!;
    const vapidPrivate = Deno.env.get("MUNKAFIGYELO_VAPID_PRIVATE_KEY")!;
    const authHeader = request.headers.get("Authorization") || "";

    if (!authHeader) return json({ error: "A push küldéséhez be kell jelentkezni." }, 401);
    if (!vapidPublic || !vapidPrivate) return json({ error: "Hiányzó szerverbeállítás." }, 500);

    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Érvénytelen bejelentkezés." }, 401);

    const { hirdetesId } = await request.json();
    if (!hirdetesId) return json({ error: "Hiányzó hirdetésazonosító." }, 400);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: job, error: jobError } = await admin
      .from("munkafigyelo_hirdetesek")
      .select("*")
      .eq("id", hirdetesId)
      .single();

    if (jobError || !job) return json({ error: "A munka nem található." }, 404);
    const isAdmin = (userData.user.email || "").toLowerCase() === "atika.76@windowslive.com";
    if (!isAdmin && job.owner_id !== userData.user.id) return json({ error: "Nincs jogosultság." }, 403);
    if (job.allapot !== "aktiv" || new Date(job.lejar_at) <= new Date()) return json({ error: "A munka nem aktív." }, 409);
    if (job.push_kuldve_at) return json({ ok: true, sent: 0, skipped: "already_sent" });

    const { data: subscriptions, error: subscriptionError } = await admin
      .from("munkafigyelo_push_feliratkozasok")
      .select("*")
      .eq("aktiv", true);
    if (subscriptionError) throw subscriptionError;

    const matches = (subscriptions || []).filter((sub) => {
      if (sub.user_id === job.owner_id) return false;
      const tradeOk = !sub.szakmak?.length || sub.szakmak.includes(job.szakma);
      const countyOk = !sub.megyek?.length || sub.megyek.includes(job.megye) || sub.megyek.includes("Országos");
      const urgencyOk = !sub.surgossegek?.length || sub.surgossegek.includes(job.surgosseg);
      return tradeOk && countyOk && urgencyOk;
    });

    webpush.setVapidDetails("mailto:atika.76@windowslive.com", vapidPublic, vapidPrivate);
    const payload = JSON.stringify({
      title: `Új ${job.szakma.toLowerCase()} munka`,
      body: `${job.telepules}, ${job.megye} – ${job.cim}`.slice(0, 180),
      url: `/index.html#munkafigyelo`,
      tag: `munkafigyelo-${job.id}`,
    });

    let sent = 0;
    let failed = 0;
    await Promise.all(matches.map(async (sub) => {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth_key },
        }, payload, { TTL: 3600 });
        sent += 1;
      } catch (error) {
        failed += 1;
        const statusCode = Number((error as { statusCode?: number }).statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("munkafigyelo_push_feliratkozasok").delete().eq("id", sub.id);
        }
        console.error("Push delivery failed", statusCode, String(error));
      }
    }));

    await admin.from("munkafigyelo_hirdetesek").update({ push_kuldve_at: new Date().toISOString() }).eq("id", job.id);
    return json({ ok: true, matched: matches.length, sent, failed });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Ismeretlen szerverhiba." }, 500);
  }
});

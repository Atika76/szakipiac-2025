import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublic = Deno.env.get("MUNKAFIGYELO_VAPID_PUBLIC_KEY") || Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("MUNKAFIGYELO_VAPID_PRIVATE_KEY") || Deno.env.get("VAPID_PRIVATE_KEY");
  const adminEmail = (Deno.env.get("SZAKIPIAC_ADMIN_EMAIL") || "atika.76@windowslive.com").toLowerCase();
  if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) return json({ error: "missing_server_configuration" }, 500);

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  const serviceRequest = token === serviceKey;
  if (!serviceRequest) {
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || serviceKey, {
      global: { headers: { Authorization: authorization } }
    });
    const { data, error } = await authClient.auth.getUser(token);
    if (error || data.user?.email?.toLowerCase() !== adminEmail) return json({ error: "forbidden" }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const hirdetesId = String(body.hirdetesId || "");
  if (!hirdetesId) return json({ error: "missing_hirdetesId" }, 400);

  webpush.setVapidDetails(
    Deno.env.get("MUNKAFIGYELO_VAPID_SUBJECT") || Deno.env.get("VAPID_SUBJECT") || "mailto:info@szakipiac-2025.hu",
    vapidPublic,
    vapidPrivate
  );

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: lead, error: leadError } = await supabase
    .from("munkafigyelo_hirdetesek")
    .select("id,cim,szakma,megye,telepules,surgosseg,forras_tipus,allapot")
    .eq("id", hirdetesId)
    .single();
  if (leadError || !lead || lead.allapot !== "aktiv") return json({ error: leadError?.message || "active_lead_not_found" }, 404);

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("munkafigyelo_push_feliratkozasok")
    .select("id,endpoint,p256dh,auth_key,szakmak,megyek,surgossegek")
    .eq("aktiv", true);
  if (subscriptionError) return json({ error: subscriptionError.message }, 500);

  const payload = JSON.stringify({
    title: lead.forras_tipus === "kozbeszerzes" ? "Új közbeszerzés érkezett" : "Új munka érkezett",
    body: `${lead.cim} – ${lead.telepules || lead.megye || "Országos"}`,
    url: "/index.html#munkafigyelo",
    tag: `munkafigyelo-${lead.id}`
  });

  let sent = 0;
  let failed = 0;
  for (const subscription of subscriptions || []) {
    const szakmak: string[] = subscription.szakmak || [];
    const megyek: string[] = subscription.megyek || [];
    const surgossegek: string[] = subscription.surgossegek || [];
    if (szakmak.length && !szakmak.includes(lead.szakma)) continue;
    if (megyek.length && !megyek.includes(lead.megye) && lead.megye !== "Országos") continue;
    if (surgossegek.length && !surgossegek.includes(lead.surgosseg)) continue;
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth_key }
      }, payload);
      sent++;
    } catch (error) {
      failed++;
      const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
      if ([404, 410].includes(statusCode)) {
        await supabase.from("munkafigyelo_push_feliratkozasok").update({ aktiv: false }).eq("id", subscription.id);
      }
    }
  }

  await supabase.from("munkafigyelo_hirdetesek")
    .update({ push_kuldve_at: new Date().toISOString() })
    .eq("id", hirdetesId);
  await supabase.from("munkafigyelo_ertesites_esemenyek")
    .update({ feldolgozva: true })
    .eq("hirdetes_id", hirdetesId);

  return json({ ok: true, sent, failed });
});

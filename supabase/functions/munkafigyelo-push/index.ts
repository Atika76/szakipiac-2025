// Supabase Edge Function: munkafigyelo-push
// Környezeti változók: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:info@szakipiac-2025.hu";
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const supabase = createClient(url, serviceKey);
  const body = await req.json().catch(() => ({}));
  const hirdetesId = body.hirdetesId;
  if (!hirdetesId) return new Response(JSON.stringify({ error: "missing hirdetesId" }), { status: 400, headers: corsHeaders });

  const { data: lead, error: leadError } = await supabase
    .from("munkafigyelo_hirdetesek")
    .select("id,cim,szakma,megye,telepules,forras_tipus")
    .eq("id", hirdetesId)
    .single();
  if (leadError || !lead) return new Response(JSON.stringify({ error: leadError?.message || "lead not found" }), { status: 404, headers: corsHeaders });

  const { data: subs, error: subError } = await supabase
    .from("munkafigyelo_push_feliratkozasok")
    .select("id,endpoint,p256dh,auth_key,szakmak,megyek,surgossegek")
    .eq("aktiv", true);
  if (subError) return new Response(JSON.stringify({ error: subError.message }), { status: 500, headers: corsHeaders });

  const title = lead.forras_tipus === "kozbeszerzes" ? "Új közbeszerzés érkezett" : "Új munka érkezett";
  const payload = JSON.stringify({
    title,
    body: `${lead.cim} – ${lead.telepules || lead.megye || "Országos"}`,
    url: "/index.html#munkafigyelo",
    tag: `munkafigyelo-${lead.id}`,
  });

  let sent = 0;
  for (const sub of subs || []) {
    const szakmak = sub.szakmak || [];
    const megyek = sub.megyek || [];
    if (szakmak.length && !szakmak.includes(lead.szakma)) continue;
    if (megyek.length && !megyek.includes(lead.megye) && lead.megye !== "Országos") continue;
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } }, payload);
      sent++;
    } catch (err) {
      if ([404, 410].includes(err?.statusCode)) await supabase.from("munkafigyelo_push_feliratkozasok").update({ aktiv: false }).eq("id", sub.id);
    }
  }

  await supabase.from("munkafigyelo_hirdetesek").update({ push_kuldve_at: new Date().toISOString() }).eq("id", hirdetesId);
  return new Response(JSON.stringify({ ok: true, sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

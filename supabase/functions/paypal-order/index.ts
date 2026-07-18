import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const products: Record<string, { amount: string; currency: string; description: string }> = {
  ad_premium: { amount: "990", currency: "HUF", description: "SzakiPiac 360 Prémium hirdetés" },
  ad_extra: { amount: "1990", currency: "HUF", description: "SzakiPiac 360 Extra hirdetés" },
  plan_360_30d: { amount: "3990", currency: "HUF", description: "SzakiPiac 360 - 30 napos hozzáférés" },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Csak POST kérés engedélyezett." }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ ok: false, error: "A fizetéshez jelentkezz be." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const paypalClientId = Deno.env.get("PAYPAL_CLIENT_ID") || "";
    const paypalSecret = Deno.env.get("PAYPAL_CLIENT_SECRET") || "";
    const paypalEnv = (Deno.env.get("PAYPAL_ENV") || "live").toLowerCase();
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: "Hiányzó Supabase-beállítás." }, 500);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "create");
    if (action === "status") return json({ ok: true, configured: Boolean(paypalClientId && paypalSecret) });
    if (!paypalClientId || !paypalSecret) return json({ ok: false, configured: false, error: "A szerveroldali PayPal-ellenőrzés még nincs aktiválva." }, 503);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ ok: false, error: "Érvénytelen bejelentkezés." }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const apiBase = paypalEnv === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
    const basic = btoa(`${paypalClientId}:${paypalSecret}`);
    const tokenResponse = await fetch(`${apiBase}/v1/oauth2/token`, {
      method: "POST",
      headers: { "Authorization": `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenData?.access_token) return json({ ok: false, error: "A PayPal-hitelesítés nem sikerült." }, 502);

    const accessToken = String(tokenData.access_token);

    if (action === "create") {
      const productCode = String(body?.product_code || "");
      const product = products[productCode];
      if (!product) return json({ ok: false, error: "Ismeretlen fizetési termék." }, 400);

      const orderResponse = await fetch(`${apiBase}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": crypto.randomUUID(),
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            reference_id: productCode,
            description: product.description,
            amount: { currency_code: product.currency, value: product.amount },
          }],
        }),
      });
      const order = await orderResponse.json().catch(() => ({}));
      if (!orderResponse.ok || !order?.id) return json({ ok: false, error: order?.message || "A PayPal-rendelés létrehozása nem sikerült." }, 502);

      const { error: insertError } = await admin.from("szakipiac_360_payments").insert({
        user_id: userData.user.id,
        provider: "paypal",
        provider_order_id: order.id,
        product_code: productCode,
        amount: Number(product.amount),
        currency: product.currency,
        status: "pending",
      });
      if (insertError) return json({ ok: false, error: "A fizetési napló mentése nem sikerült: " + insertError.message }, 500);
      return json({ ok: true, configured: true, order_id: order.id });
    }

    if (action === "capture") {
      const orderId = String(body?.order_id || "").trim();
      if (!orderId) return json({ ok: false, error: "Hiányzó PayPal-rendelésazonosító." }, 400);
      const { data: payment, error: paymentError } = await admin
        .from("szakipiac_360_payments")
        .select("*")
        .eq("provider_order_id", orderId)
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (paymentError || !payment) return json({ ok: false, error: "A fizetés nem található." }, 404);

      const captureResponse = await fetch(`${apiBase}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      });
      const capture = await captureResponse.json().catch(() => ({}));
      const capturedAmount = capture?.purchase_units?.[0]?.payments?.captures?.[0]?.amount;
      const valid = captureResponse.ok && capture?.status === "COMPLETED" &&
        String(capturedAmount?.currency_code || "") === String(payment.currency) &&
        Number(capturedAmount?.value || -1) === Number(payment.amount);
      await admin.from("szakipiac_360_payments").update({
        status: valid ? "completed" : "failed",
        provider_payload: capture,
        completed_at: valid ? new Date().toISOString() : null,
      }).eq("id", payment.id);
      if (!valid) return json({ ok: false, error: "A PayPal-fizetés ellenőrzése nem sikerült." }, 400);
      let accessExpiresAt: string | null = null;
      if (payment.product_code === "plan_360_30d") {
        const { data: current } = await admin
          .from("szakipiac_360_entitlements")
          .select("expires_at")
          .eq("user_id", userData.user.id)
          .maybeSingle();
        const currentMs = current?.expires_at ? new Date(current.expires_at).getTime() : 0;
        const baseMs = Math.max(Date.now(), Number.isFinite(currentMs) ? currentMs : 0);
        accessExpiresAt = new Date(baseMs + 30 * 24 * 60 * 60 * 1000).toISOString();
        const { error: accessError } = await admin.from("szakipiac_360_entitlements").upsert({
          user_id: userData.user.id,
          plan: "360",
          expires_at: accessExpiresAt,
          source: "paypal",
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        if (accessError) return json({ ok: false, error: "A fizetés megtörtént, de a 360 hozzáférés aktiválása hibát jelzett: " + accessError.message }, 500);
      }
      return json({ ok: true, verified: true, product_code: payment.product_code, access_expires_at: accessExpiresAt });
    }

    return json({ ok: false, error: "Ismeretlen fizetési művelet." }, 400);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

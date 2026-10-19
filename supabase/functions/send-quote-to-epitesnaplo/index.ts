import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://szakipiac-2025.hu",
  "https://www.szakipiac-2025.hu",
  "https://barthaattila.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://szakipiac-2025.hu",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

function safeText(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Csak POST kérés engedélyezett." }, 200);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json(req, { ok: false, error: "Az átküldéshez jelentkezz be." }, 200);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const endpoint = Deno.env.get("EPITESNAPLO_IMPORT_ENDPOINT") || "";
    const importSecret = Deno.env.get("EPITESNAPLO_IMPORT_SECRET") || "";
    const adminEmail = (Deno.env.get("SZAKIPIAC_ADMIN_EMAIL") || "atika.76@windowslive.com").toLowerCase();

    if (!supabaseUrl || !anonKey || !serviceKey || !endpoint || !importSecret) {
      return json(req, { ok: false, error: "Hiányzó Supabase vagy Építési Napló secret. Ellenőrizd: EPITESNAPLO_IMPORT_ENDPOINT és EPITESNAPLO_IMPORT_SECRET." }, 200);
    }

    const body = await req.json().catch(() => ({}));
    const quoteId = safeText(body.quote_id || body.quoteId || body.id || "", 100);
    const kivitelezesProjectId = safeText(body.kivitelezes_project_id || body.kivitelezesProjectId || body.kivitelezesId || "", 100);
    if (!quoteId && !kivitelezesProjectId) {
      return json(req, { ok: false, error: "Hiányzó ajánlat vagy KivitelezésPRO projekt azonosító." }, 200);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return json(req, { ok: false, error: "Érvénytelen SzakiPiac bejelentkezés." }, 200);
    }

    const userEmail = String(userData.user.email || "").toLowerCase();
    const admin = createClient(supabaseUrl, serviceKey);
    let importBody: Record<string, unknown> | null = null;
    const { data: sourceEntitlement } = await admin
      .from("szakipiac_360_entitlements")
      .select("plan,expires_at")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    const hasBundle = sourceEntitlement?.plan === "bundle"
      && (!sourceEntitlement.expires_at || new Date(sourceEntitlement.expires_at).getTime() >= Date.now());

    // The accepted quote RECORD is the version and canonical idempotency key.
    // Planning data never replaces its price, client, or quote items.
    let resolvedQuoteId = quoteId;
    let preparation: any = null;
    if (kivitelezesProjectId) {
      const { data: plan, error: planError } = await admin.from("kivitelezes_projektek")
        .select("*").eq("id", kivitelezesProjectId).maybeSingle();
      if (planError || !plan) return json(req, { ok: false, error: "Nem található a kivitelezési projekt." }, 404);
      if (plan.user_id !== userData.user.id && userEmail !== adminEmail) return json(req, { ok: false, error: "Nincs jogosultság a projekthez." }, 403);
      if (!plan.source_quote_id || (quoteId && quoteId !== plan.source_quote_id)) {
        return json(req, { ok: false, error: "Kapcsolj a projekthez egy elfogadott ajánlatot." }, 409);
      }
      resolvedQuoteId = plan.source_quote_id;
      preparation = { project_id: plan.id, phases: plan.payload?.phases || [], subs: plan.payload?.subs || [], checks: plan.payload?.checks || {} };
    }
    const { data: quote, error: quoteError } = await admin.from("ajanlatok").select("*").eq("id", resolvedQuoteId).maybeSingle();
    if (quoteError || !quote) return json(req, { ok: false, error: "Nem található az ajánlatverzió." }, 404);
    if (quote.user_id !== userData.user.id && userEmail !== adminEmail) return json(req, { ok: false, error: "Ezt az ajánlatot nem küldheted át." }, 403);
    if (quote.quote_status !== "accepted" || !quote.accepted_at) {
      return json(req, { ok: false, error: "Csak az ügyfél által online elfogadott ajánlatverzió adható át." }, 409);
    }
    const { data: ownerData, error: ownerError } = await admin.auth.admin.getUserById(quote.user_id);
    const ownerEmail = ownerData?.user?.email?.toLowerCase();
    if (ownerError || !ownerEmail) return json(req, { ok: false, error: "Az ajánlat tulajdonosa nem igazolható." }, 409);
    importBody = {
      protocol_version: 2,
      source_quote_id: quote.id,
      source_status: quote.quote_status,
      accepted_at: quote.accepted_at,
      owner_email: ownerEmail,
      quote_number: quote.quote_number,
      project_name: quote.project_name,
      client_name: quote.client_name,
      client_email: quote.client_email,
      client_phone: quote.client_phone,
      client_city: quote.client_city,
      client_address: quote.client_address,
      quote_total_gross: quote.total_gross,
      payload: { ...quote.payload, preparation },
    };
    if (!importBody) return json(req, { ok: false, error: "Nincs átadható adat." }, 200);
    if (hasBundle) {
      const currentPayload = importBody.payload && typeof importBody.payload === "object"
        ? importBody.payload as Record<string, unknown>
        : {};
      importBody.payload = {
        ...currentPayload,
        bundle_entitlement: {
          plan: "bundle",
          user_email: userEmail,
          expires_at: sourceEntitlement.expires_at || null,
          verified_by: "szakipiac",
        },
      };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${importSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(importBody),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.ok === false) {
      console.error("Építési Napló import hiba", response.status, result);
      return json(req, {
        ok: false,
        error: result?.error || `Az Építési Napló import végpont hibát adott (${response.status}).`,
      }, 200);
    }

    if (resolvedQuoteId) {
      const { error: markError } = await admin
        .from("ajanlatok")
        .update({
          import_requested_at: new Date().toISOString(),
          import_request_id: safeText(result?.request_id || "", 200) || null,
        })
        .eq("id", resolvedQuoteId);
      if (markError) console.error("Az importjelölés nem sikerült", markError);
    }

    return json(req, { ok: true, ...result });
  } catch (error) {
    console.error("send-quote-to-epitesnaplo hiba", error);
    return json(req, { ok: false, error: String((error as Error)?.message || error) }, 200);
  }
});

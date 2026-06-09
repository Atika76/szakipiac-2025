import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://szakipiac-2025.hu",
  "https://www.szakipiac-2025.hu",
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Csak POST kérés engedélyezett." }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json(req, { ok: false, error: "Az átküldéshez jelentkezz be." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const endpoint = Deno.env.get("EPITESNAPLO_IMPORT_ENDPOINT") || "";
    const importSecret = Deno.env.get("EPITESNAPLO_IMPORT_SECRET") || "";
    const adminEmail = (Deno.env.get("SZAKIPIAC_ADMIN_EMAIL") || "atika.76@windowslive.com").toLowerCase();

    if (!supabaseUrl || !anonKey || !serviceKey || !endpoint || !importSecret) {
      return json(req, { ok: false, error: "Hiányzó Supabase vagy Építési Napló secret." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const quoteId = String(body.quote_id || body.id || "").trim();
    if (!quoteId) return json(req, { ok: false, error: "Hiányzó ajánlat azonosító." }, 400);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return json(req, { ok: false, error: "Érvénytelen SzakiPiac bejelentkezés." }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: quote, error: quoteError } = await admin
      .from("ajanlatok")
      .select("*")
      .eq("id", quoteId)
      .maybeSingle();

    if (quoteError) return json(req, { ok: false, error: "Ajánlat lekérési hiba: " + quoteError.message }, 500);
    if (!quote) return json(req, { ok: false, error: "Nem található ez az ajánlat." }, 404);

    const userEmail = String(userData.user.email || "").toLowerCase();
    const ownsQuote =
      String(quote.user_id || "") === userData.user.id ||
      String(quote.user_email || "").toLowerCase() === userEmail;

    if (!ownsQuote && userEmail !== adminEmail) {
      return json(req, { ok: false, error: "Ezt az ajánlatot nem küldheted át." }, 403);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${importSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_quote_id: quote.id,
        project_name: quote.project_name,
        client_name: quote.client_name,
        client_email: quote.client_email,
        client_phone: quote.client_phone,
        client_city: quote.client_city,
        client_address: quote.client_address,
        quote_total_gross: quote.total_gross,
        payload: quote.payload || {},
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.ok === false) {
      return json(req, {
        ok: false,
        error: result?.error || `Az Építési Napló import végpont hibát adott (${response.status}).`,
      }, response.status >= 400 ? response.status : 502);
    }

    return json(req, { ok: true, ...result });
  } catch (error) {
    return json(req, { ok: false, error: String((error as Error)?.message || error) }, 500);
  }
});

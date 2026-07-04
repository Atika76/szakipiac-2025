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

function num(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function splitContact(raw: unknown) {
  const value = safeText(raw, 240);
  const emailMatch = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const email = emailMatch?.[0] || "";
  const phone = value.replace(email, "").replace(/[\/|,;]/g, " ").trim();
  return { email, phone };
}

function buildKivitelezesItems(payload: any) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items.map((item: any) => {
    const qty = num(item.qty) || 1;
    const material = num(item.material);
    const labor = num(item.labor);
    return {
      name: safeText(item.name || "Tétel", 180),
      type: material > 0 && labor <= 0 ? "anyag" : labor > 0 ? "munka" : "egyeb",
      trade: safeText(item.trade || "", 80),
      qty,
      unit: safeText(item.unit || "db", 40),
      material,
      labor,
      material_total: qty * material,
      labor_total: qty * labor,
      total: qty * (material + labor),
    };
  });
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

    if (quoteId) {
      const { data: quote, error: quoteError } = await admin
        .from("ajanlatok")
        .select("*")
        .eq("id", quoteId)
        .maybeSingle();

      if (quoteError) return json(req, { ok: false, error: "Ajánlat lekérési hiba: " + quoteError.message }, 200);
      if (!quote) return json(req, { ok: false, error: "Nem található ez az ajánlat." }, 200);

      const ownsQuote =
        String(quote.user_id || "") === userData.user.id ||
        String(quote.user_email || "").toLowerCase() === userEmail;

      if (!ownsQuote && userEmail !== adminEmail) {
        return json(req, { ok: false, error: "Ezt az ajánlatot nem küldheted át." }, 200);
      }

      importBody = {
        source_quote_id: quote.id,
        project_name: quote.project_name,
        client_name: quote.client_name,
        client_email: quote.client_email,
        client_phone: quote.client_phone,
        client_city: quote.client_city,
        client_address: quote.client_address,
        quote_total_gross: quote.total_gross,
        payload: quote.payload || {},
      };
    }

    if (kivitelezesProjectId) {
      const { data: projectRow, error: projectError } = await admin
        .from("kivitelezes_projektek")
        .select("*")
        .eq("id", kivitelezesProjectId)
        .maybeSingle();

      if (projectError) return json(req, { ok: false, error: "KivitelezésPRO projekt lekérési hiba: " + projectError.message }, 200);
      if (!projectRow) return json(req, { ok: false, error: "Nem található ez a KivitelezésPRO projekt." }, 200);

      const ownsProject =
        String(projectRow.user_id || "") === userData.user.id ||
        String(projectRow.user_email || "").toLowerCase() === userEmail;

      if (!ownsProject && userEmail !== adminEmail) {
        return json(req, { ok: false, error: "Ezt a KivitelezésPRO projektet nem küldheted át." }, 200);
      }

      const payload = projectRow.payload || {};
      const project = payload.project || {};
      const contact = splitContact(project.clientContact || "");
      const items = buildKivitelezesItems(payload);
      const totals = payload.totals || {};
      const location = safeText(project.location || projectRow.location || "", 500);

      importBody = {
        source_quote_id: `kivitelezes_projektek:${projectRow.id}`,
        project_name: projectRow.project_name || project.name || "KivitelezésPRO projekt",
        client_name: projectRow.client_name || project.clientName || "",
        client_email: contact.email,
        client_phone: contact.phone,
        client_city: location,
        client_address: "",
        quote_total_gross: projectRow.total_gross || totals.gross || 0,
        payload: {
          ...payload,
          source_type: "kivitelezes_pro",
          project_name: projectRow.project_name || project.name || "KivitelezésPRO projekt",
          client: {
            name: projectRow.client_name || project.clientName || "",
            email: contact.email,
            phone: contact.phone,
            city: location,
            address: "",
          },
          totals: {
            ...totals,
            grossTotal: totals.gross || projectRow.total_gross || 0,
            materialTotal: items.reduce((sum, item) => sum + num(item.material_total), 0),
            laborTotal: items.reduce((sum, item) => sum + num(item.labor_total), 0),
            vatAmount: totals.vat || 0,
          },
          items,
        },
      };
    }

    if (!importBody) return json(req, { ok: false, error: "Nincs átadható adat." }, 200);

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

    return json(req, { ok: true, ...result });
  } catch (error) {
    console.error("send-quote-to-epitesnaplo hiba", error);
    return json(req, { ok: false, error: String((error as Error)?.message || error) }, 200);
  }
});

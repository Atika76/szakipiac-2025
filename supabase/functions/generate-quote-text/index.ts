import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  if (req.method !== "POST") return json({ error: "Csak POST kérés engedélyezett." }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "A használathoz regisztráció vagy bejelentkezés szükséges." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (!supabaseUrl || !anonKey) throw new Error("Hiányzó Supabase-beállítás.");
    const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Érvénytelen vagy lejárt bejelentkezés." }, 401);

    const body = await req.json().catch(() => ({}));
    const quoteId = String(body?.quote_id || "").trim();
    if (!quoteId) return json({ error: "Előbb mentsd az árajánlatot." }, 400);

    const { data: quote, error: quoteError } = await client
      .from("ajanlatok")
      .select("id,user_id,project_name,payload")
      .eq("id", quoteId)
      .single();
    if (quoteError || !quote) return json({ error: "A mentett árajánlat nem található vagy nem a te tulajdonod." }, 404);
    if (quote.user_id !== userData.user.id) return json({ error: "Szöveget csak a saját árajánlatodhoz készíthetsz." }, 403);

    const { data: quota, error: quotaError } = await client.rpc("szakipiac_360_consume_ai", { p_mode: "quote" });
    if (quotaError) throw new Error("Az AI-keret ellenőrzése nem sikerült: " + quotaError.message);
    if (quota?.allowed === false) return json({ error: `Elérted a mai AI-keretedet (${quota.used}/${quota.limit}).`, quota }, 429);

    const apiKeys = Array.from(new Set([
      Deno.env.get("GEMINI_API_KEY"),
      Deno.env.get("GOOGLE_API_KEY"),
    ].filter(Boolean))) as string[];
    if (!apiKeys.length) throw new Error("Hiányzó Gemini API-kulcs.");

    const payload = quote.payload || {};
    const itemSummary = (Array.isArray(payload.items) ? payload.items : []).slice(0, 80).map((item: Record<string, unknown>) => ({
      megnevezes: String(item.name || ""),
      tipus: String(item.type || ""),
      mennyiseg: Number(item.qty || 0),
      egyseg: String(item.unit || ""),
    }));
    if (!itemSummary.length) return json({ error: "Az ajánlatban még nincs feldolgozható tétel." }, 400);

    const prompt = `
Te egy magyar építőipari árajánlat szakmai szövegezését segíted.
A matematikát és az árakat a SzakiPiac kalkulátora már kiszámolta. TILOS árat, végösszeget, határidőt, garanciát, műszaki adatot vagy új munkatételt kitalálnod.
Csak a megadott tételekből dolgozz. Írj tárgyilagos, szakmai, ellenőrizhető szöveget, túlzó ígéretek nélkül.

Projekt: ${String(quote.project_name || payload.project_name || "Névtelen projekt")}
Tételek: ${JSON.stringify(itemSummary)}

Kizárólag érvényes JSON legyen a válasz:
{
  "intro": "2-3 mondatos professzionális bevezető",
  "scope": "A munkatartalom közérthető összefoglalása, csak a felsorolt tételekből",
  "notes": "Rövid feltételezés és figyelmeztetés: előzetes becslés, helyszíni felmérés és szakemberi jóváhagyás szükséges"
}`;

    const modelNames = Array.from(new Set([
      Deno.env.get("GEMINI_MODEL"),
      "gemini-2.5-flash",
      "gemini-2.0-flash",
    ].filter(Boolean))) as string[];
    let generated: Record<string, unknown> | null = null;
    let usedModel = "";
    const failures: string[] = [];
    for (let keyIndex = 0; keyIndex < apiKeys.length && !generated; keyIndex++) {
      for (const model of modelNames) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeys[keyIndex]}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.25 },
          }),
        });
        if (!response.ok) {
          failures.push(`${model}: ${await response.text()}`);
          continue;
        }
        const gemini = await response.json();
        const raw = String(gemini?.candidates?.[0]?.content?.parts?.[0]?.text || "");
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) continue;
        generated = JSON.parse(match[0]);
        usedModel = model;
        break;
      }
    }
    if (!generated) throw new Error("A Gemini nem adott feldolgozható választ. " + failures.join(" | "));

    const narrative = {
      intro: String(generated.intro || "").slice(0, 1600),
      scope: String(generated.scope || "").slice(0, 4000),
      notes: String(generated.notes || "").slice(0, 2000),
      generated_at: new Date().toISOString(),
      model: usedModel,
    };
    if (!narrative.intro || !narrative.scope || !narrative.notes) throw new Error("A Gemini válasza hiányos volt.");

    const updatedPayload = { ...payload, narrative };
    const { error: updateError } = await client.from("ajanlatok").update({ payload: updatedPayload }).eq("id", quoteId);
    if (updateError) throw new Error("Az ajánlatszöveg mentése nem sikerült: " + updateError.message);

    const { error: workspaceError } = await client.rpc("szakipiac_360_save_workspace_item", {
      p_item_type: "quote_text",
      p_title: `${String(quote.project_name || "Árajánlat")} – szakmai szöveg`,
      p_payload: narrative,
      p_source_type: "ajanlatok",
      p_source_id: quoteId,
    });
    if (workspaceError) console.warn("A 360 gyorshivatkozás nem menthető:", workspaceError.message);

    return json({ ok: true, narrative, quota });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "Ismeretlen hiba");
    console.error(message);
    return json({ error: message }, 500);
  }
});

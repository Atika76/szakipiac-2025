// generate-ad Edge Function (SzakiPiac-2025.hu)
// - Quick & Premium mode támogatás
// - Kompatibilis: {query} vagy {keywords}, {mode: "quick"|"premium"}
// - Gemini API (Generative Language API) kulcsot Supabase Secrets-ben tároljuk: GOOGLE_API_KEY
//
// NOTE: Ha a frontend más doménről hívja, add hozzá az origin listához.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const ALLOW_ORIGINS = new Set<string>([
  "https://szakipiac-2025.hu",
  "https://www.szakipiac-2025.hu",
  // add ide ha van még (pl. netlify preview)
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = ALLOW_ORIGINS.has(origin) ? origin : "https://szakipiac-2025.hu";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function json(status: number, body: unknown, headers: Record<string,string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

serve(async (req) => {
  const headers = corsHeaders(req);

  // Preflight
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  if (req.method !== "POST") {
    return json(405, { error: "Csak POST kérés engedélyezett." }, headers);
  }

  try {
    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    const modeRaw = (payload.mode ?? "quick").toString().toLowerCase();
    const mode = modeRaw === "premium" ? "premium" : "quick";

    const query = (payload.query ?? payload.keywords ?? payload.k ?? "").toString().trim();
    if (!query) return json(400, { error: "A 'query' (vagy 'keywords') paraméter hiányzik." }, headers);

    const googleApiKey = Deno.env.get("GOOGLE_API_KEY") || Deno.env.get("GEMINI_API_KEY");
    if (!googleApiKey) {
      return json(500, { error: "Hiányzó API kulcs. Állítsd be a Supabase Secrets-ben: GOOGLE_API_KEY." }, headers);
    }

    // -------- PROMPT (Quick vs Premium) --------
    const promptQuick = `Írj magyarul egy rövid, profi hirdetési szöveget a következő témára/kulcsszóra: "${query}".
Kizárólag ezt add vissza, pontosan ebben a formában:
1) Első sor: CÍM (max 60 karakter, ütős)
2) Új sor: LEÍRÁS (2-3 mondat, tegeződve, egyszerű, érthető, konkrét)
Ne tegyél hozzá semmi mást.`;

    const promptPremium = `Írj magyarul egy *prémium marketing* hirdetési szöveget a következő témára/kulcsszóra: "${query}" a SzakiPiac-2025.hu oldalra.
Hangnem: tegeződő, bizalomépítő, profin megfogalmazott.

Kizárólag ezt add vissza, pontosan ebben a formában:
1) Első sor: CÍM (max 70 karakter, erős ajánlat + előny)
2) Új sor: LEÍRÁS (6-10 sor), ahol:
   - 1 rövid bevezető (probléma + megoldás)
   - 3-5 bullet pont "✓" jellel (előnyök, garancia, gyorsaság, tisztaság, megbízhatóság, helyszíni felmérés – ha illik)
   - 1 mondat bizalom (pl. számlaképesség / garancia / referenciák – általánosan, ne találj ki konkrét számot!)
   - 1 erős CTA a végén (pl. "Írj most és egyeztessünk!" vagy "Kérj ajánlatot ma!")
   - Maximum 1-2 emoji összesen (pl. 🔥 ✅), ne legyen túl sok.

Fontos: ne írj címsorokat, ne használj markdownot, ne adj extra magyarázatot.`;

    const prompt = mode === "premium" ? promptPremium : promptQuick;

    // Gemini (Generative Language API)
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`;

    const aiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!aiResponse.ok) {
      let errText = "";
      try {
        const errJson = await aiResponse.json();
        errText = errJson?.error?.message || JSON.stringify(errJson);
      } catch {
        errText = await aiResponse.text();
      }
      console.error("Google AI API error:", errText);
      return json(500, { error: `Google AI API hiba: ${errText}` }, headers);
    }

    const aiData = await aiResponse.json();

    const text =
      aiData?.candidates?.[0]?.content?.parts?.[0]?.text?.toString?.().trim?.() ?? "";

    if (!text) return json(500, { error: "Az AI nem adott vissza érvényes szöveget." }, headers);

    // Parse: first line title, rest description
    const lines = text.split(/\r?\n/).filter((l: string) => l !== "");
    const title = (lines[0] || "").trim() || "AI által generált cím";
    const description = lines.slice(1).join("\n").trim() || "AI által generált leírás.";

    return json(200, { title, description, mode }, headers);
  } catch (error) {
    console.error("Edge function hiba:", error);
    return json(500, { error: (error?.message || String(error)) }, headers);
  }
});

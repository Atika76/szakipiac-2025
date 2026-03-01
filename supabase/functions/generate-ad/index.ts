// supabase/functions/generate-ad/index.ts
// SzakiPiac – AI Hirdetésgeneráló (GYORS / PRÉMIUM mód) – Gemini
// Secret: GEMINI_API_KEY (Supabase → Project Settings → Secrets)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("Hiányzó GEMINI_API_KEY secret a Supabase-ben.");

    const body = await req.json().catch(() => ({}));
    const keywords = (body?.keywords || body?.query || "").toString().trim();
    const lang = (body?.lang || "hu").toString();
    const mode = (body?.mode || "quick").toString(); // quick | premium

    if (!keywords) throw new Error("Adj meg kulcsszót (pl. szobafestés).");

    const modelName = "gemini-1.5-flash";

    const rules = lang === "hu"
      ? `Magyarul válaszolj. Ne használj emojikat. A válasz legyen érvényes JSON.`
      : `Reply in English. No emojis. Return valid JSON.`;

    const quickSpec = lang === "hu"
      ? `Rövid, tömör, profi hirdetés. 80–120 szó. Legyen 1 rövid cím, 1 rövid leírás, 1 CTA.`
      : `Short, concise, professional ad. 80–120 words. Provide title, description, CTA.`;

    const premiumSpec = lang === "hu"
      ? `Prémium marketing hirdetés: 180–250 szó. Legyen figyelemfelkeltő nyitás, előnyök, felsorolás, bizalomépítés (garancia/pontosság/tapasztalat), és erős CTA.`
      : `Premium marketing ad: 180–250 words. Hook, benefits, bullet list, trust signals, strong CTA.`;

    const spec = (mode === "premium") ? premiumSpec : quickSpec;

    const prompt = `
Te egy profi marketing szövegíró vagy. ${rules}

Kulcsszavak / szolgáltatás: ${keywords}

Feladat: készíts hirdetést a következő szabályok szerint:
- ${spec}

KIZÁRÓLAG ilyen JSON-t adj vissza (extra szöveg nélkül):
{
  "title": "Rövid, ütős cím (max. 10 szó)",
  "description": "A teljes leírás (szöveg)",
  "cta": "Rövid cselekvésre ösztönző sor"
}
`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    );

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error("Gemini API hiba:", errorBody);
      throw new Error("Gemini API hiba: " + errorBody);
    }

    const geminiData = await geminiResponse.json();
    const generatedText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Gemini nyers válasz:", generatedText);
      throw new Error("A Gemini nem adott vissza érvényes JSON-t.");
    }

    const out = JSON.parse(jsonMatch[0]);
    // Back-compat: ha véletlenül cim/leiras jön, fordítsuk át
    const title = out.title || out.cim || "";
    const description = out.description || out.leiras || "";
    const cta = out.cta || "";

    return new Response(JSON.stringify({ title, description, cta }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Hiba a Function-ben:", error?.message || error);
    return new Response(JSON.stringify({ error: error?.message || "Ismeretlen hiba" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// File: supabase/functions/generate-ad/index.ts
// ✅ 2025-10-10 – Profi Gemini hirdetésgenerátor Supabase-hez (Cím + Alcím + Leírás + CTA)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("❌ Gemini API kulcs nincs beállítva a Supabase Secrets-ben.");
    }

    const { keywords } = await req.json();
    if (!keywords || typeof keywords !== "string" || keywords.trim() === "") {
      throw new Error("⚠️ Kérlek, adj meg kulcsszavakat a generáláshoz.");
    }

    const modelName = "gemini-1.5-flash";

    // 🧠 Profi prompt marketinges hirdetés generálásához
    const prompt = `
Te egy profi magyar marketing szövegíró vagy. A feladatod, hogy a következő kulcsszavak alapján
figyelemfelkeltő, értékesítést ösztönző hirdetést írj magyar nyelven.

Kulcsszavak: ${keywords}

📋 A hirdetés szerkezete:
- "cim": rövid, ütős főcím (max. 10 szó)
- "alcim": 1 mondatos kiemelés, ami bizalmat kelt vagy előnyt hangsúlyoz
- "leiras": 4-6 mondatos, meggyőző leírás. Tartalmazzon:
   * előnyöket (pl. gyors, garanciás, tapasztalt),
   * árpozicionálást (pl. "már X Ft-tól", "ingyenes felmérés"),
   * probléma–megoldás logikát,
   * bizalomépítést (referencia, szakértelem),
   * marketinges hangvételt.
- "cta": rövid cselekvésre ösztönző sor (pl. „Kérjen ajánlatot most!”, „Hívjon még ma!”)

⚠️ A válasz KIZÁRÓLAG érvényes JSON objektum legyen, így:
{
  "cim": "Rövid cím",
  "alcim": "Egy mondat kiemelés",
  "leiras": "Részletes leírás, előnyök, ár, garancia, bizalomépítés, CTA szöveg nélkül.",
  "cta": "Cselekvésre ösztönző sor"
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
      console.error("Google API hiba:", errorBody);
      throw new Error(`Gemini API hiba: ${errorBody}`);
    }

    const geminiData = await geminiResponse.json();
    const generatedText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // JSON objektum kivétele
    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Gemini nyers válasz:", generatedText);
      throw new Error("A Gemini nem adott vissza érvényes JSON objektumot.");
    }

    const adContent = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(adContent), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Hiba a Supabase Function-ben:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

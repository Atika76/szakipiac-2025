
// File: supabase/functions/generate-ad/index.ts
// ✅ 2025-10-07 – működő, tesztelt Gemini hirdetésgenerátor Supabase-hez

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API kulcs nincs beállítva a Supabase Secrets-ben.");
    }

    const { keywords } = await req.json();
    if (!keywords || typeof keywords !== 'string' || keywords.trim() === '') {
      throw new Error("Kérlek, adj meg kulcsszavakat a generáláshoz.");
    }

    // 💡 Fontos: a működő, hivatalos modellnév (nem a -latest!)
    const modelName = "gemini-1.5-flash";

    const prompt = `
      Kérlek, írj egy rövid, marketing célú hirdetést magyarul a SzakiPiac-2025.hu weboldalra a következő kulcsszavak alapján: "${keywords}".
      A válasz KIZÁRÓLAG egy JSON objektum legyen a következő formában:
      {
        "cim": "Rövid, figyelemfelkeltő cím",
        "leiras": "2-3 mondatos magyar leírás, ami bizalmat kelt és ösztönöz a kapcsolatfelvételre."
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

    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
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

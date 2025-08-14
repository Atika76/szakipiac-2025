// supabase/functions/generate-ad/index.ts
// Szuper-részletes naplózással ellátott verzió
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  console.log("--- Új kérés érkezett ---");

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    console.log("OPTIONS kérés kezelése, CORS válasz küldése.");
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log("API kulcs beolvasása a környezeti változókból...");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!GEMINI_API_KEY) {
      console.error("!!! KRITIKUS HIBA: A GEMINI_API_KEY nem található a szerver beállításaiban!");
      throw new Error("Szerver oldali konfigurációs hiba: API kulcs hiányzik.");
    }
    console.log("API kulcs sikeresen betöltve.");

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

    console.log("Kérés törzsének beolvasása (keywords)...");
    const { keywords } = await req.json();
    if (!keywords) {
      console.error("!!! HIBA: A 'keywords' hiányzik a kérésből.");
      throw new Error("Hiányoznak a kulcsszavak!");
    }
    console.log(`Beérkezett kulcsszavak: "${keywords}"`);

    const prompt = `Írj egy magyar nyelvű, professzionális hirdetési címet és egy részletes, 3-4 bekezdéses leírást a SzakiPiac.hu oldalra a következő kulcsszavak alapján: "${keywords}". A válaszod JSON formátumú legyen: {"cim": "...", "leiras": "..."}`;

    console.log("Kérés küldése a Google API-hoz...");
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" } 
        })
    });
    console.log(`Google API válasz státusza: ${response.status}`);

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`!!! HIBA a Google API-tól: ${errorBody}`);
        throw new Error(`Google API hiba: ${response.statusText}`);
    }

    console.log("Sikeres válasz a Google-től, feldolgozás...");
    const result = await response.json();
    const content = JSON.parse(result.candidates[0].content.parts[0].text);

    console.log("Sikeres feldolgozás, válasz küldése a kliensnek.");
    return new Response(JSON.stringify(content), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("--- HIBA A CATCH BLOKKBAN ---", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
})
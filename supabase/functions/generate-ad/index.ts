// supabase/functions/generate-ad/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const { keywords } = await req.json();
    if (!keywords) {
      throw new Error("Hiányoznak a kulcsszavak!");
    }
    const prompt = `Írj egy magyar nyelvű, professzionális hirdetési címet és egy részletes, 3-4 bekezdéses leírást a SzakiPiac.hu oldalra a következő kulcsszavak alapján: "${keywords}". A válaszod JSON formátumú legyen: {"cim": "...", "leiras": "..."}`;
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" } 
        })
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API hiba: ${response.statusText} - ${errorBody}`);
    }
    const result = await response.json();
    const content = JSON.parse(result.candidates[0].content.parts[0].text);
    return new Response(
      JSON.stringify(content),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})

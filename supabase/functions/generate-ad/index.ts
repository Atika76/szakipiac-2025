// --- ÚJ, KÉTNYELVŰ AI KÓD ---
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// Engedélyezzük a te oldaladnak a hozzáférést
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://szakipiac-2025.hu', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Beolvassuk a nyelvet (lang) is a kérésből
    const { query, lang } = await req.json();
    
    if (!query) {
      throw new Error("A 'query' paraméter hiányzik.");
    }

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!googleApiKey) {
      throw new Error("A GOOGLE_API_KEY nincs beállítva a Supabase Secrets-ben.");
    }

    // 2. Két különböző promptot hozunk létre
    const prompt_hu = `Írj egy profi, figyelemfelkeltő hirdetési szöveget magyarul a SzakiPiac-2025.hu oldalra a következő kulcsszavak alapján: "${query}". 
    A válaszod két részből álljon: egy rövid, ütős Cím, majd egy új sorban egy hosszabb, részletes Leírás. 
    A leírás legyen legalább 3-4 mondat, és tegeződő hangnemet használj. 
    Ne írj semmi mást, csak a címet és a leírást. 
    A válaszod első sora legyen a CÍM, utána egy sortörés, majd a LEÍRÁS.`;

    const prompt_en = `Write a professional, eye-catching advertisement text in English for SzakiPiac-2025.hu based on the following keywords: "${query}".
    Your response must consist of two parts: a short, catchy Title, and on a new line, a longer, detailed Description.
    The description should be at least 3-4 sentences long.
    Do not write anything else, only the title and the description.
    The first line of your response must be the TITLE, followed by a line break, then the DESCRIPTION.`;

    // 3. Kiválasztjuk a megfelelő promptot a 'lang' alapján
    // Ha a 'lang' nem 'en', akkor alapértelmezetten magyar lesz
    const prompt = (lang === 'en') ? prompt_en : prompt_hu;

    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`;

    const aiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }] // A kiválasztott promptot küldjük el
        }]
      }),
    });

    if (!aiResponse.ok) {
      const errorData = await aiResponse.json();
      console.error('Google AI API hiba részletei:', JSON.stringify(errorData, null, 2));
      throw new Error(`Google AI API hiba: ${errorData.error.message}`);
    }

    const aiData = await aiResponse.json();
    if (!aiData.candidates || !aiData.candidates[0] || !aiData.candidates[0].content.parts[0].text) {
      throw new Error('Az AI nem adott vissza érvényes szöveget.');
    }

    const fullGeneratedText = aiData.candidates[0].content.parts[0].text.trim();
    const parts = fullGeneratedText.split('\n');
    
    // 4. Nyelvfüggő alapértelmezett szöveg, ha valamiért nem sikerül a feldarabolás
    const title = parts[0] || (lang === 'en' ? 'AI Generated Title' : 'AI által generált cím');
    const description = parts.slice(1).join('\n').trim() || (lang === 'en' ? 'AI generated description.' : 'AI által generált leírás.');

    return new Response(
      JSON.stringify({ title: title, description: description }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Hiba a funkció futása során:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

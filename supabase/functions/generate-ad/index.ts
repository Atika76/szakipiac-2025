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
    const { query, lang, mode } = await req.json();
    
    if (!query) {
      throw new Error("A 'query' paraméter hiányzik.");
    }

    const modeNorm = (mode || 'quick').toString().toLowerCase();

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!googleApiKey) {
      throw new Error("A GOOGLE_API_KEY nincs beállítva a Supabase Secrets-ben.");
    }

    // 2. Két különböző promptot hozunk létre
    const prompt_hu_quick = `Írj rövid, tömör, mégis profi hirdetési szöveget magyarul a SzakiPiac-2025.hu oldalra a következő kulcsszavak alapján: "${query}".
A válaszod két részből álljon: egy rövid, ütős Cím, majd egy új sorban egy rövid Leírás.
A leírás legyen kb. 2-3 mondat, tegeződő hangnemmel, és legyen benne egy rövid felhívás (pl. keressen bizalommal).
Ne írj semmi mást, csak a címet és a leírást.
A válaszod első sora legyen a CÍM, utána egy sortörés, majd a LEÍRÁS.`;

const prompt_hu_premium = `Írj prémium, marketing fókuszú, meggyőző hirdetési szöveget magyarul a SzakiPiac-2025.hu oldalra a következő kulcsszavak alapján: "${query}".
A válaszod két részből álljon: egy rövid, ütős Cím, majd egy új sorban egy hosszabb, részletes Leírás.
A leírás legyen tegeződő hangnemű, minimum 180-250 szó, és tartalmazza az alábbiakat:
- Figyelemfelkeltő bevezetés (1-2 mondat)
- Szolgáltatások / vállalt munkák felsorolása (felsorolással, "•" jelekkel)
- Bizalomépítés (garancia, pontosság, tiszta munka, minőségi anyagok)
- Rövid folyamat (pl. ingyenes felmérés/ajánlat → kezdés → átadás)
- Erős lezárás, cselekvésre ösztönzés (keressen/írjon/hívjon)
Ne írj semmi mást, csak a címet és a leírást.
A válaszod első sora legyen a CÍM, utána egy sortörés, majd a LEÍRÁS.`;

const prompt_en_quick = `Write a short, professional advertisement in English for the SzakiPiac-2025.hu site based on: "${query}".
Your answer must have two parts: a catchy Title, then a new line and a short Description (2-3 sentences).
Do not write anything else. First line: TITLE, then a line break, then DESCRIPTION.`;

const prompt_en_premium = `Write a premium, conversion-focused advertisement in English for the SzakiPiac-2025.hu site based on: "${query}".
Your answer must have two parts: a catchy Title, then a new line and a detailed Description (180-250 words).
Include: benefits, bullet list of services, trust builders (warranty, punctuality, clean work), and a strong call to action.
Do not write anything else. First line: TITLE, then a line break, then DESCRIPTION.`;

    // 3. Kiválasztjuk a megfelelő promptot a 'lang' alapján
    // Ha a 'lang' nem 'en', akkor alapértelmezetten magyar lesz
    const usePremium = (modeNorm === 'premium');
    const prompt = (lang === 'en')
      ? (usePremium ? prompt_en_premium : prompt_en_quick)
      : (usePremium ? prompt_hu_premium : prompt_hu_quick);

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

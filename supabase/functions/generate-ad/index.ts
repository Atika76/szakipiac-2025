
// supabase/functions/generate-ad/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  try {
    const { keywords } = await req.json();
    if (!keywords || keywords.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Nincsenek kulcsszavak megadva." }), { status: 400 });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Hiányzik a GEMINI_API_KEY környezeti változó." }), { status: 500 });
    }

    const prompt = `
Te egy profi magyar marketing szövegíró vagy. A következő kulcsszavak alapján írj egy
figyelemfelkeltő és értékesítést ösztönző hirdetést, magyar nyelven.

Kulcsszavak: ${keywords}

A hirdetés felépítése:
- **Cím**: rövid, ütős, marketinges hangvételű.
- **Leírás**: 3-5 mondatban fogalmazd meg, miért éri meg igénybe venni a szolgáltatást.
  Legyen benne: bizalomépítés, előnyök, problémamegoldás, garancia, gyorsaság, szakértelem.
- Használj aktív hangnemet és cselekvésre ösztönző lezárást (pl. „Kérjen ajánlatot most!”).

Válasz JSON formátumban:
{
  "title": "A generált cím",
  "description": "A generált hirdetés leírása"
}
`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=" + apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      }),
    });

    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // JSON parse a Gemini válaszból
    const jsonMatch = text.match(/{[\s\S]*}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "A Gemini nem adott vissza érvényes JSON-t.", raw: text }), { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify(parsed), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Hiba történt:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

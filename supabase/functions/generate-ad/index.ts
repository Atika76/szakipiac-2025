// supabase/functions/generate-ad/index.ts
// SzakiPiac – AI Hirdetésgeneráló (GYORS / PRÉMIUM mód) – Gemini
// Tudja kezelni: szolgáltatást kínáló szakember hirdetése + megrendelői munkakeresés
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
    const purposeRaw = (body?.purpose || body?.adKind || body?.type || "kinalat").toString().toLowerCase();
    const purpose = ["kereses", "request", "munka", "megrendelo"].includes(purposeRaw) ? "kereses" : "kinalat";

    if (!keywords) throw new Error("Adj meg kulcsszót (pl. szobafestés).");

    const modelNames = [
      Deno.env.get("GEMINI_MODEL"),
      "gemini-2.5-flash",
      "gemini-2.0-flash",
    ].filter(Boolean) as string[];

    const rules = lang === "hu"
      ? `Magyarul válaszolj. Ne használj emojikat. A válasz legyen érvényes JSON.`
      : `Reply in English. No emojis. Return valid JSON.`;

    const quickSpec = lang === "hu"
      ? `Rövid, tömör, profi szöveg. 80–120 szó. Legyen 1 rövid cím, 1 rövid leírás, 1 CTA.`
      : `Short, concise, professional text. 80–120 words. Provide title, description, CTA.`;

    const premiumSpec = lang === "hu"
      ? `Prémium marketing szöveg: 180–250 szó. Legyen figyelemfelkeltő nyitás, előnyök, felsorolás, bizalomépítés, és erős CTA.`
      : `Premium marketing text: 180–250 words. Hook, benefits, bullet list, trust signals, strong CTA.`;

    const offerSpec = lang === "hu"
      ? `
SZÖVEGTÍPUS: SZOLGÁLTATÁST KÍNÁLÓ SZAKEMBER / VÁLLALKOZÓ HIRDETÉSE.
A szöveg úgy szóljon, mintha a szakember kínálná a munkáját.
Használj ilyen irányt: vállalok, készítek, javítok, kivitelezünk, kérj ajánlatot.
A cím legyen kínálati jellegű, például: "Megbízható szobafestés gyors határidővel".
A leírás emelje ki a szakértelmet, pontosságot, tiszta munkát, korrekt kommunikációt, ajánlatkérést.
TILOS úgy fogalmazni, mintha a feladó szakembert keresne. Ne írd: "keresek szakembert", "szükségem van".
`
      : `
TEXT TYPE: SERVICE OFFER FROM A TRADESPERSON / BUSINESS.
Write as if the professional is offering their work. Use wording like: I provide, we undertake, ask for a quote.
Do not write as if the user is looking for a contractor.
`;

    const requestSpec = lang === "hu"
      ? `
SZÖVEGTÍPUS: MEGRENDELŐI MUNKAFELADÁS, AHOL A FELADÓ SZAKEMBERT KERES.
A szöveg úgy szóljon, mintha egy megrendelő szeretne egy munkát elvégeztetni.
Használj ilyen irányt: keresek, szeretnék, szükségem lenne, ajánlatot kérek, helyszíni felmérés érdekel.
A cím legyen keresési jellegű, például: "Burkolót keresek fürdőszoba felújításhoz".
A leírás tartalmazza: milyen munkára keres szakembert, helyszín/település, határidő vagy rugalmasság, ajánlatkérés, kapcsolatfelvétel.
Legyen udvarias, konkrét, bizalomkeltő, de ne reklámozza a feladót szakemberként.
TILOS úgy fogalmazni, mintha a feladó vállalna munkát. Ne írd: "vállalok", "kivitelezünk", "szolgáltatásaim".
`
      : `
TEXT TYPE: CUSTOMER JOB REQUEST, WHERE THE USER IS LOOKING FOR A TRADESPERSON.
Write as if a customer wants to have a job done. Use wording like: looking for, need, request a quote, site visit.
Do not write as if the user offers services.
`;

    const spec = (mode === "premium") ? premiumSpec : quickSpec;
    const purposeSpec = purpose === "kereses" ? requestSpec : offerSpec;

    const prompt = `
Te egy profi magyar hirdetésszövegíró vagy. ${rules}

Kulcsszavak / téma: ${keywords}

${purposeSpec}

Feladat: készíts szöveget a következő szabályok szerint:
- ${spec}
- A cím maximum 10 szó legyen.
- A leírás legyen természetes, magyaros, ne legyen túlzásba vitt reklámszagú.
- A CTA illeszkedjen a szövegtípushoz.

KIZÁRÓLAG ilyen JSON-t adj vissza, extra szöveg nélkül:
{
  "title": "Rövid, pontos cím",
  "description": "A teljes leírás",
  "cta": "Rövid cselekvésre ösztönző sor"
}
`;

    let geminiData: any = null;
    let usedModel = "";
    const modelErrors: string[] = [];

    for (const modelName of modelNames) {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        },
      );

      if (geminiResponse.ok) {
        geminiData = await geminiResponse.json();
        usedModel = modelName;
        break;
      }

      const errorBody = await geminiResponse.text();
      modelErrors.push(`${modelName}: ${errorBody}`);
      console.error("Gemini API hiba:", modelName, errorBody);
    }

    if (!geminiData) {
      throw new Error("Gemini API hiba: " + modelErrors.join(" | "));
    }

    const generatedText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Gemini nyers válasz:", generatedText);
      throw new Error("A Gemini nem adott vissza érvényes JSON-t.");
    }

    const out = JSON.parse(jsonMatch[0]);
    const title = out.title || out.cim || "";
    const description = out.description || out.leiras || "";
    const cta = out.cta || "";

    return new Response(JSON.stringify({ title, description, cta, purpose, model: usedModel }), {
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

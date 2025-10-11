// index.ts - A JAVÍTOTT, MŰKÖDŐ KÓD
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// 1. Definiáljuk a CORS fejléceket egy külön változóban.
// Így könnyen újra tudjuk használni őket.
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://szakipiac-2025.hu', // Csak erről a domainről engedélyezzük a hozzáférést.
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', // Engedélyezett fejlécek.
}

serve(async (req) => {
  // 2. A böngésző küld egy ún. "preflight" (OPTIONS) kérést, mielőtt a valódi
  // POST kérést elküldené. Ezzel "engedélyt kér". Erre muszáj helyesen válaszolnunk.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // A te logikád kezdete: kinyerjük az adatot a kérésből
    const { query } = await req.json() // Vagy bármilyen adat, amit a frontendről küldesz

    // ===================================================================
    // IDE ILLESZD BE A SAJÁT AI GENERÁLÓ LOGIKÁDAT!
    // Például az OpenAI API hívásodat.
    // A lényeg, hogy a végén a generált szöveg egy változóba kerüljön.
    //
    // PÉLDA:
    const generatedText = `Ez az AI által generált válasz a következőre: '${query}'.`
    // ===================================================================

    // 3. A SIKERES válaszhoz is hozzá kell adni a CORS fejléceket.
    // A '...' operátorral egyesítjük a két objektumot.
    return new Response(JSON.stringify({ text: generatedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    // 4. Nagyon fontos, hogy HIBA ESETÉN is visszaküldjük a CORS fejléceket,
    // különben a böngésző a hibaüzenetet sem tudja kiolvasni és csak egy
    // általános "Network Error"-t fogsz látni.
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

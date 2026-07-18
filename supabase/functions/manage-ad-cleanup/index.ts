import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://szakipiac-2025.hu",
  "https://www.szakipiac-2025.hu",
  "https://atika76.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://szakipiac-2025.hu",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

function storagePath(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    const marker = "/storage/v1/object/public/hirdetes-kepek/";
    const index = url.pathname.indexOf(marker);
    if (index < 0) return "";
    return decodeURIComponent(url.pathname.slice(index + marker.length));
  } catch {
    return "";
  }
}

type AdRow = {
  id: string;
  user_id: string | null;
  kep_url_tomb: unknown[] | null;
};

serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Csak POST kérés engedélyezett." }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json(req, { ok: false, error: "Jelentkezz be a törléshez." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const adminEmail = (Deno.env.get("SZAKIPIAC_ADMIN_EMAIL") || "atika.76@windowslive.com").toLowerCase();
    if (!supabaseUrl || !anonKey || !serviceKey) return json(req, { ok: false, error: "Hiányzó Supabase-beállítás." }, 500);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json(req, { ok: false, error: "Érvénytelen bejelentkezés." }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const isAdmin = String(userData.user.email || "").toLowerCase() === adminEmail;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "delete_one");

    // A lejárati_datum ékezetes oszlopot a Supabase típusparser nem kezeli jól
    // vesszővel felsorolt selectben, ezért itt teljes sort kérünk le.
    let query = admin.from("hirdetesek").select("*");
    if (action === "delete_expired") {
      if (!isAdmin) return json(req, { ok: false, error: "A lejárt hirdetések takarítása admin művelet." }, 403);
      query = query.lt("lejárati_datum", new Date().toISOString()).limit(200);
    } else {
      const adId = String(body?.ad_id || "").trim();
      if (!adId) return json(req, { ok: false, error: "Hiányzó hirdetésazonosító." }, 400);
      query = query.eq("id", adId).limit(1);
    }

    const { data: rawAds, error: selectError } = await query;
    const ads = (rawAds || []) as AdRow[];
    if (selectError) return json(req, { ok: false, error: selectError.message }, 500);
    if (!ads?.length) return json(req, { ok: true, deleted: 0, files: 0 });

    const allowedAds = action === "delete_expired"
      ? ads
      : ads.filter(ad => isAdmin || String(ad.user_id || "") === userData.user.id);
    if (!allowedAds.length) return json(req, { ok: false, error: "Ezt a hirdetést nem törölheted." }, 403);

    const paths = allowedAds.flatMap(ad => Array.isArray(ad.kep_url_tomb) ? ad.kep_url_tomb.map(storagePath).filter(Boolean) : []);
    if (paths.length) {
      const { error: storageError } = await admin.storage.from("hirdetes-kepek").remove(paths);
      if (storageError) console.error("Hirdetéskép-takarítási hiba:", storageError.message);
    }

    const ids = allowedAds.map(ad => ad.id);
    const { error: deleteError } = await admin.from("hirdetesek").delete().in("id", ids);
    if (deleteError) return json(req, { ok: false, error: deleteError.message }, 500);

    return json(req, { ok: true, deleted: ids.length, files: paths.length });
  } catch (error) {
    return json(req, { ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

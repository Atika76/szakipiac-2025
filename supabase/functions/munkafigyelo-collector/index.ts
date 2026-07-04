import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { XMLParser } from "npm:fast-xml-parser@4.5.3";

type SourceType = "ted" | "rss" | "partner_json";
type SourceConfig = {
  key: string;
  type: SourceType;
  url?: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
  itemPath?: string;
  mapping?: Record<string, string>;
  defaults?: Record<string, unknown>;
};

type Lead = {
  cim: string;
  leiras: string;
  szakma: string;
  megye: string;
  telepules: string;
  surgosseg: "normal" | "hamarosan" | "surgos";
  forras_tipus: "nyilvanos_forras" | "kozbeszerzes";
  forras_url: string;
  allapot: "aktiv";
  lejar_at: string;
  created_at?: string;
};

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-collector-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  return value == null ? [] : Array.isArray(value) ? value : [value];
}

function getPath(value: unknown, path?: string): unknown {
  if (!path) return value;
  return path.split(".").reduce((current: unknown, key) => {
    if (current && typeof current === "object") return (current as Record<string, unknown>)[key];
    return undefined;
  }, value);
}

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return text(object["#text"] ?? object.href ?? object["@_href"] ?? "");
  }
  return String(value).trim();
}

function validUrl(value: unknown): string {
  try {
    const url = new URL(text(value));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function stripHtml(value: unknown): string {
  return text(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function mapItem(item: Record<string, unknown>, source: SourceConfig): Lead | null {
  const mapping = source.mapping || {};
  const pick = (name: string, fallbacks: string[]) => {
    const configured = mapping[name];
    if (configured) return getPath(item, configured);
    for (const path of fallbacks) {
      const value = getPath(item, path);
      if (value != null && text(value)) return value;
    }
    return undefined;
  };
  const defaults = source.defaults || {};
  const cim = stripHtml(pick("cim", ["title", "name", "notice-title", "BT-21-Procedure"]));
  const leiras = stripHtml(pick("leiras", ["description", "summary", "content", "notice-description"])) || cim;
  const forrasUrl = validUrl(pick("forras_url", ["link", "url", "notice-url", "links.html"]));
  if (!cim || !forrasUrl) return null;
  const type = source.type === "ted" ? "kozbeszerzes" : "nyilvanos_forras";
  const urgency = text(pick("surgosseg", ["surgosseg"])) || text(defaults.surgosseg) || "normal";
  const deadline = text(pick("lejar_at", ["deadline", "date-receipt", "lejar_at"]));
  const published = text(pick("created_at", ["pubDate", "published", "publication-date", "created_at"]));
  return {
    cim: cim.slice(0, 240),
    leiras: leiras.slice(0, 8000),
    szakma: text(pick("szakma", ["szakma", "category"])) || text(defaults.szakma) || "Egyéb szakember",
    megye: text(pick("megye", ["megye", "county"])) || text(defaults.megye) || "Országos",
    telepules: text(pick("telepules", ["telepules", "city"])) || text(defaults.telepules),
    surgosseg: ["normal", "hamarosan", "surgos"].includes(urgency) ? urgency as Lead["surgosseg"] : "normal",
    forras_tipus: type,
    forras_url: forrasUrl,
    allapot: "aktiv",
    lejar_at: deadline && !Number.isNaN(Date.parse(deadline)) ? new Date(deadline).toISOString() : new Date(Date.now() + 90 * 86400000).toISOString(),
    ...(published && !Number.isNaN(Date.parse(published)) ? { created_at: new Date(published).toISOString() } : {})
  };
}

function rssItems(xml: string): Record<string, unknown>[] {
  const document = parser.parse(xml);
  return asArray(getPath(document, "rss.channel.item") || getPath(document, "feed.entry")) as Record<string, unknown>[];
}

function jsonItems(payload: unknown, source: SourceConfig): Record<string, unknown>[] {
  const resolved = getPath(payload, source.itemPath) ?? (payload as Record<string, unknown>)?.items ?? (payload as Record<string, unknown>)?.notices ?? payload;
  return asArray(resolved) as Record<string, unknown>[];
}

async function fetchSource(source: SourceConfig): Promise<Record<string, unknown>[]> {
  if (!source.url) throw new Error(`A(z) ${source.key} forrás URL-je hiányzik.`);
  const response = await fetch(source.url, {
    method: source.method || (source.body ? "POST" : "GET"),
    headers: source.headers,
    body: source.body ? JSON.stringify(source.body) : undefined
  });
  if (!response.ok) throw new Error(`${source.key}: HTTP ${response.status}`);
  if (source.type === "rss") return rssItems(await response.text());
  return jsonItems(await response.json(), source);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const collectorSecret = Deno.env.get("MUNKAFIGYELO_COLLECTOR_SECRET");
  if (!supabaseUrl || !serviceKey) return json({ error: "missing_server_configuration" }, 500);

  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const suppliedSecret = req.headers.get("x-collector-secret") || "";
  if (bearer !== serviceKey && (!collectorSecret || suppliedSecret !== collectorSecret)) return json({ error: "forbidden" }, 403);

  let sources: SourceConfig[];
  try {
    sources = JSON.parse(Deno.env.get("MUNKAFIGYELO_SOURCES_JSON") || "[]");
  } catch {
    return json({ error: "invalid_MUNKAFIGYELO_SOURCES_JSON" }, 500);
  }

  const body = await req.json().catch(() => ({}));
  const selected = body.sourceKey ? sources.filter(source => source.key === body.sourceKey) : sources;
  if (!selected.length) return json({ error: "source_not_configured" }, 400);

  const supabase = createClient(supabaseUrl, serviceKey);
  const results: Array<Record<string, unknown>> = [];
  for (const source of selected) {
    try {
      const rawItems = body.sourceKey === source.key && body.items
        ? asArray(body.items) as Record<string, unknown>[]
        : await fetchSource(source);
      const leads = rawItems.map(item => mapItem(item, source)).filter((lead): lead is Lead => Boolean(lead));
      const urls = [...new Set(leads.map(lead => lead.forras_url))];
      const { data: existing } = urls.length
        ? await supabase.from("munkafigyelo_hirdetesek").select("forras_url").in("forras_url", urls)
        : { data: [] };
      const existingUrls = new Set((existing || []).map(row => row.forras_url));
      const fresh = leads.filter(lead => !existingUrls.has(lead.forras_url));
      const { data: inserted, error } = fresh.length
        ? await supabase.from("munkafigyelo_hirdetesek").upsert(fresh, { onConflict: "forras_url", ignoreDuplicates: true }).select("id,forras_url")
        : { data: [], error: null };
      if (error) throw error;

      for (const row of inserted || []) {
        await fetch(`${supabaseUrl}/functions/v1/munkafigyelo-push`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ hirdetesId: row.id })
        }).catch(() => undefined);
      }
      results.push({ source: source.key, received: rawItems.length, valid: leads.length, inserted: inserted?.length || 0 });
    } catch (error) {
      results.push({ source: source.key, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return json({ ok: results.every(result => !result.error), results });
});

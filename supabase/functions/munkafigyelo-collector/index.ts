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
  kezdes_datum?: string;
  created_at?: string;
};

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-collector-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });

const TED_NOTICE_TYPES = "cn-standard cn-social cn-desg subco qu-sy pin-cfc-standard pin-cfc-social";
const TED_FIELDS = [
  "publication-number",
  "notice-title",
  "publication-date",
  "buyer-name",
  "classification-cpv",
  "links",
  "description-proc",
  "description-lot",
  "description-part",
  "place-of-performance-city-lot",
  "place-of-performance-city-proc",
  "place-of-performance-subdiv-lot",
  "place-of-performance-subdiv-proc",
  "deadline-receipt-tender-date-lot",
  "deadline-date-lot",
  "estimated-value-proc",
  "estimated-value-cur-proc",
  "estimated-value-lot",
  "estimated-value-cur-lot",
  "contract-duration-start-date-lot",
  "notice-type",
  "procedure-type",
  "document-url-lot"
];

const DEFAULT_SOURCES: SourceConfig[] = [{
  key: "ted-hu-kozbeszerzesek",
  type: "ted",
  url: "https://api.ted.europa.eu/v3/notices/search",
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: {
    query: `buyer-country = HUN AND notice-type IN (${TED_NOTICE_TYPES}) SORT BY publication-date DESC`,
    fields: TED_FIELDS,
    limit: 20
  },
  itemPath: "notices",
  defaults: {
    megye: "Országos",
    telepules: "Magyarország",
    szakma: "Egyéb szakember",
    surgosseg: "normal"
  }
}];

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
    const direct = object["#text"] ?? object.href ?? object.url ?? object.link ?? object["@_href"] ?? object["@_url"];
    return direct == null ? "" : text(direct);
  }
  return String(value).trim();
}

function deepText(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(deepText).filter(Boolean).join(" ");
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).map(deepText).filter(Boolean).join(" ");
  return String(value).trim();
}

function findFirstUrl(value: unknown): string {
  const direct = text(value);
  const directMatch = direct.match(/https?:\/\/[^\s"'<>]+/i);
  if (directMatch) return directMatch[0];
  if (value == null) return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstUrl(item);
      if (found) return found;
    }
    return "";
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const found = findFirstUrl(item);
      if (found) return found;
    }
    return "";
  }
  const match = String(value).match(/https?:\/\/[^\s"'<>]+/i);
  return match ? match[0] : "";
}

function validUrl(value: unknown): string {
  const candidates = [text(value), findFirstUrl(value)];
  for (const candidate of candidates) {
    try {
      if (!candidate) continue;
      const url = new URL(candidate);
      if (["http:", "https:"].includes(url.protocol)) return url.href;
    } catch {
      // try next candidate
    }
  }
  return "";
}

function stripHtml(value: unknown): string {
  return (text(value) || deepText(value)).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function localizedText(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return [...new Set(value.map(localizedText).filter(Boolean))].join("\n\n");
  }
  if (typeof value !== "object") return String(value).trim();

  const object = value as Record<string, unknown>;
  for (const key of ["hun", "HUN", "hu", "eng", "ENG", "en", "#text"]) {
    const result = localizedText(object[key]);
    if (result) return result;
  }
  for (const nested of Object.values(object)) {
    const result = localizedText(nested);
    if (result) return result;
  }
  return "";
}

function cleanLocalizedText(value: unknown): string {
  return localizedText(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizedDate(value: unknown): string {
  const raw = localizedText(value);
  const dateOnly = raw.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
  if (dateOnly) return new Date(`${dateOnly}T00:00:00.000Z`).toISOString();
  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp) ? "" : new Date(timestamp).toISOString();
}

function safeLimit(value: string, max = 100): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max - 1).trimEnd() + "…";
}

function hasAny(value: string, words: string[]): boolean {
  return words.some(word => value.includes(word));
}

function publicationNumber(item: Record<string, unknown>): string {
  const value = text(getPath(item, "publication-number")) || deepText(getPath(item, "publication-number"));
  const match = value.match(/\b\d{6,8}-\d{4}\b/);
  return match ? match[0] : "";
}

function tedDetailUrl(item: Record<string, unknown>): string {
  const number = publicationNumber(item);
  return number ? `https://ted.europa.eu/hu/notice/-/detail/${number}` : "";
}

function firstTedValue(item: Record<string, unknown>, paths: string[]): unknown {
  for (const path of paths) {
    const value = getPath(item, path);
    if (cleanLocalizedText(value)) return value;
  }
  return undefined;
}

function classifySzakma(item: Record<string, unknown>, cim: string, leiras: string, fallback: string): string {
  const cpvText = deepText(
    getPath(item, "classification-cpv") ??
    getPath(item, "main-classification-proc") ??
    getPath(item, "BT-262-Procedure") ??
    getPath(item, "BT-262-Lot") ??
    getPath(item, "main-classification-type-lot")
  );
  const cpvDigits = cpvText.match(/\b\d{8}\b/g) || [];
  const combined = `${cim} ${leiras} ${cpvText}`.toLowerCase();

  if (cpvDigits.some(code => code.startsWith("4531")) || hasAny(combined, ["villamos", "villany", "elektromos", "electrical", "erősáram", "gyengeáram"])) return "Villanyszerelő";
  if (cpvDigits.some(code => code.startsWith("4533")) || hasAny(combined, ["vízvezeték", "gázvezeték", "fűtés", "kazán", "plumbing", "heating", "natural gas", "gáz"])) return "Víz- és gázszerelő";
  if (cpvDigits.some(code => code.startsWith("453312") || code.startsWith("4251") || code.startsWith("5073")) || hasAny(combined, ["klíma", "légkondicion", "hűtés", "szellőzés", "hvac", "air-conditioning"])) return "Klímaszerelő";
  if (cpvDigits.some(code => code.startsWith("4543")) || hasAny(combined, ["burkol", "padló", "csempe", "tile", "flooring", "wall-covering"])) return "Burkoló";
  if (cpvDigits.some(code => code.startsWith("4544")) || hasAny(combined, ["festés", "mázol", "painting", "paintwork"])) return "Festő-mázoló";
  if (cpvDigits.some(code => code.startsWith("4526")) || hasAny(combined, ["tető", "fedés", "roof", "roofing"])) return "Tetőfedő";
  if (cpvDigits.some(code => code.startsWith("4542")) || hasAny(combined, ["asztalos", "bútor", "nyílászáró", "furniture", "joinery", "carpentry"])) return "Asztalos";
  if (cpvDigits.some(code => code.startsWith("45262")) || hasAny(combined, ["falaz", "kőműves", "masonry", "bricklaying", "vakolás", "betonozás"])) return "Kőműves";
  if (cpvDigits.some(code => code.startsWith("4532")) || hasAny(combined, ["szigetel", "hőszigetel", "insulation", "waterproofing"])) return "Szigetelő";
  if (cpvDigits.some(code => code.startsWith("442") || code.startsWith("445") || code.startsWith("45223")) || hasAny(combined, ["lakatos", "acél", "fémszerkezet", "metal", "steel structure"])) return "Lakatos";
  if (cpvDigits.some(code => code.startsWith("773") || code.startsWith("451127")) || hasAny(combined, ["kert", "parkosítás", "landscaping", "garden", "zöldterület"])) return "Kertépítő";
  if (cpvDigits.some(code => code.startsWith("909")) || hasAny(combined, ["takarítás", "tisztítás", "cleaning", "fertőtlenítés"])) return "Takarító";
  if (cpvDigits.some(code => code.startsWith("72") || code.startsWith("302") || code.startsWith("480")) || hasAny(combined, ["informatika", "szoftver", "számítógép", "computer", "software", "it services", "tárolóegység", "storage"])) return "Számítástechnika";
  if (cpvDigits.some(code => code.startsWith("50") || code.startsWith("42") || code.startsWith("4535")) || hasAny(combined, ["gépész", "berendezés", "javítás", "karbantartás", "machinery", "equipment", "maintenance"])) return "Épületgépész";
  if (cpvDigits.some(code => code.startsWith("45")) || hasAny(combined, ["építési munka", "építés", "construction work", "felújítás", "renovation"])) return "Generálkivitelező";

  return fallback || "Egyéb szakember";
}

function mapItem(item: Record<string, unknown>, source: SourceConfig): Lead | null {
  const mapping = source.mapping || {};
  const pick = (name: string, fallbacks: string[]) => {
    const configured = mapping[name];
    if (configured) return getPath(item, configured);
    for (const path of fallbacks) {
      const value = getPath(item, path);
      if (value != null && (text(value) || deepText(value) || findFirstUrl(value))) return value;
    }
    return undefined;
  };
  const defaults = source.defaults || {};
  if (source.type === "ted") {
    const number = publicationNumber(item);
    const cim = cleanLocalizedText(firstTedValue(item, ["notice-title", "title", "BT-21-Procedure"])) ||
      number || "TED közbeszerzési hirdetmény";
    const buyer = cleanLocalizedText(firstTedValue(item, ["buyer-name"]));
    const procedureDescription = cleanLocalizedText(firstTedValue(item, ["description-proc"]));
    const lotDescription = cleanLocalizedText(firstTedValue(item, ["description-lot"]));
    const partDescription = cleanLocalizedText(firstTedValue(item, ["description-part"]));
    const city = cleanLocalizedText(firstTedValue(item, [
      "place-of-performance-city-lot",
      "place-of-performance-city-proc"
    ]));
    const primaryCity = city.split(/\n+/).map(value => value.trim()).find(Boolean) || "";
    const subdivision = cleanLocalizedText(firstTedValue(item, [
      "place-of-performance-subdiv-lot",
      "place-of-performance-subdiv-proc"
    ]));
    const published = normalizedDate(firstTedValue(item, ["publication-date", "published", "created_at"]));
    const deadline = normalizedDate(firstTedValue(item, [
      "deadline-receipt-tender-date-lot",
      "deadline-date-lot",
      "deadline",
      "date-receipt"
    ]));
    const startDate = normalizedDate(firstTedValue(item, ["contract-duration-start-date-lot"]));
    const estimatedValue = cleanLocalizedText(firstTedValue(item, ["estimated-value-proc", "estimated-value-lot"]));
    const estimatedCurrency = cleanLocalizedText(firstTedValue(item, ["estimated-value-cur-proc", "estimated-value-cur-lot"]));
    const documentUrl = validUrl(firstTedValue(item, ["document-url-lot"]));
    const forrasUrl = tedDetailUrl(item) ||
      validUrl(firstTedValue(item, [
        "links.html.HUN",
        "links.html.hun",
        "links.html.ENG",
        "links.html.eng",
        "links.htmlDirect.HUN",
        "links.htmlDirect.ENG"
      ]));
    if (!forrasUrl) return null;

    const details = [
      buyer ? `Ajánlatkérő: ${buyer}` : "",
      number ? `TED azonosító: ${number}` : "",
      published ? `Közzététel: ${published.slice(0, 10)}` : "",
      deadline ? `Ajánlattételi határidő: ${deadline.slice(0, 10)}` : "",
      city || subdivision ? `Helyszín: ${[city, subdivision].filter(Boolean).join(", ")}` : "",
      estimatedValue ? `Becsült érték: ${estimatedValue}${estimatedCurrency ? ` ${estimatedCurrency}` : ""}` : "",
      procedureDescription ? `Eljárás leírása:\n${procedureDescription}` : "",
      lotDescription ? `Részletes leírás:\n${lotDescription}` : "",
      partDescription ? `További részletek:\n${partDescription}` : "",
      documentUrl ? `Közbeszerzési dokumentumok: ${documentUrl}` : ""
    ].filter(Boolean);
    const leiras = details.length
      ? details.join("\n\n")
      : `${cim} - TED közbeszerzési hirdetmény. A teljes adatlap a hivatalos TED oldalon érhető el.`;
    const fallbackSzakma = text(defaults.szakma) || "Egyéb szakember";

    return {
      cim: safeLimit(cim, 100),
      leiras: leiras.slice(0, 4000),
      szakma: classifySzakma(item, cim, leiras, fallbackSzakma),
      megye: subdivision || text(defaults.megye) || "Országos",
      telepules: safeLimit(primaryCity || text(defaults.telepules) || "Magyarország", 100),
      surgosseg: "normal",
      forras_tipus: "kozbeszerzes",
      forras_url: forrasUrl,
      allapot: "aktiv",
      lejar_at: deadline || new Date(Date.now() + 90 * 86400000).toISOString(),
      ...(startDate ? { kezdes_datum: startDate } : {}),
      ...(published ? { created_at: published } : {})
    };
  }
  const cim = stripHtml(pick("cim", ["title", "name", "notice-title", "BT-21-Procedure"])) || publicationNumber(item) || "TED közbeszerzési hirdetmény";
  const pickedLeiras = stripHtml(pick("leiras", ["description", "summary", "content", "notice-description"]));
  const leiras = pickedLeiras && pickedLeiras.length >= 30
    ? pickedLeiras
    : `${cim} - TED közbeszerzési hirdetmény. Részletek és dokumentumok a megadott TED hivatkozáson érhetők el.`;
  const forrasUrl = validUrl(pick("forras_url", ["link", "url", "notice-url", "links", "links.html", "links.htmlDirect", "links.htmlDirect.HUN", "links.htmlDirect.ENG"]));
  if (!cim || !forrasUrl) return null;
  const type: Lead["forras_tipus"] = "nyilvanos_forras";
  const urgency = text(pick("surgosseg", ["surgosseg"])) || text(defaults.surgosseg) || "normal";
  const deadline = text(pick("lejar_at", ["deadline", "date-receipt", "lejar_at"])) || deepText(pick("lejar_at", ["deadline", "date-receipt", "lejar_at"]));
  const published = text(pick("created_at", ["pubDate", "published", "publication-date", "created_at"])) || deepText(pick("created_at", ["pubDate", "published", "publication-date", "created_at"]));
  const fallbackSzakma = text(pick("szakma", ["szakma", "category"])) || text(defaults.szakma) || "Egyéb szakember";
  const szakma = fallbackSzakma;
  return {
    cim: safeLimit(cim, 100),
    leiras: leiras.slice(0, 8000),
    szakma,
    megye: text(pick("megye", ["megye", "county"])) || text(defaults.megye) || "Országos",
    telepules: text(pick("telepules", ["telepules", "city"])) || text(defaults.telepules) || "Magyarország",
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
  let requestBody = source.body;
  if (source.type === "ted") {
    const configured = source.body && typeof source.body === "object" && !Array.isArray(source.body)
      ? source.body as Record<string, unknown>
      : {};
    const configuredQuery = String(configured.query || "buyer-country = HUN")
      .replace(/\s+SORT\s+BY[\s\S]*$/i, "")
      .trim();
    const query = /\bnotice-type\b/i.test(configuredQuery)
      ? configuredQuery
      : `${configuredQuery} AND notice-type IN (${TED_NOTICE_TYPES})`;
    const configuredLimit = Number(configured.limit);
    requestBody = {
      ...configured,
      query: `${query} SORT BY publication-date DESC`,
      fields: TED_FIELDS,
      limit: Number.isFinite(configuredLimit) ? Math.min(50, Math.max(20, configuredLimit)) : 20
    };
  }
  const response = await fetch(source.url, {
    method: source.method || (requestBody ? "POST" : "GET"),
    headers: source.headers,
    body: requestBody ? JSON.stringify(requestBody) : undefined
  });
  if (!response.ok) throw new Error(`${source.key}: HTTP ${response.status} - ${await response.text()}`);
  if (source.type === "rss") return rssItems(await response.text());
  return jsonItems(await response.json(), source);
}

function loadSources(): SourceConfig[] {
  const raw = Deno.env.get("MUNKAFIGYELO_SOURCES_JSON") || "";
  if (!raw.trim()) return DEFAULT_SOURCES;
  try {
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [];
    return list.length ? list : DEFAULT_SOURCES;
  } catch {
    return DEFAULT_SOURCES;
  }
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

  const sources = loadSources();
  const body = await req.json().catch(() => ({}));
  const selected = body.sourceKey ? sources.filter(source => source.key === body.sourceKey) : sources;
  if (!selected.length) return json({ error: "source_not_configured", available: sources.map(source => source.key) }, 400);

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
      if (error) throw new Error(JSON.stringify(error));

      for (const row of inserted || []) {
        await fetch(`${supabaseUrl}/functions/v1/munkafigyelo-push`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ hirdetesId: row.id })
        }).catch(() => undefined);
      }
      results.push({ source: source.key, received: rawItems.length, valid: leads.length, inserted: inserted?.length || 0 });
    } catch (error) {
      results.push({ source: source.key, error: error instanceof Error ? error.message : JSON.stringify(error) });
    }
  }

  return json({ ok: results.every(result => !result.error), results });
});

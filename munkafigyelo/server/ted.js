import { db } from './db.js'
import { classify, insertLead } from './ingest.js'

const endpoint = 'https://api.ted.europa.eu/v3/notices/search'

function firstLanguage(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  const preferred = value.hun || value.mul || value.eng || Object.values(value)[0]
  return Array.isArray(preferred) ? preferred[0] || '' : preferred || ''
}

function dateToken(daysAgo = 14) {
  const date = new Date(Date.now() - daysAgo * 86400000)
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2,'0')}${String(date.getUTCDate()).padStart(2,'0')}`
}

function money(notice) {
  const value = notice['estimated-value-proc']
  const currency = notice['estimated-value-cur-proc']
  if (value == null) return 'Közbeszerzés'
  const amount = Array.isArray(value) ? value[0] : value
  const unit = Array.isArray(currency) ? currency[0] : currency || 'EUR'
  return `${new Intl.NumberFormat('hu-HU',{maximumFractionDigits:0}).format(Number(amount))} ${unit}`
}

export async function pollTed() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  const body = {
    query:`buyer-country=HUN AND classification-cpv=45000000 AND publication-date>=${dateToken(14)}`,
    fields:['publication-number','notice-title','buyer-name','buyer-city','buyer-country','publication-date','classification-cpv','estimated-value-proc','estimated-value-cur-proc'],
    limit:100, scope:'ACTIVE', paginationMode:'PAGE_NUMBER', page:1,
  }
  let response
  try {
    response = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','User-Agent':'SzakiLeadFigyelo/1.0'},body:JSON.stringify(body),signal:controller.signal})
  } finally { clearTimeout(timeout) }
  if (!response.ok) throw new Error(`TED API hiba: ${response.status}`)
  const data = await response.json()
  const firstSync = !await db.selectFrom('leads').select('id').where('source','=','TED közbeszerzés').limit(1).executeTakeFirst()
  let inserted = 0
  for (const notice of data.notices || []) {
    const number = notice['publication-number']
    const title = firstLanguage(notice['notice-title']) || `TED közbeszerzés ${number}`
    const buyer = firstLanguage(notice['buyer-name'])
    const city = firstLanguage(notice['buyer-city'])
    const sourceUrl = notice.links?.htmlDirect?.HUN || notice.links?.html?.HUN || `https://ted.europa.eu/hu/notice/${number}/html`
    const detectedTrade = classify(title)
    const result = await insertLead({
      id:`ted-${number}`, title, excerpt:buyer ? `Kiíró: ${buyer}` : 'Magyarországi építőipari közbeszerzési felhívás.',
      city, county:'Magyarország', trade:detectedTrade === 'Egyéb' ? 'Közbeszerzés' : detectedTrade, source:'TED közbeszerzés', sourceUrl,
      publishedAt:`${String(notice['publication-date'] || new Date().toISOString()).slice(0,10)}T00:00:00.000Z`, score:84, budget:money(notice), urgent:false,
      tags:['közbeszerzés','építőipar'], tone:'Hivatalos közbeszerzési lehetőség',
    },{ notify:!firstSync })
    if (result.inserted) inserted++
  }
  return { source:'TED', received:(data.notices || []).length, inserted, firstSync, total:data.totalNoticeCount || 0 }
}

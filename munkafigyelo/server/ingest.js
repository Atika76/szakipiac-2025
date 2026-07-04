import crypto from 'node:crypto'
import dns from 'node:dns/promises'
import net from 'node:net'
import Parser from 'rss-parser'
import { db, rowsToLeads } from './db.js'
import { sendLeadPush } from './push.js'

const parser = new Parser({ timeout: 12000, headers: { 'User-Agent': 'SzakiLeadPro/1.0 (+RSS reader)' } })
const defaultKeywords = ['szakembert keresek','kőművest keresek','burkolót keresek','villanyszerelőt keresek','tetőfedőt keresek','festőt keresek','felújításhoz keresek','árajánlatot kérek']

function privateIp(ip) {
  return ip === '::1' || ip.startsWith('10.') || ip.startsWith('127.') || ip.startsWith('169.254.') || ip.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip) || ip.startsWith('fc') || ip.startsWith('fd')
}

export async function validateSourceUrl(rawUrl) {
  const url = new URL(rawUrl)
  if (url.protocol !== 'https:') throw new Error('Csak HTTPS RSS-forrás engedélyezett.')
  const allowed = (process.env.ALLOWED_SOURCE_HOSTS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
  if (!allowed.includes(url.hostname.toLowerCase())) throw new Error(`A forrás hostja nincs engedélyezve: ${url.hostname}`)
  const addresses = await dns.lookup(url.hostname, { all: true })
  if (!addresses.length || addresses.some(x => net.isIP(x.address) && privateIp(x.address))) throw new Error('Privát vagy nem feloldható cím nem engedélyezett.')
  return url.href
}

export function classify(text) {
  const value = text.toLowerCase()
  const trades = [['Burkoló',['burkol']],['Villanyszerelő',['villanyszerelő','vezetékez']],['Kőműves',['kőműves','falaz']],['Tetőfedő',['tető','beáz']],['Festő',['festő','festés']],['Térkövező',['térkő','térkövez']]]
  return trades.find(([, words]) => words.some(word => value.includes(word)))?.[0] || 'Egyéb'
}

export async function insertLead(input, { demo = false, notify = true } = {}) {
  const now = new Date().toISOString()
  let sourceUrl = ''
  if (input.sourceUrl) {
    const parsed = new URL(String(input.sourceUrl))
    if (!['https:','http:'].includes(parsed.protocol)) throw new Error('A forráshivatkozás csak HTTP vagy HTTPS lehet.')
    sourceUrl = parsed.href
  }
  const publishedAt = input.publishedAt ? new Date(input.publishedAt).toISOString() : now
  const fingerprint = crypto.createHash('sha256').update(`${sourceUrl}|${input.submissionId || ''}|${input.title}`.toLowerCase()).digest('hex')
  const lead = {
    id: input.id || crypto.randomUUID(), title: String(input.title).slice(0, 220), excerpt: String(input.excerpt || '').slice(0, 1200),
    city: String(input.city || '').slice(0, 100), county: String(input.county || '').slice(0, 100),
    trade: input.trade || classify(`${input.title} ${input.excerpt || ''}`), source: String(input.source || 'Beküldött lead').slice(0, 100),
    source_url: sourceUrl, published_at: publishedAt, detected_at: now,
    score: Math.max(0, Math.min(100, Number(input.score || 70))), budget: String(input.budget || 'Nincs megadva').slice(0, 100),
    urgent: Number(Boolean(input.urgent || /sürgős|azonnal|beáz/i.test(`${input.title} ${input.excerpt || ''}`))),
    tags: JSON.stringify(Array.isArray(input.tags) ? input.tags.slice(0, 10) : []), tone: String(input.tone || 'Új érdeklődő').slice(0, 100),
    contact_name: String(input.contactName || '').trim().slice(0, 100), contact_email: String(input.contactEmail || '').trim().toLowerCase().slice(0, 180),
    contact_phone: String(input.contactPhone || '').trim().slice(0, 40), submission_id: input.submissionId || null,
    status: input.status || 'active', expires_at: input.expiresAt || null, fingerprint, is_demo: Number(demo),
  }
  const result = await db.insertInto('leads').values(lead).onConflict(conflict => conflict.doNothing()).executeTakeFirst()
  const inserted = Number(result.numInsertedOrUpdatedRows || 0) > 0
  const publicLead = rowsToLeads([lead])[0]
  if (inserted && notify && !demo) await sendLeadPush(publicLead)
  return { inserted, lead: publicLead }
}

export async function pollSources() {
  const sources = await db.selectFrom('sources').selectAll().where('enabled', '=', 1).execute()
  let inserted = 0
  for (const source of sources) {
    try {
      await validateSourceUrl(source.url)
      const feed = await parser.parseURL(source.url)
      const keywords = JSON.parse(source.keywords || '[]')
      const accepted = keywords.length ? keywords : defaultKeywords
      for (const item of (feed.items || []).slice(0, 50)) {
        const text = `${item.title || ''} ${item.contentSnippet || item.content || ''}`
        if (!accepted.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()))) continue
        const result = await insertLead({ title:item.title || 'Új munkalehetőség',excerpt:item.contentSnippet || '',source:source.name,sourceUrl:item.link,publishedAt:item.isoDate || item.pubDate })
        if (result.inserted) inserted++
      }
      await db.updateTable('sources').set({ last_checked_at:new Date().toISOString(),last_error:null }).where('id','=',source.id).execute()
    } catch (error) {
      await db.updateTable('sources').set({ last_checked_at:new Date().toISOString(),last_error:String(error.message).slice(0,500) }).where('id','=',source.id).execute()
    }
  }
  return { sources:sources.length,inserted }
}

export async function listLeads({ search = '', trade = '', county = '', maxAgeHours = 0, limit = 100 } = {}) {
  let query = db.selectFrom('leads').selectAll().where('status','=','active')
    .where(builder => builder.or([builder('expires_at','is',null),builder('expires_at','>',new Date().toISOString())]))
  if (search) query = query.where(builder => builder.or([
    builder('title','like',`%${search}%`),builder('excerpt','like',`%${search}%`),builder('city','like',`%${search}%`),
  ]))
  if (trade) query = query.where('trade','=',trade)
  if (county) query = query.where('county','=',county)
  if (maxAgeHours) query = query.where('published_at','>=',new Date(Date.now()-Number(maxAgeHours)*3600000).toISOString())
  const rows = await query.orderBy('published_at','desc').limit(Math.min(200,Math.max(1,Number(limit)))).execute()
  return rowsToLeads(rows)
}

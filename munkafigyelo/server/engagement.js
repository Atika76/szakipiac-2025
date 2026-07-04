import crypto from 'node:crypto'
import { db } from './db.js'
import { emailConfigured, sendContactEmail } from './email.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function createContactRequest(leadId, input) {
  if (input.website) throw new Error('Spamvédelem aktiválódott.')
  const senderName = String(input.name || '').trim(); const senderEmail = String(input.email || '').trim().toLowerCase()
  const senderPhone = String(input.phone || '').trim(); const message = String(input.message || '').trim()
  if (senderName.length < 2 || senderName.length > 100) throw new Error('A név 2–100 karakter lehet.')
  if (!emailPattern.test(senderEmail)) throw new Error('Érvényes e-mail-cím szükséges.')
  if (senderPhone && !/^[+0-9 ()/-]{7,40}$/.test(senderPhone)) throw new Error('Érvénytelen telefonszám.')
  if (message.length < 20 || message.length > 1500) throw new Error('Az üzenet 20–1500 karakter lehet.')
  const lead = await db.selectFrom('leads').selectAll().where('id','=',leadId).where('status','=','active').executeTakeFirst()
  if (!lead || !lead.contact_email) throw new Error('Ehhez a hirdetéshez nem érhető el kapcsolatfelvételi űrlap.')
  if (String(process.env.PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || '').startsWith('https://') && !emailConfigured) throw new Error('Az e-mail-küldés átmenetileg nem érhető el.')
  const createdAt = new Date().toISOString()
  await db.insertInto('contact_requests').values({ id:crypto.randomUUID(),lead_id:leadId,sender_name:senderName,sender_email:senderEmail,
    sender_phone:senderPhone,message,created_at:createdAt,status:'new' }).execute()
  const sent = await sendContactEmail({ to:lead.contact_email,advertiserName:lead.contact_name || 'Hirdető',leadTitle:lead.title,
    senderName,senderEmail,senderPhone,message })
  return { ok:true,emailSent:sent }
}

export async function createReport(leadId, input) {
  if (input.website) throw new Error('Spamvédelem aktiválódott.')
  const allowed = new Set(['már nem aktuális','hibás adatok','csalásgyanú','személyes adat','egyéb'])
  const reason = String(input.reason || '').trim(); const details = String(input.details || '').trim(); const reporterEmail = String(input.email || '').trim().toLowerCase()
  if (!allowed.has(reason)) throw new Error('Válassz érvényes bejelentési okot.')
  if (details.length > 1000) throw new Error('A részletek legfeljebb 1000 karakteresek lehetnek.')
  if (reporterEmail && !emailPattern.test(reporterEmail)) throw new Error('Érvénytelen e-mail-cím.')
  const lead = await db.selectFrom('leads').select('id').where('id','=',leadId).executeTakeFirst()
  if (!lead) throw new Error('A hirdetés nem található.')
  await db.insertInto('reports').values({ id:crypto.randomUUID(),lead_id:leadId,reason,details,reporter_email:reporterEmail,created_at:new Date().toISOString(),status:'new' }).execute()
  return { ok:true }
}

export async function listContactRequests() {
  return db.selectFrom('contact_requests as c').leftJoin('leads as l','l.id','c.lead_id')
    .select(['c.id','c.lead_id','c.sender_name','c.sender_email','c.sender_phone','c.message','c.created_at','c.status','l.title as lead_title'])
    .orderBy('c.created_at','desc').limit(200).execute()
}

export async function listReports() {
  return db.selectFrom('reports as r').leftJoin('leads as l','l.id','r.lead_id')
    .select(['r.id','r.lead_id','r.reason','r.details','r.reporter_email','r.created_at','r.status','l.title as lead_title'])
    .orderBy('r.created_at','desc').limit(200).execute()
}

export async function resolveReport(id) {
  const result = await db.updateTable('reports').set({ status:'resolved' }).where('id','=',id).executeTakeFirst()
  return Number(result.numUpdatedRows || 0) > 0
}

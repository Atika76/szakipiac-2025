import crypto from 'node:crypto'
import { db } from './db.js'
import { emailConfigured, sendVerificationEmail } from './email.js'
import { insertLead } from './ingest.js'

const trades = new Set(['Burkoló','Villanyszerelő','Kőműves','Tetőfedő','Festő','Térkövező','Ács','Gépész','Vízszerelő','Kertépítő','Bontás','Takarítás','Egyéb'])
const tokenHash = value => crypto.createHash('sha256').update(value).digest('hex')
const newToken = () => crypto.randomBytes(32).toString('base64url')

function validate(input) {
  if (input.website) throw new Error('Spamvédelem aktiválódott.')
  const title = String(input.title || '').trim(); const excerpt = String(input.excerpt || '').trim()
  const city = String(input.city || '').trim(); const county = String(input.county || '').trim(); const trade = String(input.trade || '').trim()
  const contactName = String(input.contactName || '').trim(); const contactEmail = String(input.contactEmail || '').trim().toLowerCase()
  const contactPhone = String(input.contactPhone || '').trim(); const expiryDays = [7,14,30,60].includes(Number(input.expiryDays)) ? Number(input.expiryDays) : 30
  if (title.length < 10 || title.length > 180) throw new Error('A cím 10–180 karakter lehet.')
  if (excerpt.length < 20 || excerpt.length > 1200) throw new Error('A leírás 20–1200 karakter lehet.')
  if (!city || city.length > 100 || county.length > 100) throw new Error('Érvénytelen helyszín.')
  if (!trades.has(trade)) throw new Error('Érvénytelen szakma.')
  if (contactName.length < 2 || contactName.length > 100) throw new Error('A kapcsolattartó neve 2–100 karakter lehet.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) throw new Error('Érvényes e-mail-cím szükséges az ellenőrzéshez.')
  if (contactPhone && !/^[+0-9 ()/-]{7,40}$/.test(contactPhone)) throw new Error('Érvénytelen telefonszám.')
  if (input.consent !== true) throw new Error('A beküldési hozzájárulás szükséges.')
  let sourceUrl = ''
  if (String(input.sourceUrl || '').trim()) {
    let source
    try { source = new URL(String(input.sourceUrl)) } catch { throw new Error('Érvénytelen nyilvános hivatkozás.') }
    if (!['https:','http:'].includes(source.protocol) || ['localhost','127.0.0.1','::1'].includes(source.hostname)) throw new Error('Nyilvános HTTP vagy HTTPS hivatkozás szükséges.')
    sourceUrl = source.href
  }
  return { title,excerpt,city,county,trade,contactName,contactEmail,contactPhone,expiryDays,sourceUrl,budget:String(input.budget || 'Nincs megadva').trim().slice(0,100) }
}

export async function createSubmission(input) {
  const data = validate(input)
  const publicUrl = String(process.env.PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || '')
  if (publicUrl.startsWith('https://') && !emailConfigured) throw new Error('Az e-mail-küldés még nincs beállítva. Kérjük, próbáld később.')
  const id = crypto.randomUUID(); const verifyToken = newToken(); const manageToken = newToken(); const now = new Date()
  const submission = {
    id,title:data.title,excerpt:data.excerpt,city:data.city,county:data.county,trade:data.trade,budget:data.budget,source_url:data.sourceUrl,
    contact_name:data.contactName,contact_email:data.contactEmail,contact_phone:data.contactPhone,submitted_at:now.toISOString(),
    expires_at:new Date(now.getTime()+data.expiryDays*86400000).toISOString(),closed_at:null,status:'unverified',approved_lead_id:null,consent:1,
    email_verified:0,verification_token_hash:tokenHash(verifyToken),manage_token_hash:tokenHash(manageToken),
  }
  await db.insertInto('submissions').values(submission).execute()
  const verification = await sendVerificationEmail({ to:data.contactEmail,name:data.contactName,token:verifyToken })
  return { id,status:'unverified',manageToken,verificationSent:verification.sent,
    debugVerificationUrl:verification.sent || publicUrl.startsWith('https://') ? undefined : verification.url }
}

export async function verifySubmission(token) {
  const row = await db.selectFrom('submissions').selectAll().where('verification_token_hash','=',tokenHash(String(token || '')))
    .where('status','=','unverified').where('submitted_at','>',new Date(Date.now()-24*3600000).toISOString()).executeTakeFirst()
  if (!row) throw new Error('A megerősítő link érvénytelen vagy már felhasználták.')
  await db.updateTable('submissions').set({ email_verified:1,status:'pending',verification_token_hash:null }).where('id','=',row.id).execute()
  return row.id
}

async function managedRow(id, token) {
  const row = await db.selectFrom('submissions').selectAll().where('id','=',id).where('manage_token_hash','=',tokenHash(String(token || ''))).executeTakeFirst()
  if (!row) throw new Error('Érvénytelen hirdetéskezelő hivatkozás.')
  return row
}

export async function getManagedSubmission(id, token) {
  const row = await managedRow(id,token)
  return mapSubmission(row,true)
}

export async function updateManagedSubmission(id, token, input) {
  const current = await managedRow(id,token)
  if (['closed','deleted'].includes(current.status)) throw new Error('A lezárt hirdetés már nem módosítható.')
  const data = validate({ ...input,consent:true })
  const emailChanged = data.contactEmail !== current.contact_email
  const update = { title:data.title,excerpt:data.excerpt,city:data.city,county:data.county,trade:data.trade,budget:data.budget,source_url:data.sourceUrl,
    contact_name:data.contactName,contact_email:data.contactEmail,contact_phone:data.contactPhone,expires_at:new Date(Date.now()+data.expiryDays*86400000).toISOString(),
    status:emailChanged ? 'unverified' : 'pending',email_verified:emailChanged ? 0 : current.email_verified }
  let debugVerificationUrl
  if (emailChanged) {
    const verifyToken = newToken(); update.verification_token_hash = tokenHash(verifyToken)
    const verification = await sendVerificationEmail({ to:data.contactEmail,name:data.contactName,token:verifyToken })
    debugVerificationUrl = verification.sent ? undefined : verification.url
  }
  await db.transaction().execute(async trx => {
    await trx.updateTable('submissions').set(update).where('id','=',id).execute()
    if (current.approved_lead_id) await trx.updateTable('leads').set({ status:'paused' }).where('id','=',current.approved_lead_id).execute()
  })
  return { ok:true,status:update.status,debugVerificationUrl }
}

export async function closeManagedSubmission(id, token) {
  const row = await managedRow(id,token); const now = new Date().toISOString()
  await db.transaction().execute(async trx => {
    await trx.updateTable('submissions').set({ status:'closed',closed_at:now }).where('id','=',id).execute()
    if (row.approved_lead_id) await trx.updateTable('leads').set({ status:'closed' }).where('id','=',row.approved_lead_id).execute()
  })
  return true
}

export async function deleteManagedSubmission(id, token) {
  const row = await managedRow(id,token)
  await db.transaction().execute(async trx => {
    if (row.approved_lead_id) {
      await trx.deleteFrom('contact_requests').where('lead_id','=',row.approved_lead_id).execute()
      await trx.deleteFrom('reports').where('lead_id','=',row.approved_lead_id).execute()
      await trx.deleteFrom('leads').where('id','=',row.approved_lead_id).execute()
    }
    await trx.deleteFrom('submissions').where('id','=',id).execute()
  })
  return true
}

function mapSubmission(row, includePrivate = false) {
  const result = { id:row.id,title:row.title,excerpt:row.excerpt,city:row.city,county:row.county,trade:row.trade,budget:row.budget,
    sourceUrl:row.source_url,submittedAt:row.submitted_at,expiresAt:row.expires_at,status:row.status,approvedLeadId:row.approved_lead_id,emailVerified:Boolean(row.email_verified) }
  if (includePrivate) Object.assign(result,{ contactName:row.contact_name,contactEmail:row.contact_email,contactPhone:row.contact_phone })
  return result
}

export async function listSubmissions(status = 'pending') {
  const rows = await db.selectFrom('submissions').selectAll().where('status','=',status).orderBy('submitted_at','desc').limit(200).execute()
  return rows.map(row=>mapSubmission(row,true))
}

export async function approveSubmission(id) {
  const row = await db.selectFrom('submissions').selectAll().where('id','=',id).where('status','=','pending').where('email_verified','=',1).executeTakeFirst()
  if (!row) throw new Error('A hirdetés nem található, nincs megerősítve vagy már elbírálták.')
  let result
  if (row.approved_lead_id) {
    const now = new Date().toISOString()
    await db.updateTable('leads').set({ title:row.title,excerpt:row.excerpt,city:row.city,county:row.county,trade:row.trade,budget:row.budget,
      source_url:row.source_url,contact_name:row.contact_name,contact_email:row.contact_email,contact_phone:row.contact_phone,published_at:now,detected_at:now,
      expires_at:row.expires_at,status:'active',tone:'Ellenőrzött ügyfélhirdetés' }).where('id','=',row.approved_lead_id).execute()
    result = { inserted:false,lead:(await db.selectFrom('leads').selectAll().where('id','=',row.approved_lead_id).executeTakeFirst()) }
  } else {
    result = await insertLead({ title:row.title,excerpt:row.excerpt,city:row.city,county:row.county,trade:row.trade,budget:row.budget,
      source:'SzakiLead megrendelő',sourceUrl:row.source_url,score:85,tone:'Ellenőrzött ügyfélhirdetés',contactName:row.contact_name,
      contactEmail:row.contact_email,contactPhone:row.contact_phone,submissionId:row.id,expiresAt:row.expires_at },{notify:true})
  }
  const leadId = row.approved_lead_id || result.lead.id
  await db.updateTable('submissions').set({ status:'active',approved_lead_id:leadId }).where('id','=',id).execute()
  return { ...result,leadId }
}

export async function rejectSubmission(id) {
  const result = await db.updateTable('submissions').set({ status:'rejected' }).where('id','=',id).where('status','=','pending').executeTakeFirst()
  return Number(result.numUpdatedRows || 0) > 0
}

export async function expireSubmissions() {
  const now = new Date().toISOString()
  const expired = await db.selectFrom('submissions').select(['id','approved_lead_id']).where('expires_at','<=',now).where('status','in',['pending','active']).execute()
  if (!expired.length) return 0
  await db.transaction().execute(async trx => {
    await trx.updateTable('submissions').set({ status:'expired',closed_at:now }).where('id','in',expired.map(row=>row.id)).execute()
    const leadIds = expired.map(row=>row.approved_lead_id).filter(Boolean)
    if (leadIds.length) await trx.updateTable('leads').set({ status:'expired' }).where('id','in',leadIds).execute()
  })
  return expired.length
}

import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { parseCookie, stringifySetCookie } from 'cookie'
import { db } from './db.js'
import { sendPasswordResetEmail } from './email.js'

const cookieName = 'sl_admin'
const sessionMs = 7 * 86400000
const tokenHash = token => crypto.createHash('sha256').update(token).digest('hex')
const newToken = () => crypto.randomBytes(32).toString('base64url')

export async function initializeAdmin() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const password = String(process.env.ADMIN_PASSWORD || '')
  if (!email || password.length < 12) return
  const existing = await db.selectFrom('admin_users').select('id').where('email','=',email).executeTakeFirst()
  if (existing) return
  const now = new Date().toISOString()
  await db.insertInto('admin_users').values({ id:crypto.randomUUID(),email,password_hash:await bcrypt.hash(password,12),created_at:now,updated_at:now }).execute()
}

function setSessionCookie(res, token, maxAge = Math.floor(sessionMs/1000)) {
  const secure = String(process.env.PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || '').startsWith('https://')
  res.setHeader('Set-Cookie',stringifySetCookie({ name:cookieName,value:token,httpOnly:true,secure,sameSite:'strict',path:'/',maxAge }))
}

export async function loginAdmin(email, password, res) {
  const user = await db.selectFrom('admin_users').selectAll().where('email','=',String(email || '').trim().toLowerCase()).executeTakeFirst()
  if (!user || !await bcrypt.compare(String(password || ''),user.password_hash)) return false
  const token = newToken(); const now = new Date(); const expires = new Date(now.getTime()+sessionMs)
  await db.insertInto('admin_sessions').values({ token_hash:tokenHash(token),user_id:user.id,created_at:now.toISOString(),expires_at:expires.toISOString() }).execute()
  setSessionCookie(res,token)
  return { id:user.id,email:user.email }
}

export async function logoutAdmin(req, res) {
  const token = parseCookie(req.headers.cookie || '')[cookieName]
  if (token) await db.deleteFrom('admin_sessions').where('token_hash','=',tokenHash(token)).execute()
  setSessionCookie(res,'',0)
}

export async function requireAdmin(req, res, next) {
  try {
    const token = parseCookie(req.headers.cookie || '')[cookieName]
    if (!token) return res.status(401).json({ error:'Bejelentkezés szükséges.' })
    const session = await db.selectFrom('admin_sessions as s').innerJoin('admin_users as u','u.id','s.user_id')
      .select(['u.id','u.email','s.expires_at']).where('s.token_hash','=',tokenHash(token)).where('s.expires_at','>',new Date().toISOString()).executeTakeFirst()
    if (!session) return res.status(401).json({ error:'A munkamenet lejárt.' })
    req.admin = { id:session.id,email:session.email }
    next()
  } catch (error) { next(error) }
}

export async function requestPasswordReset(email) {
  const user = await db.selectFrom('admin_users').selectAll().where('email','=',String(email || '').trim().toLowerCase()).executeTakeFirst()
  if (!user) return true
  const token = newToken(); const now = new Date(); const expires = new Date(now.getTime()+30*60000)
  await db.deleteFrom('password_resets').where('user_id','=',user.id).execute()
  await db.insertInto('password_resets').values({ token_hash:tokenHash(token),user_id:user.id,created_at:now.toISOString(),expires_at:expires.toISOString(),used_at:null }).execute()
  await sendPasswordResetEmail({ to:user.email,token })
  return process.env.NODE_ENV === 'production' ? true : token
}

export async function resetPassword(token, password) {
  if (String(password || '').length < 12) throw new Error('A jelszó legalább 12 karakteres legyen.')
  const reset = await db.selectFrom('password_resets').selectAll().where('token_hash','=',tokenHash(String(token || '')))
    .where('used_at','is',null).where('expires_at','>',new Date().toISOString()).executeTakeFirst()
  if (!reset) throw new Error('A visszaállító link érvénytelen vagy lejárt.')
  const now = new Date().toISOString()
  await db.transaction().execute(async trx => {
    await trx.updateTable('admin_users').set({ password_hash:await bcrypt.hash(password,12),updated_at:now }).where('id','=',reset.user_id).execute()
    await trx.updateTable('password_resets').set({ used_at:now }).where('token_hash','=',reset.token_hash).execute()
    await trx.deleteFrom('admin_sessions').where('user_id','=',reset.user_id).execute()
  })
  return true
}

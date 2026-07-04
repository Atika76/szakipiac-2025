import nodemailer from 'nodemailer'

const appUrl = String(process.env.PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || `http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 4174}`).replace(/\/$/,'')

export const emailConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM)

let transporter
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]))
function mailer() {
  if (!emailConfigured) return null
  if (!transporter) transporter = nodemailer.createTransport({
    host:process.env.SMTP_HOST,
    port:Number(process.env.SMTP_PORT || 587),
    secure:String(process.env.SMTP_SECURE || 'false') === 'true',
    auth:{ user:process.env.SMTP_USER,password:process.env.SMTP_PASS },
  })
  return transporter
}

export function absoluteUrl(path) {
  return `${appUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export async function sendEmail({ to, subject, text, html }) {
  const client = mailer()
  if (!client) return false
  await client.sendMail({ from:process.env.MAIL_FROM,to,subject,text,html })
  return true
}

export async function sendVerificationEmail({ to, name, token }) {
  const url = absoluteUrl(`/api/submissions/verify?token=${encodeURIComponent(token)}`)
  const sent = await sendEmail({
    to, subject:'Erősítsd meg a SzakiLead hirdetésedet',
    text:`Kedves ${name}! Erősítsd meg a hirdetésedet ezen a linken: ${url}`,
    html:`<p>Kedves ${escapeHtml(name)}!</p><p>A hirdetésed ellenőrzéséhez erősítsd meg az e-mail-címedet:</p><p><a href="${url}">Hirdetés megerősítése</a></p><p>A link 24 órán belül használható.</p>`,
  })
  return { sent, url }
}

export async function sendContactEmail({ to, advertiserName, leadTitle, senderName, senderEmail, senderPhone, message }) {
  return sendEmail({
    to, subject:`Új érdeklődő: ${leadTitle}`,
    text:`Kedves ${advertiserName}!\n\n${senderName} érdeklődik a hirdetésed iránt.\nE-mail: ${senderEmail}\nTelefon: ${senderPhone || 'nincs megadva'}\n\nÜzenet:\n${message}`,
    html:`<p>Kedves ${escapeHtml(advertiserName)}!</p><p><b>${escapeHtml(senderName)}</b> érdeklődik a(z) „${escapeHtml(leadTitle)}” hirdetés iránt.</p><p>E-mail: ${escapeHtml(senderEmail)}<br>Telefon: ${escapeHtml(senderPhone || 'nincs megadva')}</p><p>${escapeHtml(message).replace(/\n/g,'<br>')}</p>`,
  })
}

export async function sendPasswordResetEmail({ to, token }) {
  const url = absoluteUrl(`/admin.html?reset=${encodeURIComponent(token)}`)
  return sendEmail({
    to, subject:'SzakiLead admin jelszó-visszaállítás',
    text:`Új admin jelszó beállítása: ${url}`,
    html:`<p>Az admin jelszó visszaállításához kattints:</p><p><a href="${url}">Új jelszó beállítása</a></p><p>A link 30 percig érvényes.</p>`,
  })
}

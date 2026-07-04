import webpush from 'web-push'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from './db.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const keyFile = path.join(root, 'data', 'vapid-keys.json')
let keys

function keysFromSeed(seed) {
  const privateKey = crypto.createHash('sha256').update(`szakilead-vapid:${seed}`).digest()
  const ecdh = crypto.createECDH('prime256v1')
  ecdh.setPrivateKey(privateKey)
  return {
    privateKey: privateKey.toString('base64url'),
    publicKey: ecdh.getPublicKey(undefined, 'uncompressed').toString('base64url'),
  }
}

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY }
} else if (process.env.VAPID_KEY_SEED) {
  keys = keysFromSeed(process.env.VAPID_KEY_SEED)
} else if (fs.existsSync(keyFile)) {
  keys = JSON.parse(fs.readFileSync(keyFile, 'utf8'))
} else {
  keys = webpush.generateVAPIDKeys()
  fs.writeFileSync(keyFile, JSON.stringify(keys, null, 2), { mode: 0o600 })
}

webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.hu', keys.publicKey, keys.privateKey)
export const publicVapidKey = keys.publicKey

function matches(filters, lead) {
  if (filters.urgentOnly && !lead.urgent) return false
  if (Number(filters.minScore || 0) > lead.score) return false
  if (filters.trades?.length && !filters.trades.includes(lead.trade)) return false
  if (filters.counties?.length && !filters.counties.includes(lead.county)) return false
  return true
}

export async function sendLeadPush(lead) {
  const rows = await db.selectFrom('subscriptions').selectAll().execute()
  const results = await Promise.allSettled(rows.map(async row => {
    const filters = JSON.parse(row.filters || '{}')
    if (!matches(filters, lead)) return { skipped: true }
    try {
      await webpush.sendNotification(JSON.parse(row.subscription), JSON.stringify({
        title: lead.urgent ? `🚨 Sürgős ${lead.trade.toLowerCase()} munka` : `Új ${lead.trade.toLowerCase()} munka`,
        body: `${lead.city || lead.county}: ${lead.title}`,
        url: `/?lead=${encodeURIComponent(lead.id)}`,
        tag: `lead-${lead.id}`,
      }), { TTL: 3600, urgency: lead.urgent ? 'high' : 'normal' })
      return { sent: true }
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) await db.deleteFrom('subscriptions').where('endpoint','=',row.endpoint).execute()
      throw error
    }
  }))
  return { sent: results.filter(r => r.status === 'fulfilled' && r.value?.sent).length, failed: results.filter(r => r.status === 'rejected').length }
}

export async function sendWelcomePush(subscription) {
  await webpush.sendNotification(subscription, JSON.stringify({
    title: 'SzakiLead értesítések bekapcsolva',
    body: 'Mostantól azonnal szólunk a beállításaidnak megfelelő új munkákról.',
    url: '/', tag: 'push-welcome',
  }), { TTL: 300 })
}

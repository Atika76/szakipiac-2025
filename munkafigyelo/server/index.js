import 'dotenv/config'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import cron from 'node-cron'
import { db, initializeDatabase, usingPostgres } from './db.js'
import { insertLead, listLeads, pollSources, validateSourceUrl } from './ingest.js'
import { publicVapidKey, sendWelcomePush } from './push.js'
import { seedDemo } from './seed.js'
import { pollTed } from './ted.js'
import { analyticsSummary, recordEvent } from './analytics.js'
import { approveSubmission, closeManagedSubmission, createSubmission, deleteManagedSubmission, expireSubmissions, getManagedSubmission,
  listSubmissions, rejectSubmission, updateManagedSubmission, verifySubmission } from './submissions.js'
import { createContactRequest, createReport, listContactRequests, listReports, resolveReport } from './engagement.js'
import { initializeAdmin, loginAdmin, logoutAdmin, requestPasswordReset, requireAdmin, resetPassword } from './auth.js'

await initializeDatabase()
await initializeAdmin()

const app = express()
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.PORT || 4174)
const host = process.env.HOST || '127.0.0.1'

app.set('trust proxy', 1)
app.use(helmet({ contentSecurityPolicy:{ directives:{ defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com'],imgSrc:["'self'",'data:'],connectSrc:["'self'"] } } }))
app.use(express.json({ limit:'64kb' }))
app.use('/api',rateLimit({ windowMs:60000,limit:180,standardHeaders:'draft-7',legacyHeaders:false }))

app.use('/api',(req,res,next) => {
  if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next()
  const origin = req.get('origin')
  const expected = `${req.protocol}://${req.get('host')}`
  if (origin && origin !== expected) return res.status(403).json({ error:'Érvénytelen kérésforrás.' })
  next()
})

const limiter = (limit,minutes=60) => rateLimit({ windowMs:minutes*60000,limit,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Túl sok próbálkozás. Próbáld újra később.'} })
const submissionLimiter = limiter(5); const contactLimiter = limiter(10); const reportLimiter = limiter(5); const loginLimiter = limiter(10,15)
const asyncRoute = handler => (req,res,next) => Promise.resolve(handler(req,res,next)).catch(next)
const normalizePushFilters = input => ({
  trades:Array.isArray(input?.trades)?input.trades.slice(0,20).map(value=>String(value).slice(0,80)):[],
  counties:Array.isArray(input?.counties)?input.counties.slice(0,30).map(value=>String(value).slice(0,80)):[],
  minScore:Math.max(0,Math.min(100,Number(input?.minScore || 0))),urgentOnly:Boolean(input?.urgentOnly),
})

app.get('/api/health',(_req,res)=>res.json({ ok:true,database:usingPostgres?'postgresql':'sqlite',push:true,email:Boolean(process.env.SMTP_HOST),time:new Date().toISOString() }))
app.get('/api/config',(_req,res)=>res.json({ vapidPublicKey:publicVapidKey,pushSupported:true,
  operatorName:process.env.OPERATOR_NAME || 'SzakiLead üzemeltető',contactEmail:process.env.CONTACT_EMAIL || '' }))
app.get('/api/leads',asyncRoute(async(req,res)=>res.json({ leads:await listLeads(req.query) })))
app.post('/api/events',asyncRoute(async(req,res)=>{ await recordEvent(req.body || {});res.status(204).end() }))

app.post('/api/submissions',submissionLimiter,asyncRoute(async(req,res)=>res.status(201).json({ ok:true,submission:await createSubmission(req.body || {}) })))
app.get('/api/submissions/verify',asyncRoute(async(req,res)=>{ await verifySubmission(req.query.token);res.redirect('/?verified=1') }))
app.get('/api/submissions/:id/manage',asyncRoute(async(req,res)=>res.json({ submission:await getManagedSubmission(req.params.id,req.get('x-manage-token')) })))
app.put('/api/submissions/:id/manage',submissionLimiter,asyncRoute(async(req,res)=>res.json(await updateManagedSubmission(req.params.id,req.get('x-manage-token'),req.body || {}))))
app.post('/api/submissions/:id/close',asyncRoute(async(req,res)=>res.json({ ok:await closeManagedSubmission(req.params.id,req.get('x-manage-token')) })))
app.delete('/api/submissions/:id',asyncRoute(async(req,res)=>res.json({ ok:await deleteManagedSubmission(req.params.id,req.get('x-manage-token')) })))
app.post('/api/leads/:id/contact',contactLimiter,asyncRoute(async(req,res)=>res.status(201).json(await createContactRequest(req.params.id,req.body || {}))))
app.post('/api/leads/:id/report',reportLimiter,asyncRoute(async(req,res)=>res.status(201).json(await createReport(req.params.id,req.body || {}))))

app.post('/api/push/subscribe',asyncRoute(async(req,res)=>{
  const subscription = req.body?.subscription
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) return res.status(400).json({ error:'Hiányos push-előfizetés.' })
  const now = new Date().toISOString(); const values = { endpoint:subscription.endpoint,subscription:JSON.stringify(subscription),filters:JSON.stringify(normalizePushFilters(req.body.filters)),created_at:now,updated_at:now }
  await db.insertInto('subscriptions').values(values).onConflict(conflict=>conflict.column('endpoint').doUpdateSet({ subscription:values.subscription,filters:values.filters,updated_at:now })).execute()
  await sendWelcomePush(subscription);res.status(201).json({ ok:true })
}))
app.put('/api/push/preferences',asyncRoute(async(req,res)=>{
  if (!req.body?.endpoint) return res.status(400).json({ error:'Hiányzó végpont.' })
  const result = await db.updateTable('subscriptions').set({ filters:JSON.stringify(normalizePushFilters(req.body.filters)),updated_at:new Date().toISOString() }).where('endpoint','=',req.body.endpoint).executeTakeFirst()
  res.json({ ok:Number(result.numUpdatedRows || 0)>0 })
}))
app.delete('/api/push/subscribe',asyncRoute(async(req,res)=>{ if(!req.body?.endpoint)return res.status(400).json({error:'Hiányzó végpont.'});await db.deleteFrom('subscriptions').where('endpoint','=',req.body.endpoint).execute();res.json({ok:true}) }))

app.post('/api/auth/login',loginLimiter,asyncRoute(async(req,res)=>{
  const user = await loginAdmin(req.body?.email,req.body?.password,res)
  if (!user) return res.status(401).json({ error:'Hibás e-mail-cím vagy jelszó.' })
  res.json({ ok:true,user })
}))
app.post('/api/auth/logout',asyncRoute(async(req,res)=>{ await logoutAdmin(req,res);res.json({ok:true}) }))
app.get('/api/auth/me',requireAdmin,(req,res)=>res.json({ user:req.admin }))
app.post('/api/auth/forgot',loginLimiter,asyncRoute(async(req,res)=>{ const token=await requestPasswordReset(req.body?.email);res.json({ok:true,debugToken:typeof token==='string'?token:undefined}) }))
app.post('/api/auth/reset',loginLimiter,asyncRoute(async(req,res)=>{ await resetPassword(req.body?.token,req.body?.password);res.json({ok:true}) }))

app.post('/api/admin/leads',requireAdmin,asyncRoute(async(req,res)=>{
  if (!req.body?.title || !req.body?.sourceUrl) return res.status(400).json({ error:'A title és sourceUrl kötelező.' })
  const result=await insertLead(req.body,{notify:true});res.status(result.inserted?201:200).json(result)
}))
app.get('/api/admin/sources',requireAdmin,asyncRoute(async(_req,res)=>res.json({ sources:await db.selectFrom('sources').selectAll().orderBy('id','desc').execute() })))
app.get('/api/admin/analytics',requireAdmin,asyncRoute(async(_req,res)=>res.json(await analyticsSummary())))
app.get('/api/admin/submissions',requireAdmin,asyncRoute(async(req,res)=>res.json({ submissions:await listSubmissions(req.query.status || 'pending') })))
app.post('/api/admin/submissions/:id/approve',requireAdmin,asyncRoute(async(req,res)=>res.json(await approveSubmission(req.params.id))))
app.post('/api/admin/submissions/:id/reject',requireAdmin,asyncRoute(async(req,res)=>res.json({ ok:await rejectSubmission(req.params.id) })))
app.get('/api/admin/contacts',requireAdmin,asyncRoute(async(_req,res)=>res.json({ contacts:await listContactRequests() })))
app.get('/api/admin/reports',requireAdmin,asyncRoute(async(_req,res)=>res.json({ reports:await listReports() })))
app.post('/api/admin/reports/:id/resolve',requireAdmin,asyncRoute(async(req,res)=>res.json({ ok:await resolveReport(req.params.id) })))
app.post('/api/admin/sources',requireAdmin,asyncRoute(async(req,res)=>{
  const url=await validateSourceUrl(req.body?.url);const id=String(Date.now())
  await db.insertInto('sources').values({ id,name:String(req.body.name || new URL(url).hostname).slice(0,100),url,type:'rss',enabled:1,keywords:JSON.stringify(req.body.keywords || []),last_checked_at:null,last_error:null }).execute()
  res.status(201).json({id,url})
}))
app.post('/api/admin/poll',requireAdmin,asyncRoute(async(_req,res)=>res.json(await pollSources())))
app.post('/api/admin/ted/poll',requireAdmin,asyncRoute(async(_req,res)=>res.json(await pollTed())))

if (process.env.NODE_ENV === 'production' || fs.existsSync(path.join(root,'dist'))) {
  app.use(express.static(path.join(root,'dist'),{maxAge:'1h',etag:true}))
  app.get(/.*/,(_req,res)=>res.sendFile(path.join(root,'dist','index.html')))
}

app.use((error,_req,res,_next)=>{
  const requestId=crypto.randomUUID();console.error(`[${requestId}]`,error)
  const expected=/szükséges|karakter|érvénytelen|Spamvédelem|hivatkozás|kapcsolattartó|telefonszám|e-mail|hirdetés|lejárt|módosítható|nem található|átmenetileg/i.test(error.message)
  res.status(expected?400:500).json({error:expected?error.message:'Szerverhiba történt.',requestId})
})

if (process.env.SEED_DEMO==='true' && !await db.selectFrom('leads').select('id').limit(1).executeTakeFirst()) await seedDemo()
cron.schedule('*/5 * * * *',()=>pollSources().catch(error=>console.error('RSS polling failed',error)))
cron.schedule('12 * * * *',()=>pollTed().catch(error=>console.error('TED polling failed',error)))
cron.schedule('27 3 * * *',async()=>{
  try { const now=new Date();await expireSubmissions();await db.deleteFrom('analytics_events').where('created_at','<',new Date(now.getTime()-180*86400000).toISOString()).execute();await db.deleteFrom('contact_requests').where('created_at','<',new Date(now.getTime()-180*86400000).toISOString()).execute();await db.deleteFrom('reports').where('created_at','<',new Date(now.getTime()-365*86400000).toISOString()).execute();await db.deleteFrom('admin_sessions').where('expires_at','<',now.toISOString()).execute() }
  catch(error){console.error('Cleanup failed',error)}
})
setTimeout(()=>pollTed().then(result=>console.log('TED sync',result)).catch(error=>console.error('Initial TED sync failed',error)),3000)
app.listen(port,host,()=>console.log(`SzakiLead Pro: http://${host}:${port}`))

import crypto from 'node:crypto'
import { sql } from 'kysely'
import { db, usingPostgres } from './db.js'

const allowedEvents = new Set(['page_view','lead_open','source_click','push_enable','push_disable','share_click','submission_open','submission_sent','search_used','contact_sent','report_sent'])

export async function recordEvent(input) {
  const eventName = String(input.event || '')
  const sessionId = String(input.sessionId || '')
  if (!allowedEvents.has(eventName) || !/^[a-zA-Z0-9-]{16,64}$/.test(sessionId)) return false
  const safeMetadata = {}
  for (const key of ['trade','county','source']) if (typeof input.metadata?.[key] === 'string') safeMetadata[key] = input.metadata[key].slice(0,80)
  const values = { id:crypto.randomUUID(),session_id:sessionId,event_name:eventName,lead_id:input.leadId ? String(input.leadId).slice(0,100) : null,metadata:JSON.stringify(safeMetadata),created_at:new Date().toISOString() }
  try { await db.insertInto('analytics_events').values(values).execute() }
  catch (error) {
    if (usingPostgres) throw error
    const { id, ...legacyValues } = values
    await db.insertInto('analytics_events').values(legacyValues).execute()
  }
  return true
}

async function count(builder) {
  const row = await builder.select(sql`count(*)`.as('count')).executeTakeFirst()
  return Number(row?.count || 0)
}

async function distinctSessions(builder) {
  const row = await builder.select(sql`count(distinct session_id)`.as('count')).executeTakeFirst()
  return Number(row?.count || 0)
}

export async function analyticsSummary() {
  const since = days => new Date(Date.now()-days*86400000).toISOString()
  const events7d = since(7); const events30d = since(30); const today = new Date().toISOString().slice(0,10)
  const base = () => db.selectFrom('analytics_events')
  const [visitorsToday,visitors7d,visitors30d,pageViews7d,leadOpens7d,sourceClicks7d,shares7d,pushEnables7d,submissionsPending,pushSubscribers,topLeads,daily] = await Promise.all([
    distinctSessions(base().where('created_at','>=',`${today}T00:00:00.000Z`)),
    distinctSessions(base().where('created_at','>=',events7d)), distinctSessions(base().where('created_at','>=',events30d)),
    count(base().where('event_name','=','page_view').where('created_at','>=',events7d)),
    count(base().where('event_name','=','lead_open').where('created_at','>=',events7d)),
    count(base().where('event_name','=','source_click').where('created_at','>=',events7d)),
    count(base().where('event_name','=','share_click').where('created_at','>=',events7d)),
    count(base().where('event_name','=','push_enable').where('created_at','>=',events7d)),
    count(db.selectFrom('submissions').where('status','=','pending')), count(db.selectFrom('subscriptions')),
    db.selectFrom('analytics_events as e').leftJoin('leads as l','l.id','e.lead_id')
      .select(['e.lead_id','l.title','l.source',sql`count(*)`.as('opens')]).where('e.event_name','=','lead_open').where('e.created_at','>=',events30d)
      .groupBy(['e.lead_id','l.title','l.source']).orderBy('opens','desc').limit(10).execute(),
    db.selectFrom('analytics_events').select([
      sql`substr(created_at,1,10)`.as('day'),sql`count(distinct session_id)`.as('visitors'),
      sql`sum(case when event_name='page_view' then 1 else 0 end)`.as('views'),sql`sum(case when event_name='lead_open' then 1 else 0 end)`.as('opens'),
    ]).where('created_at','>=',events30d).groupBy(sql`substr(created_at,1,10)`).orderBy('day').execute(),
  ])
  return { visitorsToday,visitors7d,visitors30d,pageViews7d,leadOpens7d,sourceClicks7d,shares7d,pushEnables7d,submissionsPending,pushSubscribers,
    topLeads:topLeads.map(row=>({...row,opens:Number(row.opens)})),daily:daily.map(row=>({...row,visitors:Number(row.visitors),views:Number(row.views),opens:Number(row.opens)})) }
}

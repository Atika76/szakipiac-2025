import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { Kysely, PostgresDialect, SqliteDialect, sql } from 'kysely'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(root, 'data')
fs.mkdirSync(dataDir, { recursive: true })

export const usingPostgres = Boolean(process.env.DATABASE_URL)
const dialect = usingPostgres
  ? new PostgresDialect({
      pool: new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
        max: 5,
      }),
    })
  : new SqliteDialect({
      database: new Database(process.env.DB_PATH || path.join(dataDir, 'szakilead.db')),
    })

export const db = new Kysely({ dialect })

async function createTables() {
  await db.schema.createTable('leads').ifNotExists()
    .addColumn('id', 'varchar(100)', column => column.primaryKey())
    .addColumn('title', 'text', column => column.notNull())
    .addColumn('excerpt', 'text', column => column.notNull().defaultTo(''))
    .addColumn('city', 'varchar(100)', column => column.notNull().defaultTo(''))
    .addColumn('county', 'varchar(100)', column => column.notNull().defaultTo(''))
    .addColumn('trade', 'varchar(100)', column => column.notNull().defaultTo('Egyéb'))
    .addColumn('source', 'varchar(100)', column => column.notNull())
    .addColumn('source_url', 'text', column => column.notNull().defaultTo(''))
    .addColumn('published_at', 'varchar(40)', column => column.notNull())
    .addColumn('detected_at', 'varchar(40)', column => column.notNull())
    .addColumn('score', 'integer', column => column.notNull().defaultTo(50))
    .addColumn('budget', 'varchar(100)', column => column.notNull().defaultTo('Nincs megadva'))
    .addColumn('urgent', 'integer', column => column.notNull().defaultTo(0))
    .addColumn('tags', 'text', column => column.notNull().defaultTo('[]'))
    .addColumn('tone', 'varchar(100)', column => column.notNull().defaultTo('Új érdeklődő'))
    .addColumn('contact_name', 'varchar(100)', column => column.notNull().defaultTo(''))
    .addColumn('contact_email', 'varchar(180)', column => column.notNull().defaultTo(''))
    .addColumn('contact_phone', 'varchar(40)', column => column.notNull().defaultTo(''))
    .addColumn('submission_id', 'varchar(100)')
    .addColumn('status', 'varchar(30)', column => column.notNull().defaultTo('active'))
    .addColumn('expires_at', 'varchar(40)')
    .addColumn('fingerprint', 'varchar(100)', column => column.notNull().unique())
    .addColumn('is_demo', 'integer', column => column.notNull().defaultTo(0))
    .execute()

  await db.schema.createTable('subscriptions').ifNotExists()
    .addColumn('endpoint', 'text', column => column.primaryKey())
    .addColumn('subscription', 'text', column => column.notNull())
    .addColumn('filters', 'text', column => column.notNull().defaultTo('{}'))
    .addColumn('created_at', 'varchar(40)', column => column.notNull())
    .addColumn('updated_at', 'varchar(40)', column => column.notNull())
    .execute()

  await db.schema.createTable('sources').ifNotExists()
    .addColumn('id', 'varchar(100)', column => column.primaryKey())
    .addColumn('name', 'varchar(100)', column => column.notNull())
    .addColumn('url', 'text', column => column.notNull().unique())
    .addColumn('type', 'varchar(30)', column => column.notNull().defaultTo('rss'))
    .addColumn('enabled', 'integer', column => column.notNull().defaultTo(1))
    .addColumn('keywords', 'text', column => column.notNull().defaultTo('[]'))
    .addColumn('last_checked_at', 'varchar(40)')
    .addColumn('last_error', 'text')
    .execute()

  await db.schema.createTable('analytics_events').ifNotExists()
    .addColumn('id', 'varchar(100)', column => column.primaryKey())
    .addColumn('session_id', 'varchar(100)', column => column.notNull())
    .addColumn('event_name', 'varchar(80)', column => column.notNull())
    .addColumn('lead_id', 'varchar(100)')
    .addColumn('metadata', 'text', column => column.notNull().defaultTo('{}'))
    .addColumn('created_at', 'varchar(40)', column => column.notNull())
    .execute()

  await db.schema.createTable('submissions').ifNotExists()
    .addColumn('id', 'varchar(100)', column => column.primaryKey())
    .addColumn('title', 'text', column => column.notNull())
    .addColumn('excerpt', 'text', column => column.notNull())
    .addColumn('city', 'varchar(100)', column => column.notNull())
    .addColumn('county', 'varchar(100)', column => column.notNull().defaultTo(''))
    .addColumn('trade', 'varchar(100)', column => column.notNull())
    .addColumn('budget', 'varchar(100)', column => column.notNull().defaultTo('Nincs megadva'))
    .addColumn('source_url', 'text', column => column.notNull().defaultTo(''))
    .addColumn('contact_name', 'varchar(100)', column => column.notNull().defaultTo(''))
    .addColumn('contact_email', 'varchar(180)', column => column.notNull().defaultTo(''))
    .addColumn('contact_phone', 'varchar(40)', column => column.notNull().defaultTo(''))
    .addColumn('submitted_at', 'varchar(40)', column => column.notNull())
    .addColumn('expires_at', 'varchar(40)')
    .addColumn('closed_at', 'varchar(40)')
    .addColumn('status', 'varchar(30)', column => column.notNull().defaultTo('unverified'))
    .addColumn('approved_lead_id', 'varchar(100)')
    .addColumn('consent', 'integer', column => column.notNull().defaultTo(1))
    .addColumn('email_verified', 'integer', column => column.notNull().defaultTo(0))
    .addColumn('verification_token_hash', 'varchar(100)')
    .addColumn('manage_token_hash', 'varchar(100)')
    .execute()

  await db.schema.createTable('contact_requests').ifNotExists()
    .addColumn('id', 'varchar(100)', column => column.primaryKey())
    .addColumn('lead_id', 'varchar(100)', column => column.notNull())
    .addColumn('sender_name', 'varchar(100)', column => column.notNull())
    .addColumn('sender_email', 'varchar(180)', column => column.notNull())
    .addColumn('sender_phone', 'varchar(40)', column => column.notNull().defaultTo(''))
    .addColumn('message', 'text', column => column.notNull())
    .addColumn('created_at', 'varchar(40)', column => column.notNull())
    .addColumn('status', 'varchar(30)', column => column.notNull().defaultTo('new'))
    .execute()

  await db.schema.createTable('reports').ifNotExists()
    .addColumn('id', 'varchar(100)', column => column.primaryKey())
    .addColumn('lead_id', 'varchar(100)', column => column.notNull())
    .addColumn('reason', 'varchar(100)', column => column.notNull())
    .addColumn('details', 'text', column => column.notNull().defaultTo(''))
    .addColumn('reporter_email', 'varchar(180)', column => column.notNull().defaultTo(''))
    .addColumn('created_at', 'varchar(40)', column => column.notNull())
    .addColumn('status', 'varchar(30)', column => column.notNull().defaultTo('new'))
    .execute()

  await db.schema.createTable('admin_users').ifNotExists()
    .addColumn('id', 'varchar(100)', column => column.primaryKey())
    .addColumn('email', 'varchar(180)', column => column.notNull().unique())
    .addColumn('password_hash', 'text', column => column.notNull())
    .addColumn('created_at', 'varchar(40)', column => column.notNull())
    .addColumn('updated_at', 'varchar(40)', column => column.notNull())
    .execute()

  await db.schema.createTable('admin_sessions').ifNotExists()
    .addColumn('token_hash', 'varchar(100)', column => column.primaryKey())
    .addColumn('user_id', 'varchar(100)', column => column.notNull())
    .addColumn('created_at', 'varchar(40)', column => column.notNull())
    .addColumn('expires_at', 'varchar(40)', column => column.notNull())
    .execute()

  await db.schema.createTable('password_resets').ifNotExists()
    .addColumn('token_hash', 'varchar(100)', column => column.primaryKey())
    .addColumn('user_id', 'varchar(100)', column => column.notNull())
    .addColumn('created_at', 'varchar(40)', column => column.notNull())
    .addColumn('expires_at', 'varchar(40)', column => column.notNull())
    .addColumn('used_at', 'varchar(40)')
    .execute()
}

async function ensureLegacyColumns() {
  const additions = {
    leads: [
      ['submission_id', 'VARCHAR(100)'], ['status', "VARCHAR(30) NOT NULL DEFAULT 'active'"], ['expires_at', 'VARCHAR(40)'],
    ],
    submissions: [
      ['expires_at', 'VARCHAR(40)'], ['closed_at', 'VARCHAR(40)'], ['email_verified', 'INTEGER NOT NULL DEFAULT 0'],
      ['verification_token_hash', 'VARCHAR(100)'], ['manage_token_hash', 'VARCHAR(100)'],
    ],
  }
  for (const [table, columns] of Object.entries(additions)) {
    for (const [name, definition] of columns) {
      try { await sql.raw(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`).execute(db) } catch { /* already exists */ }
    }
  }
}

async function createIndexes() {
  const indexes = [
    ['idx_leads_published', 'leads', ['published_at']], ['idx_leads_status', 'leads', ['status', 'expires_at']],
    ['idx_events_created', 'analytics_events', ['created_at']], ['idx_events_name', 'analytics_events', ['event_name', 'created_at']],
    ['idx_submissions_status', 'submissions', ['status', 'submitted_at']], ['idx_contact_lead', 'contact_requests', ['lead_id', 'created_at']],
    ['idx_reports_status', 'reports', ['status', 'created_at']], ['idx_sessions_expiry', 'admin_sessions', ['expires_at']],
  ]
  for (const [name, table, columns] of indexes) {
    try { await db.schema.createIndex(name).ifNotExists().on(table).columns(columns).execute() } catch { /* legacy database */ }
  }
}

export async function initializeDatabase() {
  await createTables()
  await ensureLegacyColumns()
  await createIndexes()
}

export function rowsToLeads(rows) {
  return rows.map(row => ({
    id: row.id, title: row.title, excerpt: row.excerpt, city: row.city, county: row.county,
    trade: row.trade, source: row.source, sourceUrl: row.source_url,
    publishedAt: row.published_at, detectedAt: row.detected_at, score: row.score,
    budget: row.budget, urgent: Boolean(row.urgent), tags: JSON.parse(row.tags || '[]'),
    tone: row.tone, isDemo: Boolean(row.is_demo), status: row.status || 'active', expiresAt: row.expires_at || null,
    hasContactForm: Boolean(row.contact_email),
  }))
}

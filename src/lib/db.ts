import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.DATABASE_PATH || './data/budget.db'
const resolvedPath = path.resolve(process.cwd(), DB_PATH)

// Ensure data directory exists
const dir = path.dirname(resolvedPath)
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(resolvedPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
  }
  return db
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_fixed INTEGER DEFAULT 0,
      monthly_target INTEGER DEFAULT 0,
      color TEXT DEFAULT '#6366f1',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS business_category_map (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_name_normalized TEXT NOT NULL UNIQUE,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      confidence TEXT DEFAULT 'manual',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      source_type TEXT NOT NULL,
      uploaded_at TEXT DEFAULT (datetime('now')),
      row_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upload_id INTEGER REFERENCES uploads(id),
      transaction_date TEXT NOT NULL,
      billing_date TEXT,
      business_name TEXT NOT NULL,
      business_name_normalized TEXT NOT NULL,
      amount INTEGER NOT NULL,
      original_amount REAL,
      original_currency TEXT DEFAULT '₪',
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      transaction_type TEXT NOT NULL,
      source TEXT NOT NULL,
      card_last4 TEXT,
      notes TEXT,
      max_transaction_kind TEXT,
      is_excluded INTEGER DEFAULT 0,
      review_needed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS monthly_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL UNIQUE,
      expense_target INTEGER DEFAULT 0,
      savings_target INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS idx_transactions_normalized ON transactions(business_name_normalized);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
  `)

  seedCategories(db)
}

function seedCategories(db: Database.Database) {
  const existing = db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number }
  if (existing.c > 0) return

  const categories = [
    { name: 'מזון וצריכה', is_fixed: 0, color: '#22c55e' },
    { name: 'מסעדות, קפה וברים', is_fixed: 0, color: '#f97316' },
    { name: 'אופנה', is_fixed: 0, color: '#ec4899' },
    { name: 'חשמל ומחשבים', is_fixed: 0, color: '#6366f1' },
    { name: 'פנאי, בידור וספורט', is_fixed: 0, color: '#8b5cf6' },
    { name: 'שירותי תקשורת', is_fixed: 1, color: '#0ea5e9' },
    { name: 'ביטוח', is_fixed: 1, color: '#64748b' },
    { name: 'דלק, חשמל וגז', is_fixed: 0, color: '#eab308' },
    { name: 'עירייה וממשלה', is_fixed: 1, color: '#94a3b8' },
    { name: 'העברת כספים', is_fixed: 0, color: '#71717a' },
    { name: 'בריאות', is_fixed: 0, color: '#10b981' },
    { name: 'דיור', is_fixed: 1, color: '#f59e0b' },
    { name: 'רכב', is_fixed: 1, color: '#3b82f6' },
    { name: 'חינוך', is_fixed: 1, color: '#a855f7' },
    { name: 'שונות', is_fixed: 0, color: '#9ca3af' },
  ]

  const insert = db.prepare(
    'INSERT OR IGNORE INTO categories (name, is_fixed, color) VALUES (?, ?, ?)'
  )
  for (const cat of categories) {
    insert.run(cat.name, cat.is_fixed, cat.color)
  }
}

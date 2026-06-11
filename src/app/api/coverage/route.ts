import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()

  // Max: covered billing months
  const maxMonths = new Set(
    (db.prepare(`
      SELECT DISTINCT substr(billing_date, 1, 7) as m
      FROM transactions WHERE source = 'max' AND billing_date IS NOT NULL
    `).all() as Array<{ m: string }>).map(r => r.m)
  )

  // Bank: covered months
  const bankMonths = new Set(
    (db.prepare(`
      SELECT DISTINCT substr(transaction_date, 1, 7) as m
      FROM transactions WHERE source = 'bank'
    `).all() as Array<{ m: string }>).map(r => r.m)
  )

  // Build a grid for the past 18 months
  const months: string[] = []
  const now = new Date()
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return NextResponse.json(
    months.map(m => ({
      month: m,
      hasMax: maxMonths.has(m),
      hasBank: bankMonths.has(m),
    }))
  )
}

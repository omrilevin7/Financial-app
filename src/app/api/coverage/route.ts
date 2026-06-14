import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()

  // Coverage is expressed in budget months (what each month's dashboard shows).
  // Max budget_month already = billing month - 1.
  const maxMonths = new Set(
    (db.prepare(`
      SELECT DISTINCT budget_month as m
      FROM transactions WHERE source = 'max' AND budget_month IS NOT NULL
    `).all() as Array<{ m: string }>).map(r => r.m)
  )

  const bankMonths = new Set(
    (db.prepare(`
      SELECT DISTINCT budget_month as m
      FROM transactions WHERE source = 'bank' AND budget_month IS NOT NULL
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

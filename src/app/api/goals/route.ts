import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const db = getDb()
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')

  if (month) {
    const row = db.prepare('SELECT * FROM monthly_goals WHERE month = ?').get(month)
    return NextResponse.json(row ?? { month, expense_target: 0, savings_target: 0 })
  }

  const rows = db.prepare('SELECT * FROM monthly_goals ORDER BY month DESC').all()
  return NextResponse.json(rows)
}

export async function PUT(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const { month, expense_target, savings_target } = body

  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

  db.prepare(`
    INSERT INTO monthly_goals (month, expense_target, savings_target, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(month) DO UPDATE SET
      expense_target = excluded.expense_target,
      savings_target = excluded.savings_target,
      updated_at = datetime('now')
  `).run(month, expense_target ?? 0, savings_target ?? 0)

  return NextResponse.json({ month, expense_target, savings_target })
}

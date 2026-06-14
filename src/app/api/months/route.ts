import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const rows = db.prepare(`
    SELECT budget_month as month, COUNT(*) as tx_count
    FROM transactions
    WHERE is_excluded = 0 AND budget_month IS NOT NULL
    GROUP BY budget_month
    ORDER BY budget_month DESC
  `).all() as Array<{ month: string; tx_count: number }>

  return NextResponse.json(rows)
}

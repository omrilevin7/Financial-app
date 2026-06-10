import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const rows = db.prepare(`
    SELECT DISTINCT substr(transaction_date, 1, 7) as month, COUNT(*) as tx_count
    FROM transactions
    WHERE is_excluded = 0
    GROUP BY month
    ORDER BY month DESC
  `).all() as Array<{ month: string; tx_count: number }>

  return NextResponse.json(rows)
}

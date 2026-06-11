import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()

  const rows = db.prepare(`
    SELECT
      u.id,
      u.filename,
      u.source_type,
      u.uploaded_at,
      u.row_count,
      MIN(t.transaction_date) as date_from,
      MAX(t.transaction_date) as date_to,
      COUNT(t.id) as transaction_count,
      SUM(CASE WHEN t.is_excluded = 1 THEN 1 ELSE 0 END) as excluded_count
    FROM uploads u
    LEFT JOIN transactions t ON t.upload_id = u.id
    GROUP BY u.id
    ORDER BY u.uploaded_at DESC
  `).all() as Array<{
    id: number
    filename: string
    source_type: string
    uploaded_at: string
    row_count: number
    date_from: string | null
    date_to: string | null
    transaction_count: number
    excluded_count: number
  }>

  return NextResponse.json(rows)
}

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const db = getDb()
  const { searchParams } = new URL(req.url)

  const month = searchParams.get('month')
  const type = searchParams.get('type')        // 'expense' | 'income' | 'review'
  const category = searchParams.get('category') // category id or 'uncategorized'
  const excludeHidden = searchParams.get('exclude_excluded') !== 'false'

  let query = `
    SELECT t.*, c.name as category_name, c.color as category_color, c.is_fixed
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE 1=1
  `
  const params: (string | number)[] = []

  if (month) {
    query += ` AND substr(t.transaction_date, 1, 7) = ?`
    params.push(month)
  }

  if (type === 'review') {
    query += ` AND t.review_needed = 1`
  } else if (type === 'expense') {
    query += ` AND t.transaction_type IN ('expense', 'refund', 'cheque')`
  } else if (type === 'income') {
    query += ` AND t.transaction_type = 'income'`
  }

  if (category === 'uncategorized') {
    query += ` AND t.category_id IS NULL AND t.is_excluded = 0`
  } else if (category) {
    query += ` AND t.category_id = ?`
    params.push(Number(category))
  }

  if (excludeHidden) {
    query += ` AND t.is_excluded = 0`
  }

  query += ` ORDER BY t.transaction_date DESC, t.id DESC`

  const rows = db.prepare(query).all(...params)
  return NextResponse.json(rows)
}

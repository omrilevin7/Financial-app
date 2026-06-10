import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()
  const body = await req.json()

  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as {
    id: number; business_name_normalized: string; review_needed: number
  } | undefined

  if (!tx) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (body.category_id !== undefined) {
    // Update this transaction
    db.prepare(
      'UPDATE transactions SET category_id = ?, review_needed = 0 WHERE id = ?'
    ).run(body.category_id, id)

    // Update the business → category mapping (retroactive)
    db.prepare(`
      INSERT OR REPLACE INTO business_category_map
        (business_name_normalized, category_id, confidence, updated_at)
      VALUES (?, ?, 'manual', datetime('now'))
    `).run(tx.business_name_normalized, body.category_id)

    // Retroactively update ALL transactions with the same normalized business name
    // that haven't been manually overridden (confidence != 'manual' mapping OR same mapping)
    db.prepare(`
      UPDATE transactions SET category_id = ?, review_needed = 0
      WHERE business_name_normalized = ?
        AND id != ?
    `).run(body.category_id, tx.business_name_normalized, id)
  }

  if (body.transaction_type !== undefined) {
    db.prepare(
      'UPDATE transactions SET transaction_type = ?, review_needed = 0 WHERE id = ?'
    ).run(body.transaction_type, id)
  }

  if (body.review_needed !== undefined) {
    db.prepare(
      'UPDATE transactions SET review_needed = ? WHERE id = ?'
    ).run(body.review_needed ? 1 : 0, id)
  }

  const updated = db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color
    FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.id = ?
  `).get(id)

  return NextResponse.json(updated)
}

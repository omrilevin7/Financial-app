import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()
  const body = await req.json()

  const allowed = ['name', 'is_fixed', 'monthly_target', 'color']
  const updates = Object.entries(body)
    .filter(([k]) => allowed.includes(k))
    .map(([k, v]) => ({ key: k, value: v }))

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const setClauses = updates.map(u => `${u.key} = ?`).join(', ')
  const values = updates.map(u => u.value)

  db.prepare(`UPDATE categories SET ${setClauses} WHERE id = ?`).run(...values, id)

  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id)
  return NextResponse.json(updated)
}

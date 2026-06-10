import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM categories ORDER BY name').all()
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const { name, is_fixed = 0, monthly_target = 0, color = '#6366f1' } = body

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const result = db.prepare(
    'INSERT INTO categories (name, is_fixed, monthly_target, color) VALUES (?, ?, ?, ?)'
  ).run(name, is_fixed ? 1 : 0, monthly_target, color)

  return NextResponse.json({ id: result.lastInsertRowid, name, is_fixed, monthly_target, color })
}

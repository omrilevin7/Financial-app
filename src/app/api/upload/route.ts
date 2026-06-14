import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { parseMaxFile } from '@/lib/parsers/max'
import { parseBankDiscountFile } from '@/lib/parsers/bank-discount'
import { categorizeBusinessNames } from '@/lib/categorize'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const sourceType = formData.get('source_type') as string  // 'max' | 'bank'

  if (!file || !sourceType) {
    return NextResponse.json({ error: 'Missing file or source_type' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const db = getDb()

  // Parse file
  let transactions: ReturnType<typeof parseMaxFile> | ReturnType<typeof parseBankDiscountFile>
  try {
    if (sourceType === 'max') {
      transactions = parseMaxFile(buffer)
    } else if (sourceType === 'bank') {
      transactions = parseBankDiscountFile(buffer)
    } else {
      return NextResponse.json({ error: 'Invalid source_type' }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ error: `Failed to parse file: ${err}` }, { status: 400 })
  }

  if (transactions.length === 0) {
    return NextResponse.json({ error: 'No transactions found in file' }, { status: 400 })
  }

  // Create upload record
  const upload = db.prepare(
    'INSERT INTO uploads (filename, source_type, row_count) VALUES (?, ?, ?)'
  ).run(file.name, sourceType, transactions.length)

  const uploadId = upload.lastInsertRowid

  // Get all existing business mappings
  const existingMappings = db.prepare(
    'SELECT business_name_normalized, category_id, confidence FROM business_category_map'
  ).all() as Array<{ business_name_normalized: string; category_id: number | null; confidence: string }>

  const mappingMap = new Map(existingMappings.map(m => [m.business_name_normalized, m]))

  // Find unique business names that need categorization (not in mapping, not excluded)
  const unknownBusinesses = new Map<string, { normalized: string; original: string; max_hint: string | null }>()
  for (const tx of transactions) {
    if (!tx.is_excluded && tx.transaction_type === 'expense' && !mappingMap.has(tx.business_name_normalized)) {
      unknownBusinesses.set(tx.business_name_normalized, {
        normalized: tx.business_name_normalized,
        original: tx.business_name,
        max_hint: tx.max_category_hint ?? null,
      })
    }
  }

  // Categorize unknown businesses with Claude
  let newMappings: Array<{ business_name_normalized: string; category_id: number | null; confidence: 'high' | 'low' }> = []
  if (unknownBusinesses.size > 0) {
    newMappings = await categorizeBusinessNames(Array.from(unknownBusinesses.values()))

    const insertMapping = db.prepare(
      `INSERT OR REPLACE INTO business_category_map
       (business_name_normalized, category_id, confidence, updated_at)
       VALUES (?, ?, ?, datetime('now'))`
    )
    for (const mapping of newMappings) {
      insertMapping.run(mapping.business_name_normalized, mapping.category_id, mapping.confidence)
    }

    // Add to local map for transaction insertion
    for (const mapping of newMappings) {
      mappingMap.set(mapping.business_name_normalized, mapping)
    }
  }

  // Insert transactions — skip duplicates by (business_name_normalized, amount, billing_date, source)
  // This allows re-uploading the same file safely, and uploading multiple billing cycles
  // without double-counting (each installment payment has a unique billing_date)
  const insertTx = db.prepare(`
    INSERT INTO transactions (
      upload_id, transaction_date, billing_date, business_name, business_name_normalized,
      amount, original_amount, original_currency, category_id, transaction_type,
      source, card_last4, notes, max_transaction_kind, is_excluded, review_needed
    )
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT 1 FROM transactions
      WHERE business_name_normalized = ?
        AND amount = ?
        AND billing_date = ?
        AND source = ?
    )
  `)

  const insertMany = db.transaction(() => {
    let inserted = 0
    for (const tx of transactions) {
      const mapping = mappingMap.get(tx.business_name_normalized)
      const categoryId = mapping?.category_id ?? null
      const needsReview = !tx.is_excluded
        && tx.transaction_type !== 'income'
        && tx.transaction_type !== 'transfer'
        && tx.transaction_type !== 'credit_card_settlement'
        && (tx.transaction_type === 'cheque' || !categoryId)
      const reviewNeeded = needsReview ? 1 : 0

      const billingDate = tx.billing_date ?? tx.transaction_date
      const r = insertTx.run(
        // INSERT values
        uploadId, tx.transaction_date, billingDate,
        tx.business_name, tx.business_name_normalized,
        tx.amount, tx.original_amount, tx.original_currency,
        categoryId, tx.transaction_type, tx.source,
        tx.card_last4 ?? null, tx.notes ?? null,
        tx.max_transaction_kind ?? null, tx.is_excluded, reviewNeeded,
        // WHERE NOT EXISTS values
        tx.business_name_normalized, tx.amount, billingDate, tx.source,
      )
      if (r.changes > 0) inserted++
    }
    return inserted
  })

  const inserted = insertMany()

  const reviewCount = (db.prepare(
    'SELECT COUNT(*) as c FROM transactions WHERE upload_id = ? AND review_needed = 1'
  ).get(uploadId) as { c: number }).c

  return NextResponse.json({
    success: true,
    upload_id: uploadId,
    total: inserted,
    skipped_duplicates: transactions.length - inserted,
    review_needed: reviewCount,
  })
}

import * as XLSX from 'xlsx'
import { normalizeBusinessName, billingToBudgetMonth } from '../utils'

export interface ParsedTransaction {
  transaction_date: string
  billing_date: string
  budget_month: string  // YYYY-MM the expense is counted in (billing month - 1)
  business_name: string
  business_name_normalized: string
  amount: number  // in agorot
  original_amount: number
  original_currency: string
  transaction_type: string
  source: 'max'
  card_last4: string | null
  notes: string | null
  max_transaction_kind: string
  is_excluded: 0 | 1
  review_needed: 0
  max_category_hint: string | null
}

function parseIsraeliDate(dateStr: string): string {
  // Format: DD-MM-YYYY → YYYY-MM-DD
  const [day, month, year] = dateStr.split('-')
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function parseMaxSheet(sheet: XLSX.WorkSheet): ParsedTransaction[] {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

  // Find the header row (contains 'תאריך עסקה')
  let headerIdx = -1
  for (let i = 0; i < rows.length; i++) {
    if (Array.isArray(rows[i]) && rows[i].includes('תאריך עסקה')) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) return []

  const headers = rows[headerIdx] as string[]
  const colIdx = (name: string) => headers.indexOf(name)

  const results: ParsedTransaction[] = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    if (!row || !row[colIdx('תאריך עסקה')]) continue

    const txDateRaw = String(row[colIdx('תאריך עסקה')] ?? '')
    const billingDateRaw = String(row[colIdx('תאריך חיוב')] ?? '')
    const businessName = String(row[colIdx('שם בית העסק')] ?? '').trim()
    const kind = String(row[colIdx('סוג עסקה')] ?? '')
    const chargeAmount = Number(row[colIdx('סכום חיוב')] ?? 0)
    const originalAmount = Number(row[colIdx('סכום עסקה מקורי')] ?? chargeAmount)
    const chargeCurrency = String(row[colIdx('מטבע חיוב')] ?? '₪')
    const originalCurrency = String(row[colIdx('מטבע עסקה מקורי')] ?? '₪')
    const last4 = String(row[colIdx('4 ספרות אחרונות של כרטיס האשראי')] ?? '')
    const notes = row[colIdx('הערות')] ? String(row[colIdx('הערות')]) : null
    const maxCategory = row[colIdx('קטגוריה')] ? String(row[colIdx('קטגוריה')]) : null

    if (!businessName || !txDateRaw) continue

    // transaction_date keeps the real purchase date (תאריך עסקה) for display.
    // budget_month drives all budgeting: Max billing is deferred, so a charge
    // billed on the 2nd of a month covers the previous calendar month. This is
    // applied uniformly to regular AND installment rows — each installment
    // payment's own billing date lands it in its correct budget month.
    const purchaseDate = parseIsraeliDate(txDateRaw)
    const billingDate = billingDateRaw ? parseIsraeliDate(billingDateRaw) : purchaseDate
    const budgetMonth = billingToBudgetMonth(billingDate)

    // Credit transactions (קרדיט) are refunds - use negative amount
    const isCredit = kind === 'קרדיט'
    const amountInAgorot = Math.round((isCredit ? -chargeAmount : chargeAmount) * 100)

    results.push({
      transaction_date: purchaseDate,
      billing_date: billingDate,
      budget_month: budgetMonth,
      business_name: businessName,
      business_name_normalized: normalizeBusinessName(businessName),
      amount: amountInAgorot,
      original_amount: originalAmount,
      original_currency: originalCurrency !== chargeCurrency ? originalCurrency : '₪',
      transaction_type: isCredit ? 'refund' : 'expense',
      source: 'max',
      card_last4: last4 || null,
      notes,
      max_transaction_kind: kind,
      is_excluded: 0,
      review_needed: 0,
      max_category_hint: maxCategory,
    })
  }

  return results
}

export function parseMaxFile(buffer: ArrayBuffer): ParsedTransaction[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const results: ParsedTransaction[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    results.push(...parseMaxSheet(sheet))
  }

  return results
}

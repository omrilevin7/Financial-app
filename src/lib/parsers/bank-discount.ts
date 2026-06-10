import * as XLSX from 'xlsx'
import { normalizeBusinessName } from '../utils'

export interface ParsedBankTransaction {
  transaction_date: string
  business_name: string
  business_name_normalized: string
  amount: number  // in agorot, positive = income, negative = expense
  transaction_type: string
  source: 'bank'
  card_last4: null
  notes: string | null
  max_transaction_kind: null
  is_excluded: 0 | 1
  review_needed: 0 | 1
  billing_date: null
  original_amount: number
  original_currency: '₪'
  max_category_hint: null
}

// Patterns that identify Max credit card settlement payments → auto-exclude
const CREDIT_CARD_SETTLEMENT_PATTERNS = [
  'מקס איט פי חיוב',
  'חיוב לכרטיס ממקס',  // direct charge to Max card from bank
  'max it pay',
  'max it fi',
]

// Income patterns — positive amounts with these in description
const INCOME_PATTERNS = [
  'משכורת',
  'ביטוח לאומי',
  'מענק',
  'החזר',
  'הח שיק',  // returned cheque = income
  'הפקדת שיק',
  'העברה מ',
]

// Transfer patterns (Bit/PayBox from bank side — already counted in credit card)
const TRANSFER_OUT_PATTERNS = [
  'bit',
  'ביט',
  'paybox',
  'פייבוקס',
]

function classifyBankTransaction(desc: string, amount: number): {
  transaction_type: string
  is_excluded: 0 | 1
  review_needed: 0 | 1
} {
  const lower = desc.toLowerCase()

  // Credit card settlements → excluded
  if (CREDIT_CARD_SETTLEMENT_PATTERNS.some(p => lower.includes(p.toLowerCase()))) {
    return { transaction_type: 'credit_card_settlement', is_excluded: 1, review_needed: 0 }
  }

  // Positive amounts
  if (amount > 0) {
    if (INCOME_PATTERNS.some(p => lower.includes(p.toLowerCase()))) {
      return { transaction_type: 'income', is_excluded: 0, review_needed: 0 }
    }
    // Unknown positive → flag for review
    return { transaction_type: 'income', is_excluded: 0, review_needed: 1 }
  }

  // Cheques
  if (lower.includes('שיק') || lower.includes('cheque') || lower.includes('check')) {
    return { transaction_type: 'cheque', is_excluded: 0, review_needed: 1 }
  }

  // Bank fees
  if (lower.includes('עמלה') || lower.includes('מינימום') || lower.includes('ריבית')) {
    return { transaction_type: 'expense', is_excluded: 0, review_needed: 0 }
  }

  // Transfers out (Bit/PayBox from bank account side)
  // These are NOT excluded because Bit/PayBox transactions from credit card are already
  // captured in Max. Bank side Bit transactions are *additional* direct bank transfers.
  if (TRANSFER_OUT_PATTERNS.some(p => lower.includes(p))) {
    return { transaction_type: 'transfer', is_excluded: 0, review_needed: 0 }
  }

  // Outgoing transfers
  if (lower.includes('העברה ל') || lower.includes('הע. ל')) {
    return { transaction_type: 'transfer', is_excluded: 0, review_needed: 0 }
  }

  return { transaction_type: 'expense', is_excluded: 0, review_needed: 0 }
}

function excelDateToString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().split('T')[0]
  }
  if (typeof value === 'number') {
    // Excel serial date
    const date = new Date(Math.round((value - 25569) * 86400 * 1000))
    return date.toISOString().split('T')[0]
  }
  if (typeof value === 'string') {
    // Try ISO or DD/MM/YYYY
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.split('T')[0]
    if (/^\d{2}\/\d{2}\/\d{4}/.test(value)) {
      const [d, m, y] = value.split('/')
      return `${y}-${m}-${d}`
    }
  }
  return new Date().toISOString().split('T')[0]
}

export function parseBankDiscountFile(buffer: ArrayBuffer): ParsedBankTransaction[] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

  // Find header row (contains 'תאריך')
  let headerIdx = -1
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    if (Array.isArray(row) && row.some(c => String(c ?? '').includes('תאריך'))) {
      if (row.some(c => String(c ?? '').includes('תיאור'))) {
        headerIdx = i
        break
      }
    }
  }
  if (headerIdx === -1) return []

  const headers = (rows[headerIdx] as unknown[]).map(h => String(h ?? ''))
  const colIdx = (name: string) => headers.findIndex(h => h.includes(name))

  const dateCol = colIdx('תאריך')
  const descCol = colIdx('תיאור')
  const amountCol = colIdx('זכות/חובה')

  const results: ParsedBankTransaction[] = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    if (!row || !row[dateCol]) continue

    const dateVal = row[dateCol]
    const desc = String(row[descCol] ?? '').trim()
    const amountRaw = Number(row[amountCol] ?? 0)

    if (!desc || isNaN(amountRaw)) continue

    const txDate = excelDateToString(dateVal)
    // Always store as positive absolute value; transaction_type determines direction
    const amountInAgorot = Math.round(Math.abs(amountRaw) * 100)
    const { transaction_type, is_excluded, review_needed } = classifyBankTransaction(desc, amountRaw)

    results.push({
      transaction_date: txDate,
      business_name: desc,
      business_name_normalized: normalizeBusinessName(desc),
      amount: amountInAgorot,
      original_amount: Math.abs(amountRaw),
      original_currency: '₪',
      transaction_type,
      source: 'bank',
      card_last4: null,
      notes: null,
      max_transaction_kind: null,
      is_excluded,
      review_needed,
      billing_date: null,
      max_category_hint: null,
    })
  }

  return results
}

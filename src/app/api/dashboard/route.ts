import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { daysInMonth } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const db = getDb()
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') ?? getCurrentMonth()

  // Current month expenses (non-excluded, non-income)
  const expenseRows = db.prepare(`
    SELECT
      t.category_id,
      c.name as category_name,
      c.color,
      c.is_fixed,
      c.monthly_target,
      SUM(CASE WHEN t.transaction_type != 'refund' THEN t.amount ELSE 0 END) as total_charged,
      SUM(CASE WHEN t.transaction_type = 'refund' THEN ABS(t.amount) ELSE 0 END) as total_refunds,
      COUNT(*) as tx_count
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE substr(t.transaction_date, 1, 7) = ?
      AND t.is_excluded = 0
      AND t.transaction_type IN ('expense', 'refund', 'cheque')
    GROUP BY t.category_id
    ORDER BY total_charged DESC
  `).all(month) as Array<{
    category_id: number | null
    category_name: string | null
    color: string | null
    is_fixed: number
    monthly_target: number
    total_charged: number
    total_refunds: number
    tx_count: number
  }>

  const totalExpenses = expenseRows.reduce((s, r) => s + (r.total_charged - r.total_refunds), 0)

  // Income this month
  const incomeRow = db.prepare(`
    SELECT SUM(amount) as total
    FROM transactions
    WHERE substr(transaction_date, 1, 7) = ?
      AND transaction_type = 'income'
      AND is_excluded = 0
  `).get(month) as { total: number | null }
  const totalIncome = incomeRow.total ?? 0

  // Last transaction date (to show data freshness)
  const lastTxRow = db.prepare(`
    SELECT MAX(transaction_date) as last_date
    FROM transactions
    WHERE substr(transaction_date, 1, 7) = ? AND is_excluded = 0
  `).get(month) as { last_date: string | null }
  const lastDataDate = lastTxRow.last_date

  // Projection: based on pace through the month
  let projectedExpenses = totalExpenses
  if (lastDataDate) {
    const daysCovered = new Date(lastDataDate).getDate()
    const totalDays = daysInMonth(month)
    if (daysCovered > 0 && daysCovered < totalDays) {
      projectedExpenses = Math.round((totalExpenses / daysCovered) * totalDays)
    }
  }

  // Goals
  const goals = db.prepare(
    'SELECT * FROM monthly_goals WHERE month = ?'
  ).get(month) as { expense_target: number; savings_target: number } | undefined

  // Previous month savings
  const prevMonth = getPrevMonth(month)
  const prevExpenses = (db.prepare(`
    SELECT SUM(amount) as total FROM transactions
    WHERE substr(transaction_date, 1, 7) = ?
      AND is_excluded = 0
      AND transaction_type IN ('expense', 'refund', 'cheque')
  `).get(prevMonth) as { total: number | null }).total ?? 0

  const prevIncome = (db.prepare(`
    SELECT SUM(amount) as total FROM transactions
    WHERE substr(transaction_date, 1, 7) = ?
      AND transaction_type = 'income' AND is_excluded = 0
  `).get(prevMonth) as { total: number | null }).total ?? 0

  const prevSavings = prevIncome - prevExpenses

  // YTD savings (from Jan 1 of current year)
  const year = month.split('-')[0]
  const ytdExpenses = (db.prepare(`
    SELECT SUM(amount) as total FROM transactions
    WHERE transaction_date >= ? AND transaction_date <= ?
      AND is_excluded = 0
      AND transaction_type IN ('expense', 'refund', 'cheque')
  `).get(`${year}-01-01`, `${month}-31`) as { total: number | null }).total ?? 0

  const ytdIncome = (db.prepare(`
    SELECT SUM(amount) as total FROM transactions
    WHERE transaction_date >= ? AND transaction_date <= ?
      AND is_excluded = 0 AND transaction_type = 'income'
  `).get(`${year}-01-01`, `${month}-31`) as { total: number | null }).total ?? 0

  const ytdSavings = ytdIncome - ytdExpenses

  // Review count
  const reviewCount = (db.prepare(
    'SELECT COUNT(*) as c FROM transactions WHERE review_needed = 1'
  ).get() as { c: number }).c

  // Fixed expenses detail
  const fixedRows = db.prepare(`
    SELECT t.business_name, t.amount, c.name as category_name, t.transaction_date
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE substr(t.transaction_date, 1, 7) = ?
      AND c.is_fixed = 1
      AND t.is_excluded = 0
      AND t.transaction_type IN ('expense', 'cheque')
    ORDER BY t.amount DESC
  `).all(month)

  const fixedTotal = (fixedRows as Array<{ amount: number }>).reduce((s, r) => s + r.amount, 0)

  // Data coverage: which sources have transactions for this month
  const coverage = db.prepare(`
    SELECT source, COUNT(*) as c
    FROM transactions
    WHERE substr(transaction_date, 1, 7) = ? AND is_excluded = 0
    GROUP BY source
  `).all(month) as Array<{ source: string; c: number }>

  const hasMax = coverage.some(r => r.source === 'max')
  const hasBank = coverage.some(r => r.source === 'bank')

  return NextResponse.json({
    month,
    totalExpenses,
    totalIncome,
    projectedExpenses,
    lastDataDate,
    savings: totalIncome - totalExpenses,
    goals: goals ?? { expense_target: 0, savings_target: 0 },
    prevMonthSavings: prevSavings,
    ytdSavings,
    reviewCount,
    coverage: { hasMax, hasBank },
    categories: expenseRows.map(r => ({
      ...r,
      net: r.total_charged - r.total_refunds,
      pct: totalExpenses > 0 ? Math.round(((r.total_charged - r.total_refunds) / totalExpenses) * 100) : 0,
    })),
    fixedExpenses: fixedRows,
    fixedTotal,
  })
}

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getPrevMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

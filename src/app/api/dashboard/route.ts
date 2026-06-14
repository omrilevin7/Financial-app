import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { daysInMonth } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const db = getDb()
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') ?? getCurrentMonth()

  // Expenses for this budget month (non-excluded, non-income).
  // budget_month already accounts for credit-card billing deferral.
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
    WHERE t.budget_month = ?
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

  // Income this budget month
  const incomeRow = db.prepare(`
    SELECT SUM(amount) as total
    FROM transactions
    WHERE budget_month = ?
      AND transaction_type = 'income'
      AND is_excluded = 0
  `).get(month) as { total: number | null }
  const totalIncome = incomeRow.total ?? 0

  // Last transaction date in this budget month (data freshness)
  const lastTxRow = db.prepare(`
    SELECT MAX(transaction_date) as last_date
    FROM transactions
    WHERE budget_month = ? AND is_excluded = 0
  `).get(month) as { last_date: string | null }
  const lastDataDate = lastTxRow.last_date

  // Projection: only meaningful for the current calendar month, based on
  // how far we are through the month.
  let projectedExpenses = totalExpenses
  if (month === getCurrentMonth()) {
    const today = new Date().getDate()
    const totalDays = daysInMonth(month)
    if (today > 0 && today < totalDays) {
      projectedExpenses = Math.round((totalExpenses / today) * totalDays)
    }
  }

  // Goals
  const goals = db.prepare(
    'SELECT * FROM monthly_goals WHERE month = ?'
  ).get(month) as { expense_target: number; savings_target: number } | undefined

  // Previous budget month savings
  const prevMonth = getPrevMonth(month)
  const prevExpenses = (db.prepare(`
    SELECT SUM(amount) as total FROM transactions
    WHERE budget_month = ?
      AND is_excluded = 0
      AND transaction_type IN ('expense', 'refund', 'cheque')
  `).get(prevMonth) as { total: number | null }).total ?? 0

  const prevIncome = (db.prepare(`
    SELECT SUM(amount) as total FROM transactions
    WHERE budget_month = ?
      AND transaction_type = 'income' AND is_excluded = 0
  `).get(prevMonth) as { total: number | null }).total ?? 0

  const prevSavings = prevIncome - prevExpenses

  // YTD savings: all budget months in the same year up to and including this one
  const year = month.split('-')[0]
  const ytdExpenses = (db.prepare(`
    SELECT SUM(amount) as total FROM transactions
    WHERE budget_month >= ? AND budget_month <= ?
      AND is_excluded = 0
      AND transaction_type IN ('expense', 'refund', 'cheque')
  `).get(`${year}-01`, month) as { total: number | null }).total ?? 0

  const ytdIncome = (db.prepare(`
    SELECT SUM(amount) as total FROM transactions
    WHERE budget_month >= ? AND budget_month <= ?
      AND is_excluded = 0 AND transaction_type = 'income'
  `).get(`${year}-01`, month) as { total: number | null }).total ?? 0

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
    WHERE t.budget_month = ?
      AND c.is_fixed = 1
      AND t.is_excluded = 0
      AND t.transaction_type IN ('expense', 'cheque')
    ORDER BY t.amount DESC
  `).all(month)

  const fixedTotal = (fixedRows as Array<{ amount: number }>).reduce((s, r) => s + r.amount, 0)

  // Data coverage: which sources have transactions for this budget month
  const coverage = db.prepare(`
    SELECT source, COUNT(*) as c
    FROM transactions
    WHERE budget_month = ? AND is_excluded = 0
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

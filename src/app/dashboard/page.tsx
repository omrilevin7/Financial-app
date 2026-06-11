'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'
import {
  TrendingDown, TrendingUp, Target, ChevronDown, ChevronRight,
  Edit2, Check, X, ArrowUpDown, Upload
} from 'lucide-react'

interface DashboardData {
  month: string
  totalExpenses: number
  totalIncome: number
  projectedExpenses: number
  lastDataDate: string | null
  savings: number
  goals: { expense_target: number; savings_target: number }
  prevMonthSavings: number
  ytdSavings: number
  reviewCount: number
  coverage: { hasMax: boolean; hasBank: boolean }
  categories: CategoryRow[]
  fixedExpenses: FixedRow[]
  fixedTotal: number
}

interface CategoryRow {
  category_id: number | null
  category_name: string | null
  color: string | null
  is_fixed: number
  monthly_target: number
  net: number
  pct: number
  tx_count: number
}

interface FixedRow {
  business_name: string
  amount: number
  category_name: string | null
  transaction_date: string
}

const MONTHS = [
  'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'
]

function getMonthLabel(yyyymm: string) {
  const [y, m] = yyyymm.split('-')
  return `${MONTHS[Number(m) - 1]} ${y}`
}

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function DashboardPage() {
  const [month, setMonth] = useState('')
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [hasData, setHasData] = useState<boolean | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fixedOpen, setFixedOpen] = useState(true)
  const [editingTarget, setEditingTarget] = useState<number | null>(null)
  const [targetValue, setTargetValue] = useState('')
  const [sortBy, setSortBy] = useState<'amount' | 'name' | 'target'>('amount')
  const [categories, setCategories] = useState<{ id: number; name: string; monthly_target: number }[]>([])

  // On mount, load available months and default to the most recent one with data
  useEffect(() => {
    fetch('/api/months')
      .then(r => r.json())
      .then((months: Array<{ month: string }>) => {
        if (months.length === 0) {
          setHasData(false)
          setLoading(false)
          return
        }
        setHasData(true)
        const monthStrings = months.map(m => m.month)
        setAvailableMonths(monthStrings)
        setMonth(monthStrings[0])  // most recent first
      })
      .catch(() => { setHasData(false); setLoading(false) })
  }, [])

  const fetchDashboard = useCallback(() => {
    if (!month) return
    setLoading(true)
    fetch(`/api/dashboard?month=${month}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [month])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(setCategories)
      .catch(() => {})
  }, [])

  async function saveTarget(categoryId: number | null) {
    if (categoryId === null) return
    const val = Math.round(parseFloat(targetValue) * 100)
    if (isNaN(val)) return
    await fetch(`/api/categories/${categoryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthly_target: val }),
    })
    setEditingTarget(null)
    setCategories(prev => prev.map(c => c.id === categoryId ? { ...c, monthly_target: val } : c))
    fetchDashboard()
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-800 rounded-xl" />)}
      </div>
    )
  }

  if (hasData === false) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
          <Upload className="w-7 h-7 text-slate-500" />
        </div>
        <h2 className="text-xl font-semibold text-slate-200 mb-2">No data yet</h2>
        <p className="text-slate-500 mb-6 max-w-sm">Upload your Max credit card or Discount bank export to get started</p>
        <a href="/upload" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors">
          Upload files
        </a>
      </div>
    )
  }

  if (!data) return null

  const savings = data.totalIncome - data.totalExpenses
  const savingsTarget = data.goals.savings_target
  const savingsPct = savingsTarget > 0 ? Math.round((savings / savingsTarget) * 100) : null
  const expenseTarget = data.goals.expense_target
  const expensePct = expenseTarget > 0 ? Math.round((data.totalExpenses / expenseTarget) * 100) : null

  const isCurrentMonth = month === getCurrentMonth()
  const lastDate = data.lastDataDate
    ? new Date(data.lastDataDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : '—'

  const sortedCategories = [...data.categories].sort((a, b) => {
    if (sortBy === 'amount') return b.net - a.net
    if (sortBy === 'name') return (a.category_name ?? '').localeCompare(b.category_name ?? '', 'he')
    return b.monthly_target - a.monthly_target
  })

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Last data: {lastDate}</p>
        </div>
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {availableMonths.map(m => (
            <option key={m} value={m}>{getMonthLabel(m)}</option>
          ))}
        </select>
      </div>

      {/* Review banner */}
      {data.reviewCount > 0 && (
        <a href="/review" className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl hover:bg-amber-500/15 transition-colors">
          <span className="w-6 h-6 bg-amber-500 text-black text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
            {data.reviewCount}
          </span>
          <span className="text-amber-400 text-sm">
            {data.reviewCount} transaction{data.reviewCount > 1 ? 's' : ''} need your review — click to categorize
          </span>
        </a>
      )}

      {/* Data coverage warnings */}
      {(!data.coverage.hasMax || !data.coverage.hasBank) && (
        <div className="flex flex-col gap-2">
          {!data.coverage.hasMax && (
            <a href="/upload" className="flex items-center gap-3 px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors">
              <span className="w-2 h-2 rounded-full bg-slate-500 flex-shrink-0" />
              <span className="text-slate-400 text-sm">
                No Max credit card data for {getMonthLabel(month)} — <span className="text-indigo-400">upload a Max export</span>
              </span>
            </a>
          )}
          {!data.coverage.hasBank && (
            <a href="/upload" className="flex items-center gap-3 px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors">
              <span className="w-2 h-2 rounded-full bg-slate-500 flex-shrink-0" />
              <span className="text-slate-400 text-sm">
                No bank data for {getMonthLabel(month)} — income will show as ₪0. <span className="text-indigo-400">Upload a bank statement</span>
              </span>
            </a>
          )}
        </div>
      )}

      {/* Current Month Performance */}
      <section>
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">
          {isCurrentMonth ? 'This Month' : getMonthLabel(month)}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Spent"
            value={formatCurrency(data.totalExpenses)}
            sub={expensePct !== null ? `${expensePct}% of target` : undefined}
            color={expensePct && expensePct > 100 ? 'red' : 'default'}
          />
          <StatCard
            label="Income"
            value={formatCurrency(data.totalIncome)}
            color="green"
          />
          <StatCard
            label="Saved"
            value={formatCurrency(savings)}
            sub={savingsPct !== null ? `${savingsPct}% of target` : undefined}
            color={savings >= 0 ? 'green' : 'red'}
          />
          {isCurrentMonth && (
            <StatCard
              label="Projected"
              value={formatCurrency(data.projectedExpenses)}
              sub="end of month estimate"
              color={expenseTarget > 0 && data.projectedExpenses > expenseTarget ? 'red' : 'default'}
            />
          )}
        </div>
      </section>

      {/* Highlights */}
      <section>
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">Highlights</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <HighlightCard
            label="Savings last month"
            value={formatCurrency(data.prevMonthSavings)}
            positive={data.prevMonthSavings >= 0}
          />
          <HighlightCard
            label="YTD savings"
            value={formatCurrency(data.ytdSavings)}
            positive={data.ytdSavings >= 0}
          />
          <HighlightCard
            label="Monthly savings target"
            value={savingsTarget > 0 ? formatCurrency(savingsTarget) : 'Not set'}
            positive={true}
            neutral={savingsTarget === 0}
          />
          <HighlightCard
            label="Monthly expense target"
            value={expenseTarget > 0 ? formatCurrency(expenseTarget) : 'Not set'}
            positive={true}
            neutral={expenseTarget === 0}
          />
        </div>
      </section>

      {/* Categories */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Categories</h2>
          <button
            onClick={() => setSortBy(s => s === 'amount' ? 'name' : s === 'name' ? 'target' : 'amount')}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ArrowUpDown className="w-3 h-3" />
            Sort: {sortBy}
          </button>
        </div>
        <div className="bg-[#161b27] rounded-xl border border-slate-800 overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_80px_120px_100px] gap-0 text-xs text-slate-500 uppercase tracking-wider px-4 py-2.5 border-b border-slate-800">
            <span>Category</span>
            <span className="text-right">Spent</span>
            <span className="text-right">Share</span>
            <span className="text-right">Monthly target</span>
            <span className="text-right">vs target</span>
          </div>
          {sortedCategories.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-600 text-sm">No expenses this month</div>
          ) : (
            sortedCategories.map(cat => {
              const catId = cat.category_id
              const catMeta = categories.find(c => c.id === catId)
              const target = catMeta?.monthly_target ?? cat.monthly_target
              const vsTarget = target > 0 ? cat.net - target : null
              const isEditing = editingTarget === catId

              return (
                <div
                  key={catId ?? 'uncategorized'}
                  className="grid grid-cols-[1fr_100px_80px_120px_100px] gap-0 px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/20 items-center text-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: cat.color ?? '#6366f1' }}
                    />
                    <span className="text-slate-200 font-medium truncate">
                      {cat.category_name ?? 'Uncategorized'}
                    </span>
                    {cat.is_fixed === 1 && (
                      <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">fixed</span>
                    )}
                  </div>
                  <span className="text-right text-slate-200">{formatCurrency(cat.net)}</span>
                  <span className="text-right text-slate-400">{cat.pct}%</span>

                  {/* Target cell */}
                  <div className="flex items-center justify-end gap-1">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={targetValue}
                          onChange={e => setTargetValue(e.target.value)}
                          className="w-20 bg-slate-700 border border-indigo-500 text-slate-100 text-xs rounded px-1.5 py-1 focus:outline-none"
                          placeholder="₪"
                          autoFocus
                        />
                        <button onClick={() => saveTarget(catId)} className="text-green-400 hover:text-green-300">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditingTarget(null)} className="text-slate-500 hover:text-slate-300">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingTarget(catId ?? null)
                          setTargetValue(target > 0 ? String(target / 100) : '')
                        }}
                        className="flex items-center gap-1 text-slate-400 hover:text-slate-200 group"
                      >
                        <span>{target > 0 ? formatCurrency(target) : <span className="text-slate-600">Set target</span>}</span>
                        <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}
                  </div>

                  {/* vs target */}
                  <div className="text-right">
                    {vsTarget !== null ? (
                      <span className={vsTarget > 0 ? 'text-red-400' : 'text-emerald-400'}>
                        {vsTarget > 0 ? '+' : ''}{formatCurrency(vsTarget)}
                      </span>
                    ) : (
                      <span className="text-slate-700">—</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* Fixed Expenses */}
      <section>
        <button
          onClick={() => setFixedOpen(o => !o)}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 uppercase tracking-wider mb-3 hover:text-slate-300 transition-colors w-full text-left"
        >
          {fixedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Fixed Expenses
          <span className="ml-auto text-slate-400 normal-case font-normal">
            {formatCurrency(data.fixedTotal)} / month
          </span>
        </button>

        {fixedOpen && (
          <div className="bg-[#161b27] rounded-xl border border-slate-800 overflow-hidden">
            <div className="grid grid-cols-[1fr_120px_100px] text-xs text-slate-500 uppercase tracking-wider px-4 py-2.5 border-b border-slate-800">
              <span>Expense</span>
              <span>Category</span>
              <span className="text-right">Amount</span>
            </div>
            {data.fixedExpenses.length === 0 ? (
              <div className="px-4 py-6 text-center text-slate-600 text-sm">No fixed expenses tagged this month</div>
            ) : (
              data.fixedExpenses.map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_120px_100px] px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/20 items-center text-sm"
                >
                  <span className="text-slate-200 truncate">{row.business_name}</span>
                  <span className="text-slate-400 text-xs truncate">{row.category_name ?? '—'}</span>
                  <span className="text-right text-slate-200">{formatCurrency(row.amount)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value, sub, color = 'default' }: {
  label: string; value: string; sub?: string; color?: 'default' | 'green' | 'red'
}) {
  const valueColor = color === 'green' ? 'text-emerald-400' : color === 'red' ? 'text-red-400' : 'text-slate-100'
  return (
    <div className="bg-[#161b27] border border-slate-800 rounded-xl p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
    </div>
  )
}

function HighlightCard({ label, value, positive, neutral = false }: {
  label: string; value: string; positive: boolean; neutral?: boolean
}) {
  const valueColor = neutral ? 'text-slate-400' : positive ? 'text-emerald-400' : 'text-red-400'
  const Icon = neutral ? Target : positive ? TrendingUp : TrendingDown
  const iconColor = neutral ? 'text-slate-600' : positive ? 'text-emerald-600' : 'text-red-600'

  return (
    <div className="bg-[#161b27] border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-500">{label}</p>
        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
      </div>
      <p className={`text-lg font-bold ${valueColor}`}>{value}</p>
    </div>
  )
}

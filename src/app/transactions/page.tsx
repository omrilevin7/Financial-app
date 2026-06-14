'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

interface Transaction {
  id: number
  transaction_date: string
  budget_month: string | null
  billing_date: string | null
  business_name: string
  amount: number
  transaction_type: string
  source: string
  category_id: number | null
  category_name: string | null
  category_color: string | null
  card_last4: string | null
  notes: string | null
  max_transaction_kind: string | null
  is_excluded: number
  review_needed: number
}

interface Category {
  id: number
  name: string
}

const MONTHS_LABEL = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function monthLabel(yyyymm: string) {
  const [y, m] = yyyymm.split('-')
  return `${MONTHS_LABEL[Number(m)-1]} ${y}`
}

function getAvailableMonths(): string[] {
  const now = new Date()
  const months: string[] = []
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

function TransactionsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [month, setMonth] = useState(searchParams.get('month') ?? '')
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') ?? 'all')
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') ?? 'all')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)

  // Load available months from data if none set
  useEffect(() => {
    if (!month) {
      fetch('/api/months').then(r => r.json()).then((months: Array<{ month: string }>) => {
        if (months[0]) setMonth(months[0].month)
      })
    }
  }, [month])

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(setCategories)
  }, [])

  const fetchTransactions = useCallback(() => {
    if (!month) return
    setLoading(true)

    let url = `/api/transactions?month=${month}&exclude_excluded=false`
    if (typeFilter !== 'all') url += `&type=${typeFilter}`

    fetch(url)
      .then(r => r.json())
      .then((txs: Transaction[]) => {
        let filtered = txs
        if (categoryFilter === 'uncategorized') {
          filtered = txs.filter(t => !t.category_id && !t.is_excluded)
        } else if (categoryFilter !== 'all') {
          filtered = txs.filter(t => String(t.category_id) === categoryFilter)
        }
        setTransactions(filtered)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [month, typeFilter, categoryFilter])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  // Compute totals
  const income = transactions.filter(t => t.transaction_type === 'income' && !t.is_excluded)
    .reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter(t =>
    ['expense', 'cheque', 'refund'].includes(t.transaction_type) && !t.is_excluded
  ).reduce((s, t) => s + (t.transaction_type === 'refund' ? -t.amount : t.amount), 0)
  const excluded = transactions.filter(t => t.is_excluded).length

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Transactions</h1>
          <p className="text-sm text-slate-500 mt-0.5">Drill down to verify any total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {getAvailableMonths().map(m => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="all">All types</option>
          <option value="expense">Expenses</option>
          <option value="income">Income</option>
        </select>

        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="all">All categories</option>
          <option value="uncategorized">Uncategorized</option>
          {categories.map(c => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Totals summary */}
      {!loading && transactions.length > 0 && (
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="bg-[#161b27] border border-slate-800 rounded-xl p-3">
            <p className="text-slate-500 text-xs mb-1">Income shown</p>
            <p className="text-emerald-400 font-bold">{formatCurrency(income)}</p>
            <p className="text-slate-600 text-xs">{transactions.filter(t => t.transaction_type === 'income' && !t.is_excluded).length} transactions</p>
          </div>
          <div className="bg-[#161b27] border border-slate-800 rounded-xl p-3">
            <p className="text-slate-500 text-xs mb-1">Expenses shown</p>
            <p className="text-slate-100 font-bold">{formatCurrency(expenses)}</p>
            <p className="text-slate-600 text-xs">{transactions.filter(t => ['expense','cheque','refund'].includes(t.transaction_type) && !t.is_excluded).length} transactions</p>
          </div>
          <div className="bg-[#161b27] border border-slate-800 rounded-xl p-3">
            <p className="text-slate-500 text-xs mb-1">Excluded (auto)</p>
            <p className="text-slate-500 font-bold">{excluded}</p>
            <p className="text-slate-600 text-xs">credit card settlements</p>
          </div>
        </div>
      )}

      {/* Transactions table */}
      <div className="bg-[#161b27] border border-slate-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[90px_1fr_130px_90px_80px] text-xs text-slate-500 uppercase tracking-wider px-4 py-2.5 border-b border-slate-800">
          <span>Date</span>
          <span>Description</span>
          <span>Category</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Source</span>
        </div>

        {loading && (
          <div className="px-4 py-8 text-center text-slate-600 text-sm">Loading...</div>
        )}

        {!loading && transactions.length === 0 && (
          <div className="px-4 py-8 text-center text-slate-600 text-sm">No transactions match these filters</div>
        )}

        {!loading && transactions.map(tx => {
          const date = new Date(tx.transaction_date).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short'
          })
          const isExcluded = tx.is_excluded === 1
          const isIncome = tx.transaction_type === 'income'
          const isRefund = tx.transaction_type === 'refund'
          // Show when an item is counted in a different month than its purchase
          // date (credit-card billing deferral, e.g. purchased Apr 29 → counts in May)
          const purchaseMonth = tx.transaction_date.substring(0, 7)
          const shiftedMonth = tx.budget_month && tx.budget_month !== purchaseMonth
            ? new Date(tx.budget_month + '-01').toLocaleDateString('en-GB', { month: 'short' })
            : null

          return (
            <div
              key={tx.id}
              className={`grid grid-cols-[90px_1fr_130px_90px_80px] px-4 py-2.5 border-b border-slate-800/50 items-center text-sm
                ${isExcluded ? 'opacity-40' : 'hover:bg-slate-800/20'}`}
            >
              <div className="min-w-0">
                <span className="text-slate-500 text-xs">{date}</span>
                {shiftedMonth && (
                  <span className="block text-[10px] text-indigo-400/70" title="Counted in this budget month due to credit-card billing">
                    → {shiftedMonth}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <p className={`truncate text-xs ${isExcluded ? 'text-slate-500' : 'text-slate-200'}`}>
                  {tx.business_name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {isExcluded && <span className="text-[10px] text-slate-600 bg-slate-800 px-1 rounded">excluded</span>}
                  {tx.review_needed === 1 && <span className="text-[10px] text-amber-600 bg-amber-900/20 px-1 rounded">needs review</span>}
                  {tx.max_transaction_kind && tx.max_transaction_kind !== 'רגילה' && (
                    <span className="text-[10px] text-slate-600">{tx.max_transaction_kind}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 min-w-0">
                {tx.category_color && (
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tx.category_color }} />
                )}
                <span className="text-slate-400 text-xs truncate">
                  {tx.category_name ?? (isExcluded ? '—' : <span className="text-slate-600">Uncategorized</span>)}
                </span>
              </div>

              <span className={`text-right text-xs font-medium ${
                isIncome ? 'text-emerald-400' :
                isRefund ? 'text-emerald-400' :
                isExcluded ? 'text-slate-600' :
                'text-slate-200'
              }`}>
                {isIncome || isRefund ? '+' : ''}{formatCurrency(tx.amount)}
              </span>

              <span className="text-right text-[10px] text-slate-600 uppercase">
                {tx.source}{tx.card_last4 ? ` ···${tx.card_last4}` : ''}
              </span>
            </div>
          )
        })}
      </div>

      {!loading && transactions.length > 0 && (
        <p className="text-xs text-slate-600 text-center">
          {transactions.length} transactions • Click a category on the dashboard to filter by it
        </p>
      )}
    </div>
  )
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500">Loading...</div>}>
      <TransactionsContent />
    </Suspense>
  )
}

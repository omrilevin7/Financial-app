'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'
import { CheckCircle, SkipForward, ChevronDown } from 'lucide-react'

interface Transaction {
  id: number
  transaction_date: string
  business_name: string
  amount: number
  transaction_type: string
  source: string
  notes: string | null
  category_id: number | null
  category_name: string | null
}

interface Category {
  id: number
  name: string
  color: string
}

const TX_TYPE_OPTIONS = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer (exclude)' },
  { value: 'cheque', label: 'Cheque/Payment' },
]

export default function ReviewPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)

  const fetchReview = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/transactions?type=review').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
    ]).then(([txs, cats]) => {
      setTransactions(txs)
      setCategories(cats)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchReview() }, [fetchReview])

  async function saveTx(id: number, patch: { category_id?: number; transaction_type?: string; review_needed?: boolean }) {
    setSaving(id)
    await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    setTransactions(prev => prev.filter(t => t.id !== id))
    setSaving(null)
  }

  async function skipTx(id: number) {
    await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_needed: false }),
    })
    setTransactions(prev => prev.filter(t => t.id !== id))
  }

  if (loading) {
    return (
      <div className="p-6 space-y-3 animate-pulse max-w-2xl mx-auto">
        {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-800 rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Review Transactions</h1>
        <p className="text-sm text-slate-500 mt-1">
          {transactions.length === 0
            ? 'All caught up!'
            : `${transactions.length} transaction${transactions.length > 1 ? 's' : ''} need your attention`
          }
        </p>
      </div>

      {transactions.length === 0 && (
        <div className="text-center py-16">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <p className="text-slate-400">All transactions categorized</p>
        </div>
      )}

      <div className="space-y-3">
        {transactions.map(tx => (
          <ReviewCard
            key={tx.id}
            tx={tx}
            categories={categories}
            saving={saving === tx.id}
            onSave={(patch) => saveTx(tx.id, patch)}
            onSkip={() => skipTx(tx.id)}
          />
        ))}
      </div>
    </div>
  )
}

function ReviewCard({
  tx, categories, saving, onSave, onSkip
}: {
  tx: Transaction
  categories: Category[]
  saving: boolean
  onSave: (patch: { category_id?: number; transaction_type?: string }) => void
  onSkip: () => void
}) {
  const [selectedCat, setSelectedCat] = useState<number | ''>(tx.category_id ?? '')
  const [selectedType, setSelectedType] = useState(tx.transaction_type)

  const dateStr = new Date(tx.transaction_date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  })

  const isIncome = selectedType === 'income'
  const isTransfer = selectedType === 'transfer'

  return (
    <div className="bg-[#161b27] border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-slate-100 font-medium truncate">{tx.business_name}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-slate-500">{dateStr}</span>
            <span className="text-xs text-slate-600 uppercase">{tx.source}</span>
            {tx.notes && <span className="text-xs text-slate-600 truncate">{tx.notes}</span>}
          </div>
        </div>
        <span className={`text-lg font-bold flex-shrink-0 ${tx.amount < 0 ? 'text-emerald-400' : 'text-slate-100'}`}>
          {formatCurrency(Math.abs(tx.amount))}
        </span>
      </div>

      <div className="flex gap-2">
        {/* Transaction type */}
        <div className="relative flex-shrink-0">
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="appearance-none bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg pl-2.5 pr-6 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            {TX_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
        </div>

        {/* Category selector (only for expenses) */}
        {!isIncome && !isTransfer && (
          <div className="relative flex-1">
            <select
              value={selectedCat}
              onChange={e => setSelectedCat(e.target.value ? Number(e.target.value) : '')}
              className="w-full appearance-none bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg pl-2.5 pr-6 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">Select category...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSave({
            category_id: (!isIncome && !isTransfer && selectedCat) ? Number(selectedCat) : undefined,
            transaction_type: selectedType,
          })}
          disabled={saving || (!isIncome && !isTransfer && !selectedCat)}
          className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-medium rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : 'Save & update all matching'}
        </button>
        <button
          onClick={onSkip}
          className="px-3 py-1.5 text-slate-500 hover:text-slate-300 text-xs rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1"
        >
          <SkipForward className="w-3 h-3" /> Skip
        </button>
      </div>

      <p className="text-[11px] text-slate-600">
        Saving will update all past and future transactions from &quot;{tx.business_name}&quot;
      </p>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Save, Check } from 'lucide-react'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function getAvailableMonths(): string[] {
  const now = new Date()
  const months: string[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + 1 - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

function getMonthLabel(yyyymm: string) {
  const [y, m] = yyyymm.split('-')
  return `${MONTHS[Number(m) - 1]} ${y}`
}

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function SettingsPage() {
  const [month, setMonth] = useState(getCurrentMonth())
  const [expenseTarget, setExpenseTarget] = useState('')
  const [savingsTarget, setSavingsTarget] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`/api/goals?month=${month}`)
      .then(r => r.json())
      .then(d => {
        setExpenseTarget(d.expense_target > 0 ? String(d.expense_target / 100) : '')
        setSavingsTarget(d.savings_target > 0 ? String(d.savings_target / 100) : '')
      })
      .catch(() => {})
  }, [month])

  async function save() {
    await fetch('/api/goals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        month,
        expense_target: expenseTarget ? Math.round(parseFloat(expenseTarget) * 100) : 0,
        savings_target: savingsTarget ? Math.round(parseFloat(savingsTarget) * 100) : 0,
      }),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const expenseNum = parseFloat(expenseTarget) || 0
  const savingsNum = parseFloat(savingsTarget) || 0
  const impliedIncome = expenseNum + savingsNum

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Monthly Goals</h1>
        <p className="text-sm text-slate-500 mt-1">Set your expense and savings targets</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider">Month</label>
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {getAvailableMonths().map(m => (
              <option key={m} value={m}>{getMonthLabel(m)}</option>
            ))}
          </select>
        </div>

        <div className="bg-[#161b27] border border-slate-800 rounded-xl p-5 space-y-4">
          <GoalInput
            label="Expense target"
            hint="Maximum amount you want to spend"
            value={expenseTarget}
            onChange={setExpenseTarget}
          />
          <GoalInput
            label="Savings target"
            hint="Minimum amount you want to save"
            value={savingsTarget}
            onChange={setSavingsTarget}
          />

          {(expenseNum > 0 || savingsNum > 0) && (
            <div className="pt-2 border-t border-slate-800 text-xs text-slate-500 space-y-1">
              {expenseNum > 0 && <p>Expense cap: {formatCurrency(expenseNum * 100)}</p>}
              {savingsNum > 0 && <p>Savings goal: {formatCurrency(savingsNum * 100)}</p>}
              {impliedIncome > 0 && <p>Implied income needed: {formatCurrency(impliedIncome * 100)}</p>}
            </div>
          )}
        </div>

        <button
          onClick={save}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {saved
            ? <><Check className="w-4 h-4" /> Saved!</>
            : <><Save className="w-4 h-4" /> Save Goals</>
          }
        </button>
      </div>
    </div>
  )
}

function GoalInput({ label, hint, value, onChange }: {
  label: string; hint: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-sm text-slate-300 mb-0.5">{label}</label>
      <p className="text-xs text-slate-600 mb-2">{hint}</p>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₪</span>
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="0"
          className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
    </div>
  )
}

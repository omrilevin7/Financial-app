'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Upload,
  AlertCircle,
  Settings,
  Wallet,
  List,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: List },
  { href: '/upload', label: 'Upload', icon: Upload },
  { href: '/review', label: 'Review', icon: AlertCircle },
  { href: '/settings', label: 'Goals', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [reviewCount, setReviewCount] = useState(0)

  useEffect(() => {
    fetch('/api/dashboard?month=' + getCurrentMonth())
      .then(r => r.json())
      .then(d => setReviewCount(d.reviewCount ?? 0))
      .catch(() => {})
  }, [pathname])

  return (
    <aside className="w-56 flex-shrink-0 bg-[#161b27] border-r border-slate-800 flex flex-col">
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-slate-100">Budget</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          const isReview = href === '/review'
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {isReview && reviewCount > 0 && (
                <span className="bg-amber-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {reviewCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <p className="text-xs text-slate-600">Personal Budget Tracker</p>
      </div>
    </aside>
  )
}

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

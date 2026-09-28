'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'

const REPORTS = [
  {
    href:  '/accounts/reports/ledger',
    title: 'Ledger',
    desc:  'Full transaction history and running balance for any ledger account.',
    icon:  '📒',
    color: '#0891B2',
  },
  {
    href:  '/accounts/reports/trial-balance',
    title: 'Trial Balance',
    desc:  'All ledger debit/credit totals — verifies the books are balanced.',
    icon:  '⚖',
    color: '#2563EB',
  },
  {
    href:  '/accounts/reports/pl',
    title: 'Profit & Loss',
    desc:  'Income minus expenses for a date range. Shows net profit or loss.',
    icon:  '📈',
    color: '#16A34A',
  },
  {
    href:  '/accounts/reports/balance-sheet',
    title: 'Balance Sheet',
    desc:  'Assets = Liabilities + Equity + Net Profit as at a given date.',
    icon:  '🏦',
    color: '#7C3AED',
  },
  {
    href:  '/accounts/reports/cash-flow',
    title: 'Cash Flow',
    desc:  'Cash in vs cash out from Cash in Hand and Bank accounts.',
    icon:  '💸',
    color: '#CC1133',
  },
]

export default function ReportsIndexPage() {
  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <Link href="/accounts" className="text-xs hover:underline" style={{ color: '#94A3B8' }}>
          ← Accounts
        </Link>
        <h1 className="text-xl font-bold text-[#1E293B] mt-2">Financial Reports</h1>
        <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>
          Read-only reports generated from real ledger postings.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {REPORTS.map(r => (
          <Link
            key={r.href}
            href={r.href}
            className="fp-card fp-card-clickable flex items-start gap-4"
            style={{ padding: '20px', borderRadius: '12px' }}
          >
            <span
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: `${r.color}18`, border: `1px solid ${r.color}30` }}
            >
              {r.icon}
            </span>
            <div>
              <p className="text-sm font-semibold text-[#1E293B]">{r.title}</p>
              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{r.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

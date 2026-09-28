'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import LoadingSpinner from '@/app/components/ui/LoadingSpinner'

type Voucher = {
  id: string
  voucherNumber: string
  voucherType: string
  displayType: string
  date: string
  amount: string
  narration: string | null
  partyId: string | null
  pendingAmount: string | null
  frameOrJobCard: string | null
  location: { id: string; name: string } | null
  createdBy: { id: string; name: string } | null
}

type CashbookSummary = {
  openingBalance: string
  totalReceipts: string
  totalPayments: string
  closingBalance: string
}

const VOUCHER_TYPE_BADGE: Record<string, string> = {
  RECEIPT:     'bg-[#DCFCE7] text-[#15803D]',
  SERVICE:     'bg-[#EFF6FF] text-[#1D4ED8]',
  PAYMENT:     'bg-[#FEE2E2] text-[#B91C1C]',
  CONTRA:      'bg-[#DBEAFE] text-[#1D4ED8]',
  JOURNAL:     'bg-[#FEF3C7] text-[#92400E]',
  SALES:       'bg-[#F3E8FF] text-[#7E22CE]',
  PURCHASE:    'bg-[#FFF7ED] text-[#C2410C]',
  DEBIT_NOTE:  'bg-[#FEF9C3] text-[#713F12]',
  CREDIT_NOTE: 'bg-[#F0FDF4] text-[#15803D]',
}

const QUICK_ACTIONS = [
  { label: 'Receipt',         href: '/accounts/vouchers/new?type=RECEIPT', desc: 'Cash/cheque received',      icon: '↓', iconBg: 'rgba(22,163,74,0.15)',   iconColor: '#16A34A' },
  { label: 'Payment',         href: '/accounts/vouchers/new?type=PAYMENT', desc: 'Cash/cheque paid out',      icon: '↑', iconBg: 'rgba(204,17,51,0.12)',   iconColor: '#CC1133' },
  { label: 'Contra',          href: '/accounts/vouchers/new?type=CONTRA',  desc: 'Bank ↔ cash transfer',      icon: '⇄', iconBg: 'rgba(37,99,235,0.12)',   iconColor: '#2563EB' },
  { label: 'Journal Voucher', href: '/accounts/vouchers/new?type=JOURNAL', desc: 'General ledger entry',      icon: '≡', iconBg: 'rgba(124,58,237,0.12)',  iconColor: '#7C3AED' },
  { label: 'Standalone MRN',  href: '/accounts/mrn/new',                  desc: 'Record advance payment MRN', icon: '₹', iconBg: 'rgba(217,119,6,0.12)',   iconColor: '#D97706' },
]

const fmt = (n: string | number) =>
  `₹ ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export default function AccountsPage() {
  const [vouchers,  setVouchers]  = useState<Voucher[]>([])
  const [cashbook,  setCashbook]  = useState<CashbookSummary | null>(null)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    Promise.all([
      fetch('/api/accounts/vouchers').then(r => r.json()).catch(() => []),
      fetch(`/api/accounts/cashbook?startDate=${today}&endDate=${today}`).then(r => r.json()).catch(() => null),
    ]).then(([v, cb]) => {
      setVouchers(Array.isArray(v) ? v.slice(0, 20) : [])
      if (cb && 'closingBalance' in cb) setCashbook(cb)
      setLoading(false)
    })
  }, [])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#1E293B]">Accounts</h1>
        <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>Vouchers, cash book and ledger</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        {QUICK_ACTIONS.map(a => (
          <Link
            key={a.href}
            href={a.href}
            className="fp-card fp-card-clickable flex items-center gap-3.5"
            style={{ padding: '16px 20px', borderRadius: '12px' }}
          >
            <span
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
              style={{ background: a.iconBg, color: a.iconColor }}
            >
              {a.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1E293B]">{a.label}</p>
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{a.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Reports */}
      <div className="fp-card mb-6 px-5 py-4" style={{ borderRadius: '12px' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#1E293B]">Financial Reports</h2>
          <Link href="/accounts/reports" className="text-xs hover:underline" style={{ color: '#CC1133' }}>
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { label: 'Ledger',         href: '/accounts/reports/ledger',         icon: '📒', color: '#0891B2' },
            { label: 'Trial Balance',  href: '/accounts/reports/trial-balance',  icon: '⚖', color: '#2563EB' },
            { label: 'P & L',          href: '/accounts/reports/pl',              icon: '📈', color: '#16A34A' },
            { label: 'Balance Sheet',  href: '/accounts/reports/balance-sheet',  icon: '🏦', color: '#7C3AED' },
            { label: 'Cash Flow',      href: '/accounts/reports/cash-flow',      icon: '💸', color: '#CC1133' },
          ].map(r => (
            <Link key={r.href} href={r.href}
              className="fp-card-clickable flex items-center gap-2.5 px-3 py-2.5 rounded-lg"
              style={{ border: `1px solid ${r.color}22`, background: `${r.color}08` }}>
              <span className="text-base">{r.icon}</span>
              <span className="text-xs font-semibold" style={{ color: r.color }}>{r.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="fp-card overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
              <h2 className="text-sm font-semibold text-[#1E293B]">Today&apos;s Cash Book</h2>
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size={24} />
              </div>
            ) : cashbook ? (
              <div className="px-5 py-4 flex flex-col gap-3">
                <CashRow label="Opening Balance" value={cashbook.openingBalance} />
                <div style={{ borderTop: '1px solid #F1F5F9' }} />
                <CashRow label="Total Receipts" value={cashbook.totalReceipts} positive />
                <CashRow label="Total Payments" value={cashbook.totalPayments} negative />
                <div style={{ borderTop: '2px solid #E2E8F0' }} />
                <CashRow label="Closing Balance" value={cashbook.closingBalance} bold />
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-sm" style={{ color: '#94A3B8' }}>No cash transactions today.</div>
            )}
            <div className="px-5 pb-4">
              <Link href="/accounts/cashbook" style={{ color: '#CC1133', fontSize: '12px' }} className="hover:underline">
                View full cash book →
              </Link>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="fp-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <h2 className="text-sm font-semibold text-[#1E293B]">Recent Transactions</h2>
              <Link href="/accounts/vouchers" className="text-xs hover:underline" style={{ color: '#CC1133' }}>
                View all →
              </Link>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size={28} />
              </div>
            ) : vouchers.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>No vouchers yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left fp-table">
                  <thead>
                    <tr>
                      {['Voucher #', 'Type', 'Frame / Job Card', 'Date', 'Amount', 'Outstanding', 'Narration', ''].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vouchers.map(v => (
                      <tr key={v.id}>
                        <td className="whitespace-nowrap">
                          <Link href={`/accounts/vouchers/${v.id}`} className="font-mono text-xs font-semibold hover:underline" style={{ color: '#CC1133' }}>
                            {v.voucherNumber}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${VOUCHER_TYPE_BADGE[v.displayType ?? v.voucherType] ?? 'bg-[#F1F5F9] text-[#475569]'}`}>
                            {(v.displayType ?? v.voucherType).replace('_', ' ')}
                          </span>
                        </td>
                        <td className="font-mono text-xs whitespace-nowrap" style={{ color: '#475569' }}>
                          {v.frameOrJobCard ?? <span style={{ color: '#CBD5E1' }}>—</span>}
                        </td>
                        <td className="text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>
                          {new Date(v.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="text-sm font-semibold whitespace-nowrap" style={{ color: '#1E293B' }}>{fmt(v.amount)}</td>
                        <td className="text-xs font-semibold whitespace-nowrap">
                          {v.pendingAmount === null ? (
                            <span style={{ color: '#CBD5E1' }}>—</span>
                          ) : Number(v.pendingAmount) > 0 ? (
                            <span style={{ color: '#DC2626' }}>{fmt(v.pendingAmount)}</span>
                          ) : (
                            <span style={{ color: '#16A34A' }}>Nil</span>
                          )}
                        </td>
                        <td className="text-xs truncate" style={{ color: '#64748B', maxWidth: '160px' }}>{v.narration ?? '—'}</td>
                        <td className="whitespace-nowrap">
                          <Link href={`/accounts/vouchers/${v.id}`} className="text-xs hover:underline" style={{ color: '#CC1133' }}>
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CashRow({ label, value, positive, negative, bold }: {
  label: string; value: string; positive?: boolean; negative?: boolean; bold?: boolean
}) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-semibold' : ''}`} style={{ color: bold ? '#1E293B' : '#374151' }}>
      <span>{label}</span>
      <span style={{ color: positive ? '#16A34A' : negative ? '#DC2626' : undefined }}>
        {fmt(value)}
      </span>
    </div>
  )
}

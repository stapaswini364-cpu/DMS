'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type TBRow = {
  accountCode: string
  accountName: string
  accountType: string
  totalDebit:  string
  totalCredit: string
}

type TBData = {
  asAt:        string
  rows:        TBRow[]
  totalDebit:  string
  totalCredit: string
  balanced:    boolean
}

const TYPE_LABEL: Record<string, string> = {
  ASSET:     'Asset',
  LIABILITY: 'Liability',
  EQUITY:    'Equity',
  INCOME:    'Income',
  EXPENSE:   'Expense',
}

const TYPE_COLOR: Record<string, string> = {
  ASSET:     'bg-blue-50 text-blue-700',
  LIABILITY: 'bg-red-50 text-red-700',
  EQUITY:    'bg-purple-50 text-purple-700',
  INCOME:    'bg-green-50 text-green-700',
  EXPENSE:   'bg-orange-50 text-orange-700',
}

const fmt = (n: string | number) =>
  `₹ ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function TrialBalancePage() {
  const [asAt,    setAsAt]    = useState(new Date().toISOString().slice(0, 10))
  const [data,    setData]    = useState<TBData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/reports/trial-balance?asAt=${asAt}`)
    const d   = await res.json().catch(() => null)
    setData(d)
    setLoading(false)
  }, [asAt])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/reports" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Reports</Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">Trial Balance</h1>
      </div>

      {/* Date picker */}
      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm font-medium" style={{ color: '#64748B' }}>As At</label>
        <input
          type="date"
          value={asAt}
          onChange={e => setAsAt(e.target.value)}
          className="fp-input"
          style={{ width: 'auto' }}
        />
        <span className="text-xs" style={{ color: '#94A3B8' }}>
          {new Date(asAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
        </span>
      </div>

      {loading ? (
        <div className="text-center py-16 text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
      ) : !data ? (
        <div className="text-center py-16 text-sm" style={{ color: '#94A3B8' }}>Failed to load trial balance.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Main table */}
          <div className="fp-card overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <h2 className="text-sm font-semibold text-[#1E293B]">All Accounts</h2>
              <span className="text-xs" style={{ color: '#94A3B8' }}>
                {data.rows.length} account{data.rows.length !== 1 ? 's' : ''}
              </span>
            </div>

            {data.rows.length === 0 ? (
              <div className="py-16 text-center text-sm" style={{ color: '#94A3B8' }}>
                No journal entries found up to this date.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left fp-table">
                  <thead>
                    <tr>
                      <th className="w-28">Code</th>
                      <th>Account Name</th>
                      <th>Type</th>
                      <th className="text-right">Debit</th>
                      <th className="text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map(row => (
                      <tr key={row.accountCode}>
                        <td className="font-mono text-xs" style={{ color: '#94A3B8' }}>
                          {row.accountCode}
                        </td>
                        <td className="font-medium text-[#1E293B]">
                          {row.accountName}
                        </td>
                        <td>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOR[row.accountType] ?? 'fp-badge-draft'}`}>
                            {TYPE_LABEL[row.accountType] ?? row.accountType}
                          </span>
                        </td>
                        <td className="text-right tabular-nums" style={{ color: '#374151' }}>
                          {Number(row.totalDebit) > 0 ? fmt(row.totalDebit) : (
                            <span style={{ color: '#CBD5E1' }}>—</span>
                          )}
                        </td>
                        <td className="text-right tabular-nums" style={{ color: '#374151' }}>
                          {Number(row.totalCredit) > 0 ? fmt(row.totalCredit) : (
                            <span style={{ color: '#CBD5E1' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals row */}
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                      <td className="px-4 py-3" colSpan={3}>
                        <span className="text-sm font-bold text-[#1E293B]">Total</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#1E293B] tabular-nums">
                        {fmt(data.totalDebit)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#1E293B] tabular-nums">
                        {fmt(data.totalCredit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Balanced indicator */}
          <div className={`flex items-center justify-between p-4 rounded-xl border-2 ${
            data.balanced
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{data.balanced ? '✅' : '❌'}</span>
              <div>
                <p className={`text-sm font-bold ${data.balanced ? 'text-green-800' : 'text-red-800'}`}>
                  {data.balanced ? 'Balanced' : 'Not Balanced'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Total Debits must equal Total Credits
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">Difference</div>
              <div className={`text-sm font-semibold tabular-nums ${data.balanced ? 'text-green-700' : 'text-red-700'}`}>
                {fmt(Math.abs(Number(data.totalDebit) - Number(data.totalCredit)))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

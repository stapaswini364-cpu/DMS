'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import LoadingSpinner from '@/app/components/ui/LoadingSpinner'

type TBRow = {
  ledgerCode:      string
  ledgerName:      string
  accountTypeCode: string
  accountTypeName: string
  totalDebit:      string
  totalCredit:     string
}

type TBData = {
  asAt:        string
  rows:        TBRow[]
  totalDebit:  string
  totalCredit: string
  balanced:    boolean
  _warning?:   string
}

const TYPE_ORDER = ['A', 'L', 'EQ', 'I', 'EX']
const TYPE_COLOR: Record<string, string> = {
  A:  '#2563EB',
  L:  '#DC2626',
  EQ: '#7C3AED',
  I:  '#16A34A',
  EX: '#D97706',
}

const fmt = (n: string | number) =>
  Number(n) === 0 ? '—' : `₹ ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function TrialBalancePage() {
  const today = new Date().toISOString().slice(0, 10)
  const [asAt,    setAsAt]    = useState(today)
  const [data,    setData]    = useState<TBData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  function load(date: string) {
    setLoading(true)
    setError('')
    fetch(`/api/reports/trial-balance?asAt=${date}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load report'); setLoading(false) })
  }

  useEffect(() => { load(today) }, [today])

  // Group rows by account type
  const grouped = data
    ? TYPE_ORDER
        .map(code => ({
          code,
          name: data.rows.find(r => r.accountTypeCode === code)?.accountTypeName ?? code,
          rows: data.rows.filter(r => r.accountTypeCode === code),
        }))
        .filter(g => g.rows.length > 0)
    : []

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/accounts/reports" className="text-xs hover:underline" style={{ color: '#94A3B8' }}>
          ← Reports
        </Link>
        <span style={{ color: '#CBD5E1' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">Trial Balance</h1>
      </div>

      {/* Controls */}
      <div className="fp-card mb-6 flex flex-wrap items-end gap-4" style={{ padding: '16px 20px', borderRadius: '12px' }}>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>As at date</label>
          <input
            type="date" value={asAt}
            onChange={e => setAsAt(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-[#E2E8F0] bg-white text-[#1E293B] focus:outline-none focus:border-[#CC1133]"
          />
        </div>
        <button
          onClick={() => load(asAt)}
          className="px-5 py-2 text-sm font-semibold text-white rounded-lg"
          style={{ background: '#CC1133' }}
        >
          Generate
        </button>
        {data && (
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${data.balanced ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEF2F2] text-[#B91C1C]'}`}>
            {data.balanced ? '✓ Balanced' : '✗ IMBALANCE — data integrity warning'}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 text-sm rounded-lg" style={{ background: '#FEF2F2', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><LoadingSpinner size={32} /></div>
      ) : data && (
        <div className="fp-card overflow-hidden" style={{ borderRadius: '12px' }}>
          {/* Header */}
          <div className="px-5 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC]">
            <p className="text-sm font-semibold text-[#1E293B]">
              Trial Balance — as at {new Date(data.asAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>

          <table className="w-full text-sm fp-table">
            <thead>
              <tr>
                <th className="w-24">Code</th>
                <th>Ledger Name</th>
                <th className="text-right">Debit (₹)</th>
                <th className="text-right">Credit (₹)</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(group => (
                <>
                  <tr key={`grp-${group.code}`} style={{ background: `${TYPE_COLOR[group.code]}08` }}>
                    <td colSpan={4} className="font-semibold text-xs uppercase tracking-wide py-2 px-5"
                      style={{ color: TYPE_COLOR[group.code] }}>
                      {group.name}
                    </td>
                  </tr>
                  {group.rows.map(r => (
                    <tr key={r.ledgerCode}>
                      <td className="font-mono text-xs font-semibold" style={{ color: '#64748B' }}>{r.ledgerCode}</td>
                      <td className="text-[#374151]">{r.ledgerName}</td>
                      <td className="text-right font-mono text-xs"
                        style={{ color: Number(r.totalDebit) > 0 ? '#1E293B' : '#CBD5E1' }}>
                        {fmt(r.totalDebit)}
                      </td>
                      <td className="text-right font-mono text-xs"
                        style={{ color: Number(r.totalCredit) > 0 ? '#1E293B' : '#CBD5E1' }}>
                        {fmt(r.totalCredit)}
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                <td colSpan={2} className="font-bold text-[#1E293B] px-5 py-3">TOTAL</td>
                <td className="text-right font-bold font-mono text-[#1E293B] px-5 py-3">
                  ₹ {Number(data.totalDebit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="text-right font-bold font-mono text-[#1E293B] px-5 py-3">
                  ₹ {Number(data.totalCredit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

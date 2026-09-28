'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import LoadingSpinner from '@/app/components/ui/LoadingSpinner'

type DayRow = {
  day:         string
  cashIn:      string
  cashOut:     string
  netCashFlow: string
  txCount:     number
}

type CFData = {
  period: { startDate: string | null; endDate: string | null }
  daily:  DayRow[]
  totals: { cashIn: string; cashOut: string; netCashFlow: string }
  _note?: string
}

const fmt = (n: string | number) =>
  `₹ ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function CashFlowPage() {
  const today    = new Date().toISOString().slice(0, 10)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  const [startDate, setStartDate] = useState(monthStart)
  const [endDate,   setEndDate]   = useState(today)
  const [data,      setData]      = useState<CFData | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  const load = useCallback((s: string, e: string) => {
    setLoading(true)
    setError('')
    fetch(`/api/reports/cash-flow?startDate=${s}&endDate=${e}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load report'); setLoading(false) })
  }, [])

  useEffect(() => { load(monthStart, today) }, [monthStart, today, load])

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/accounts/reports" className="text-xs hover:underline" style={{ color: '#94A3B8' }}>
          ← Reports
        </Link>
        <span style={{ color: '#CBD5E1' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">Cash Flow</h1>
      </div>

      {/* Controls */}
      <div className="fp-card mb-6 flex flex-wrap items-end gap-4" style={{ padding: '16px 20px', borderRadius: '12px' }}>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-[#E2E8F0] bg-white text-[#1E293B] focus:outline-none focus:border-[#CC1133]" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-[#E2E8F0] bg-white text-[#1E293B] focus:outline-none focus:border-[#CC1133]" />
        </div>
        <button onClick={() => load(startDate, endDate)}
          className="px-5 py-2 text-sm font-semibold text-white rounded-lg" style={{ background: '#CC1133' }}>
          Generate
        </button>
      </div>

      {/* Summary cards */}
      {data && !data._note && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Cash In',     value: data.totals.cashIn,      color: '#16A34A' },
            { label: 'Cash Out',    value: data.totals.cashOut,     color: '#DC2626' },
            { label: 'Net Cash Flow', value: data.totals.netCashFlow,
              color: Number(data.totals.netCashFlow) >= 0 ? '#16A34A' : '#DC2626' },
          ].map(c => (
            <div key={c.label} className="fp-card rounded-xl p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>{c.label}</p>
              <p className="text-lg font-bold" style={{ color: c.color }}>{fmt(c.value)}</p>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 text-sm rounded-lg" style={{ background: '#FEF2F2', color: '#B91C1C' }}>{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><LoadingSpinner size={32} /></div>
      ) : data && (
        data._note ? (
          <div className="fp-card px-5 py-8 text-center text-sm" style={{ color: '#94A3B8', borderRadius: '12px' }}>
            {data._note}
          </div>
        ) : data.daily.length === 0 ? (
          <div className="fp-card px-5 py-8 text-center text-sm" style={{ color: '#94A3B8', borderRadius: '12px' }}>
            No cash transactions in this period.
          </div>
        ) : (
          <div className="fp-card overflow-hidden" style={{ borderRadius: '12px' }}>
            <div className="px-5 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC]">
              <p className="text-sm font-semibold text-[#1E293B]">Daily Cash Flow</p>
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Cash in Hand + Bank accounts only</p>
            </div>
            <table className="w-full text-sm fp-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="text-right">Cash In (₹)</th>
                  <th className="text-right">Cash Out (₹)</th>
                  <th className="text-right">Net (₹)</th>
                  <th className="text-right">Txns</th>
                </tr>
              </thead>
              <tbody>
                {data.daily.map(row => {
                  const net = Number(row.netCashFlow)
                  return (
                    <tr key={row.day}>
                      <td className="text-xs" style={{ color: '#94A3B8' }}>
                        {new Date(row.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="text-right font-mono text-xs" style={{ color: '#16A34A' }}>
                        {Number(row.cashIn) > 0 ? fmt(row.cashIn) : '—'}
                      </td>
                      <td className="text-right font-mono text-xs" style={{ color: '#DC2626' }}>
                        {Number(row.cashOut) > 0 ? fmt(row.cashOut) : '—'}
                      </td>
                      <td className="text-right font-mono text-xs font-semibold"
                        style={{ color: net >= 0 ? '#16A34A' : '#DC2626' }}>
                        {fmt(Math.abs(net))}{net < 0 ? ' (out)' : ''}
                      </td>
                      <td className="text-right text-xs" style={{ color: '#64748B' }}>{row.txCount}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                  <td className="font-bold text-[#1E293B] px-5 py-3">TOTAL</td>
                  <td className="text-right font-bold font-mono text-[#16A34A] px-5 py-3">{fmt(data.totals.cashIn)}</td>
                  <td className="text-right font-bold font-mono text-[#DC2626] px-5 py-3">{fmt(data.totals.cashOut)}</td>
                  <td className="text-right font-bold font-mono px-5 py-3"
                    style={{ color: Number(data.totals.netCashFlow) >= 0 ? '#16A34A' : '#DC2626' }}>
                    {fmt(Math.abs(Number(data.totals.netCashFlow)))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )
      )}
    </div>
  )
}

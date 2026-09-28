'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type DailyRow = {
  day: string
  receipts: string
  payments: string
  netFlow: string
  count: number
}

type CashFlowData = {
  daily: DailyRow[]
  totals: {
    totalReceipts: string
    totalPayments: string
    netCashFlow: string
  }
}

const fmt = (n: string | number) =>
  `₹ ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

function firstOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function today() { return new Date().toISOString().slice(0, 10) }

function SummaryCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px 24px', borderLeft: `4px solid ${accent}` }}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>{label}</p>
      <p className="text-xl font-bold" style={{ color: '#1E293B' }}>{value}</p>
    </div>
  )
}

export default function CashFlowPage() {
  const [startDate, setStartDate] = useState(firstOfMonth())
  const [endDate,   setEndDate]   = useState(today())
  const [data,      setData]      = useState<CashFlowData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ startDate, endDate })
      const res = await fetch(`/api/reports/cash-flow?${params}`)
      if (!res.ok) { setError('Failed to load report'); setData(null); return }
      setData(await res.json())
    } catch { setError('Failed to load report'); setData(null) }
    finally { setLoading(false) }
  }, [startDate, endDate])

  useEffect(() => { fetchData() }, [fetchData])

  const inputCls = 'px-3 py-2 text-sm rounded-lg border border-[#E2E8F0] bg-white text-[#1E293B] focus:outline-none focus:border-[#CC1133] transition-colors'

  const netPositive = data ? Number(data.totals.netCashFlow) >= 0 : true

  return (
    <div className="p-6" style={{ background: '#F5F7FA', minHeight: '100vh' }}>
      <div className="mb-6">
        <Link href="/reports" className="text-sm hover:underline" style={{ color: '#94A3B8' }}>← Reports</Link>
        <h1 className="text-xl font-bold mt-2" style={{ color: '#1E293B' }}>Cash Flow Report</h1>
        <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>Day-wise receipts and payments</p>
      </div>

      {/* Date filter */}
      <div className="flex flex-wrap items-end gap-4 mb-6" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px 20px' }}>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>Start Date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>End Date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 text-sm rounded-lg" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>{error}</div>
      )}

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <SummaryCard label="Total Receipts"  value={fmt(data.totals.totalReceipts)} accent="#16A34A" />
          <SummaryCard label="Total Payments"  value={fmt(data.totals.totalPayments)} accent="#DC2626" />
          <SummaryCard label="Net Cash Flow"   value={fmt(data.totals.netCashFlow)}   accent={netPositive ? '#2563EB' : '#DC2626'} />
        </div>
      )}

      {/* Daily table */}
      <div className="overflow-hidden" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#1E293B' }}>Daily Breakdown</h2>
          {data && <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{data.daily.length} day{data.daily.length !== 1 ? 's' : ''} with activity</p>}
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
        ) : !data || data.daily.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: '#94A3B8' }}>No cash transactions for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  {['Date', 'Receipts', 'Payments', 'Net Flow', 'Txns'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.daily.map((row, i) => {
                  const net = Number(row.netFlow)
                  return (
                    <tr key={row.day} style={{ borderBottom: i < data.daily.length - 1 ? '1px solid #F1F5F9' : undefined }}>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#374151' }}>
                        {new Date(row.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 font-semibold" style={{ color: '#16A34A' }}>{fmt(row.receipts)}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: '#DC2626' }}>{fmt(row.payments)}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: net >= 0 ? '#2563EB' : '#DC2626' }}>{fmt(row.netFlow)}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#94A3B8' }}>{row.count}</td>
                    </tr>
                  )
                })}
                {/* Totals row */}
                <tr style={{ background: '#F8FAFC', borderTop: '2px solid #E2E8F0' }}>
                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#1E3A5F' }}>Total</td>
                  <td className="px-4 py-3 font-bold" style={{ color: '#16A34A' }}>{fmt(data.totals.totalReceipts)}</td>
                  <td className="px-4 py-3 font-bold" style={{ color: '#DC2626' }}>{fmt(data.totals.totalPayments)}</td>
                  <td className="px-4 py-3 font-bold" style={{ color: netPositive ? '#2563EB' : '#DC2626' }}>{fmt(data.totals.netCashFlow)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#94A3B8' }}>{data.daily.reduce((s, r) => s + r.count, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

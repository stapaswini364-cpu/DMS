'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type AccountLine = {
  accountId:   string
  accountCode: string
  accountName: string
  amount:      string
}

type PLData = {
  period:       { startDate: string | null; endDate: string | null }
  income:       AccountLine[]
  expenses:     AccountLine[]
  totalIncome:  string
  totalExpense: string
  netProfit:    string
  isProfit:     boolean
}

const fmt = (n: string | number) =>
  `₹ ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function AccountTable({ rows }: { rows: AccountLine[] }) {
  if (rows.length === 0) return <p className="px-5 py-4 text-sm" style={{ color: '#94A3B8' }}>No entries for this period.</p>
  return (
    <table className="w-full text-sm text-left">
      <tbody>
        {rows.map(r => (
          <tr key={r.accountId} style={{ borderTop: '1px solid #F1F5F9' }}>
            <td className="px-5 py-2.5 text-xs font-mono w-24" style={{ color: '#94A3B8' }}>{r.accountCode}</td>
            <td className="px-4 py-2.5" style={{ color: '#64748B' }}>{r.accountName}</td>
            <td className="px-4 py-2.5 text-right font-medium text-[#1E293B]">{fmt(r.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function PLPage() {
  const today = new Date().toISOString().slice(0, 10)

  const [startDate, setStartDate] = useState('')
  const [endDate,   setEndDate]   = useState(today)
  const [data,      setData]      = useState<PLData | null>(null)
  const [loading,   setLoading]   = useState(true)

  // Load FY start from company settings on mount; fall back to April 1 if unavailable.
  useEffect(() => {
    fetch('/api/company-settings')
      .then(r => r.json())
      .then((s: { fyStartDate?: string }) => {
        setStartDate(s.fyStartDate ?? (() => {
          const yr = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1
          return `${yr}-04-01`
        })())
      })
      .catch(() => {
        const yr = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1
        setStartDate(`${yr}-04-01`)
      })
  }, [])

  const load = useCallback(async () => {
    if (!startDate) return
    setLoading(true)
    const qs  = `?startDate=${startDate}&endDate=${endDate}`
    const res = await fetch(`/api/reports/pl${qs}`)
    const d   = await res.json().catch(() => null)
    setData(d)
    setLoading(false)
  }, [startDate, endDate])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/reports" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Reports</Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">Profit &amp; Loss Account</h1>
      </div>

      {/* Date range */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: '#64748B' }}>From</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="fp-input"
            style={{ width: 'auto' }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: '#64748B' }}>To</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="fp-input"
            style={{ width: 'auto' }}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
      ) : !data ? (
        <div className="text-center py-16 text-sm" style={{ color: '#94A3B8' }}>Failed to load report.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Income */}
          <div className="fp-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-green-50">
              <h2 className="text-sm font-semibold text-green-800">Income</h2>
              <span className="text-sm font-bold text-green-700">{fmt(data.totalIncome)}</span>
            </div>
            <AccountTable rows={data.income} />
            {data.income.length > 0 && (
              <div className="flex justify-between px-5 py-3 bg-green-50 border-t border-green-100">
                <span className="text-sm font-semibold text-green-800">Total Income</span>
                <span className="text-sm font-bold text-green-700">{fmt(data.totalIncome)}</span>
              </div>
            )}
          </div>

          {/* Expenses */}
          <div className="fp-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-red-50">
              <h2 className="text-sm font-semibold text-red-800">Expenses</h2>
              <span className="text-sm font-bold text-red-700">{fmt(data.totalExpense)}</span>
            </div>
            <AccountTable rows={data.expenses} />
            {data.expenses.length > 0 && (
              <div className="flex justify-between px-5 py-3 bg-red-50 border-t border-red-100">
                <span className="text-sm font-semibold text-red-800">Total Expenses</span>
                <span className="text-sm font-bold text-red-700">{fmt(data.totalExpense)}</span>
              </div>
            )}
          </div>

          {/* Net Profit / Loss */}
          <div className={`rounded-xl border-2 p-6 text-center ${data.isProfit ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${data.isProfit ? 'text-green-600' : 'text-red-600'}`}>
              {data.isProfit ? 'Net Profit' : 'Net Loss'}
            </p>
            <p className={`text-4xl font-bold ${data.isProfit ? 'text-green-700' : 'text-red-700'}`}>
              {data.isProfit ? '' : '− '}{fmt(Math.abs(Number(data.netProfit)))}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {startDate} to {endDate}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

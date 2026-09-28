'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import LoadingSpinner from '@/app/components/ui/LoadingSpinner'

type PLLine = { ledgerCode: string; ledgerName: string; amount: string }
type PLData = {
  period:      { startDate: string | null; endDate: string | null }
  income:      PLLine[]
  expenses:    PLLine[]
  totalIncome:  string
  totalExpense: string
  netProfit:   string
  isProfit:    boolean
}

const fmt = (n: string | number) =>
  `₹ ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

function Section({ title, lines, total, color }: {
  title: string; lines: PLLine[]; total: string; color: string
}) {
  return (
    <div>
      <div className="px-5 py-3 border-b border-[#F1F5F9]" style={{ background: `${color}08` }}>
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color }}>{title}</p>
      </div>
      {lines.length === 0 ? (
        <p className="px-5 py-3 text-xs" style={{ color: '#94A3B8' }}>No entries in this period.</p>
      ) : (
        lines.map(l => (
          <div key={l.ledgerCode} className="flex justify-between items-center px-5 py-2.5 border-b border-[#F8FAFC]">
            <div>
              <span className="text-sm text-[#374151]">{l.ledgerName}</span>
              <span className="text-xs ml-2 font-mono" style={{ color: '#94A3B8' }}>{l.ledgerCode}</span>
            </div>
            <span className="font-mono text-sm" style={{ color }}>{fmt(l.amount)}</span>
          </div>
        ))
      )}
      <div className="flex justify-between items-center px-5 py-3" style={{ background: `${color}06` }}>
        <span className="text-sm font-semibold text-[#1E293B]">Total {title}</span>
        <span className="font-bold font-mono" style={{ color }}>{fmt(total)}</span>
      </div>
    </div>
  )
}

export default function PLPage() {
  const today    = new Date().toISOString().slice(0, 10)
  const fyYear   = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1
  const fyStartD = `${fyYear}-04-01`

  const [startDate, setStartDate] = useState(fyStartD)
  const [endDate,   setEndDate]   = useState(today)
  const [data,      setData]      = useState<PLData | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  const load = useCallback((s: string, e: string) => {
    setLoading(true)
    setError('')
    fetch(`/api/reports/pl?startDate=${s}&endDate=${e}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load report'); setLoading(false) })
  }, [])

  useEffect(() => { load(fyStartD, today) }, [fyStartD, today, load])

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/accounts/reports" className="text-xs hover:underline" style={{ color: '#94A3B8' }}>
          ← Reports
        </Link>
        <span style={{ color: '#CBD5E1' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">Profit & Loss</h1>
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

      {error && (
        <div className="mb-4 px-4 py-3 text-sm rounded-lg" style={{ background: '#FEF2F2', color: '#B91C1C' }}>{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><LoadingSpinner size={32} /></div>
      ) : data && (
        <div className="fp-card overflow-hidden" style={{ borderRadius: '12px' }}>
          <div className="px-5 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC]">
            <p className="text-sm font-semibold text-[#1E293B]">
              Profit & Loss Statement
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
              {data.period.startDate} to {data.period.endDate}
            </p>
          </div>

          <Section title="Income"   lines={data.income}   total={data.totalIncome}  color="#16A34A" />
          <Section title="Expenses" lines={data.expenses} total={data.totalExpense} color="#DC2626" />

          {/* Net Profit row */}
          <div className="flex justify-between items-center px-5 py-4"
            style={{ background: data.isProfit ? '#F0FDF4' : '#FEF2F2', borderTop: '2px solid #E2E8F0' }}>
            <span className="font-bold text-base text-[#1E293B]">
              Net {data.isProfit ? 'Profit' : 'Loss'}
            </span>
            <span className="font-bold text-lg font-mono" style={{ color: data.isProfit ? '#16A34A' : '#DC2626' }}>
              {fmt(Math.abs(Number(data.netProfit)))}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type TDSRow = {
  id:            string
  jobCardNumber: string
  customerName:  string
  customerPhone: string
  serviceType:   string
  vehicleModel:  string
  scheduledDate: string
  amount:        string
  tdsRate:       string
  tdsAmount:     string
}

type TDSData = {
  startDate:   string
  endDate:     string
  rows:        TDSRow[]
  totalAmount: string
  totalTDS:    string
}

function currentMonthRange() {
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    start: start.toISOString().slice(0, 10),
    end:   end.toISOString().slice(0, 10),
  }
}

const fmt = (n: string | number) =>
  `₹ ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

function SummaryCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color: string
}) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${color}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-xl font-bold tabular-nums">{fmt(value)}</p>
      {sub && <p className="text-xs opacity-60">{sub}</p>}
    </div>
  )
}

export default function TDSReportPage() {
  const range = currentMonthRange()

  const [startDate, setStartDate] = useState(range.start)
  const [endDate,   setEndDate]   = useState(range.end)
  const [data,      setData]      = useState<TDSData | null>(null)
  const [loading,   setLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/reports/tds?startDate=${startDate}&endDate=${endDate}`)
    const d   = await res.json().catch(() => null)
    setData(d)
    setLoading(false)
  }, [startDate, endDate])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/reports" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Reports</Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">TDS Report</h1>
      </div>

      {/* Date range picker */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium w-14" style={{ color: '#64748B' }}>From</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="fp-input"
            style={{ width: 'auto' }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium w-14" style={{ color: '#64748B' }}>To</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="fp-input"
            style={{ width: 'auto' }}
          />
        </div>
        {data && !loading && (
          <span className="text-xs" style={{ color: '#94A3B8' }}>
            {data.rows.length} qualifying payment{data.rows.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
      ) : !data ? (
        <div className="text-center py-16 text-sm" style={{ color: '#94A3B8' }}>Failed to load TDS report.</div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SummaryCard
              label="Total Service Amount"
              value={data.totalAmount}
              sub="Completed jobs above ₹30,000"
              color="bg-blue-50 border-blue-200 text-blue-900"
            />
            <SummaryCard
              label="Total TDS Deducted"
              value={data.totalTDS}
              sub="@ 10% under Section 194C"
              color="bg-[#F8FAFC] border-[#E2E8F0] text-[#1E293B]"
            />
          </div>

          {/* Table */}
          <div className="fp-card overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <h2 className="text-sm font-semibold text-[#1E293B]">TDS Deduction Details</h2>
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                Completed service jobs · Amount &gt; ₹30,000 · TDS @ 10%
              </p>
            </div>

            {data.rows.length === 0 ? (
              <div className="py-16 text-center text-sm" style={{ color: '#94A3B8' }}>
                No qualifying service payments in this date range.
                <p className="text-xs mt-1" style={{ color: '#CBD5E1' }}>TDS applies on completed jobs where amount &gt; ₹30,000</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left fp-table">
                  <thead>
                    <tr>
                      <th>Job Card #</th>
                      <th>Customer</th>
                      <th>Service Type</th>
                      <th>Date</th>
                      <th className="text-right">Amount</th>
                      <th className="text-right">TDS Rate</th>
                      <th className="text-right">TDS Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map(row => (
                      <tr key={row.id}>
                        <td className="font-mono text-xs whitespace-nowrap" style={{ color: '#64748B' }}>
                          {row.jobCardNumber}
                        </td>
                        <td>
                          <div className="font-medium text-[#1E293B]">{row.customerName}</div>
                          {row.customerPhone && (
                            <div className="text-xs" style={{ color: '#94A3B8' }}>{row.customerPhone}</div>
                          )}
                        </td>
                        <td>
                          <div style={{ color: '#374151' }}>{row.serviceType}</div>
                          <div className="text-xs" style={{ color: '#94A3B8' }}>{row.vehicleModel}</div>
                        </td>
                        <td className="whitespace-nowrap text-xs" style={{ color: '#94A3B8' }}>
                          {fmtDate(row.scheduledDate)}
                        </td>
                        <td className="text-right tabular-nums" style={{ color: '#374151' }}>
                          {fmt(row.amount)}
                        </td>
                        <td className="text-right tabular-nums" style={{ color: '#94A3B8' }}>
                          {row.tdsRate}%
                        </td>
                        <td className="text-right tabular-nums font-semibold text-[#1E293B]">
                          {fmt(row.tdsAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                      <td className="px-4 py-3 font-bold text-[#1E293B]" colSpan={4}>
                        Total ({data.rows.length} payment{data.rows.length !== 1 ? 's' : ''})
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-[#1E293B]">
                        {fmt(data.totalAmount)}
                      </td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-[#1E293B]">
                        {fmt(data.totalTDS)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Footnote */}
          <p className="text-xs text-center" style={{ color: '#94A3B8' }}>
            TDS @ 10% on service payments above ₹30,000 · Section 194C of the Income Tax Act, 1961
          </p>
        </div>
      )}
    </div>
  )
}

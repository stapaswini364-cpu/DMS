'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type GSTRow = {
  bookingId:     string
  invoiceNo:     string
  customerName:  string
  customerPhone: string
  vehicle:       string
  bookingDate:   string
  status:        string
  taxableAmount: string
  cgst:          string
  sgst:          string
  igst:          string
  tcs:           string
  totalGst:      string
  grandTotal:    string
}

type GSTData = {
  startDate:          string
  endDate:            string
  rows:               GSTRow[]
  totalTaxableAmount: string
  totalCGST:          string
  totalSGST:          string
  totalIGST:          string
  totalTCS:           string
  totalGSTCollected:  string
}

// Default to current month
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

export default function GSTReportPage() {
  const range = currentMonthRange()

  const [startDate, setStartDate] = useState(range.start)
  const [endDate,   setEndDate]   = useState(range.end)
  const [data,      setData]      = useState<GSTData | null>(null)
  const [loading,   setLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(
      `/api/reports/gst?startDate=${startDate}&endDate=${endDate}`,
    )
    const d = await res.json().catch(() => null)
    setData(d)
    setLoading(false)
  }, [startDate, endDate])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/reports" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Reports</Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">GST Report</h1>
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
            {data.rows.length} invoice{data.rows.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
      ) : !data ? (
        <div className="text-center py-16 text-sm" style={{ color: '#94A3B8' }}>Failed to load GST report.</div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SummaryCard
              label="Total Taxable Amount"
              value={data.totalTaxableAmount}
              sub="Ex-showroom basis"
              color="bg-blue-50 border-blue-200 text-blue-900"
            />
            <SummaryCard
              label="Total CGST (9%)"
              value={data.totalCGST}
              color="bg-purple-50 border-purple-200 text-purple-900"
            />
            <SummaryCard
              label="Total SGST (9%)"
              value={data.totalSGST}
              color="bg-indigo-50 border-indigo-200 text-indigo-900"
            />
            <SummaryCard
              label="Total GST Collected"
              value={data.totalGSTCollected}
              sub={Number(data.totalTCS) > 0 ? `+ TCS ${fmt(data.totalTCS)}` : undefined}
              color="bg-[#F8FAFC] border-[#E2E8F0] text-[#1E293B]"
            />
          </div>

          {/* Table */}
          <div className="fp-card overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <h2 className="text-sm font-semibold text-[#1E293B]">Invoice-wise GST Breakdown</h2>
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                CONFIRMED and DELIVERED bookings · Intrastate (CGST + SGST @ 18%)
              </p>
            </div>

            {data.rows.length === 0 ? (
              <div className="py-16 text-center text-sm" style={{ color: '#94A3B8' }}>
                No confirmed or delivered bookings in this date range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left fp-table">
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Vehicle</th>
                      <th className="text-right">Taxable Amt</th>
                      <th className="text-right">CGST 9%</th>
                      <th className="text-right">SGST 9%</th>
                      <th className="text-right">IGST 18%</th>
                      <th className="text-right">TCS 1%</th>
                      <th className="text-right">Total GST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map(row => (
                      <tr key={row.bookingId}>
                        <td className="font-mono text-xs whitespace-nowrap" style={{ color: '#64748B' }}>
                          {row.invoiceNo}
                        </td>
                        <td className="whitespace-nowrap text-xs" style={{ color: '#94A3B8' }}>
                          {fmtDate(row.bookingDate)}
                        </td>
                        <td>
                          <div className="font-medium text-[#1E293B]">{row.customerName}</div>
                          {row.customerPhone && (
                            <div className="text-xs" style={{ color: '#94A3B8' }}>{row.customerPhone}</div>
                          )}
                        </td>
                        <td className="text-xs max-w-[160px] truncate" style={{ color: '#64748B' }}>
                          {row.vehicle}
                        </td>
                        <td className="text-right tabular-nums" style={{ color: '#374151' }}>
                          {fmt(row.taxableAmount)}
                        </td>
                        <td className="text-right tabular-nums text-purple-700">
                          {Number(row.cgst) > 0 ? fmt(row.cgst) : <span style={{ color: '#CBD5E1' }}>—</span>}
                        </td>
                        <td className="text-right tabular-nums text-indigo-700">
                          {Number(row.sgst) > 0 ? fmt(row.sgst) : <span style={{ color: '#CBD5E1' }}>—</span>}
                        </td>
                        <td className="text-right tabular-nums text-blue-700">
                          {Number(row.igst) > 0 ? fmt(row.igst) : <span style={{ color: '#CBD5E1' }}>—</span>}
                        </td>
                        <td className="text-right tabular-nums text-orange-700">
                          {Number(row.tcs) > 0 ? fmt(row.tcs) : <span style={{ color: '#CBD5E1' }}>—</span>}
                        </td>
                        <td className="text-right tabular-nums font-semibold text-[#1E293B]">
                          {fmt(row.totalGst)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals */}
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                      <td className="px-4 py-3 font-bold text-[#1E293B]" colSpan={4}>
                        Total ({data.rows.length} invoice{data.rows.length !== 1 ? 's' : ''})
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-[#1E293B]">
                        {fmt(data.totalTaxableAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-purple-800">
                        {fmt(data.totalCGST)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-indigo-800">
                        {fmt(data.totalSGST)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-blue-800">
                        {Number(data.totalIGST) > 0 ? fmt(data.totalIGST) : <span style={{ color: '#CBD5E1' }}>—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-orange-800">
                        {Number(data.totalTCS) > 0 ? fmt(data.totalTCS) : <span style={{ color: '#CBD5E1' }}>—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-[#1E293B]">
                        {fmt(data.totalGSTCollected)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* TCS note */}
          {Number(data.totalTCS) > 0 && (
            <p className="text-xs text-center" style={{ color: '#94A3B8' }}>
              TCS @ 1% applied on invoices where Grand Total exceeds ₹10,00,000 (as per Income Tax Act, Section 206C)
            </p>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Summary = {
  total:        number
  draft:        number
  confirmed:    number
  delivered:    number
  cancelled:    number
  totalValue:   string
  cashValue:    string
  financeValue: string
}

type BookingRow = {
  id: string
  bookingNumber: string
  status: string
  salesType: string
  grandTotal: string
  bookingAmount: string
  pendingAmount: string
  bookingDate: string
  customer: { id: string; name: string; phone: string } | null
  vehicle: {
    frameNumber: string
    variant: { name: string; model: { name: string; brand: string } } | null
    color: { colorName: string } | null
  } | null
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT:     'fp-badge-draft',
  CONFIRMED: 'fp-badge-confirmed',
  DELIVERED: 'fp-badge-delivered',
  CANCELLED: 'fp-badge-cancelled',
}

const fmt = (n: string | number) =>
  `₹ ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="fp-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-[#1E293B]'}`}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{sub}</p>}
    </div>
  )
}

export default function DailySalesPage() {
  const [date,     setDate]     = useState(new Date().toISOString().slice(0, 10))
  const [summary,  setSummary]  = useState<Summary | null>(null)
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/reports/daily-sales?date=${date}`)
    const data = await res.json().catch(() => null)
    if (data) {
      setSummary(data.summary ?? null)
      setBookings(Array.isArray(data.bookings) ? data.bookings : [])
    }
    setLoading(false)
  }, [date])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/reports" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Reports</Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">Daily Sales</h1>
      </div>

      {/* Date picker */}
      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm font-medium" style={{ color: '#64748B' }}>Date</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="fp-input"
          style={{ width: 'auto' }}
        />
        <span className="text-xs" style={{ color: '#94A3B8' }}>
          {new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </span>
      </div>

      {loading ? (
        <div className="text-center py-16 text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
      ) : (
        <>
          {/* KPI Cards */}
          {summary && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-6">
              <KpiCard label="Total Bookings" value={summary.total} />
              <KpiCard label="Confirmed"      value={summary.confirmed} color="text-blue-600" />
              <KpiCard label="Delivered"      value={summary.delivered} color="text-green-600" />
              <KpiCard label="Total Value"    value={fmt(summary.totalValue)} />
              <KpiCard label="Cash Sales"     value={fmt(summary.cashValue)}    sub="CASH" color="text-green-700" />
              <KpiCard label="Finance Sales"  value={fmt(summary.financeValue)} sub="FINANCE" color="text-blue-700" />
            </div>
          )}

          {/* Bookings Table */}
          {bookings.length === 0 ? (
            <div className="text-center py-16 text-sm border border-dashed rounded-xl" style={{ color: '#94A3B8', borderColor: '#E2E8F0' }}>
              No bookings on {new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.
            </div>
          ) : (
            <div className="fp-card overflow-hidden">
              <div className="px-5 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
                <h2 className="text-sm font-semibold text-[#1E293B]">{bookings.length} Booking{bookings.length !== 1 ? 's' : ''}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left fp-table">
                  <thead>
                    <tr>
                      {['Booking #', 'Customer', 'Vehicle', 'Type', 'Grand Total', 'Pending', 'Status'].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map(b => (
                      <tr key={b.id} className="cursor-pointer" onClick={() => window.location.href = `/sales/${b.id}`}>
                        <td className="font-mono text-xs font-medium" style={{ color: '#1E3A5F' }}>{b.bookingNumber}</td>
                        <td>
                          <div className="font-medium text-[#374151]">{b.customer?.name ?? '—'}</div>
                          <div className="text-xs" style={{ color: '#94A3B8' }}>{b.customer?.phone}</div>
                        </td>
                        <td>
                          {b.vehicle ? (
                            <>
                              <div style={{ color: '#374151' }}>{b.vehicle.variant?.model?.name}</div>
                              <div className="text-xs" style={{ color: '#94A3B8' }}>{b.vehicle.variant?.name} · {b.vehicle.color?.colorName}</div>
                            </>
                          ) : <span style={{ color: '#94A3B8' }}>—</span>}
                        </td>
                        <td>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.salesType === 'CASH' ? 'fp-badge-active' : 'fp-badge-confirmed'}`}>
                            {b.salesType}
                          </span>
                        </td>
                        <td className="font-medium text-[#1E293B]">{fmt(b.grandTotal)}</td>
                        <td className="font-medium" style={{ color: '#DC2626' }}>
                          {Number(b.pendingAmount) > 0 ? fmt(b.pendingAmount) : <span className="font-normal" style={{ color: '#16A34A' }}>Paid</span>}
                        </td>
                        <td>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[b.status] ?? 'fp-badge-draft'}`}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Customer   = { id: string; name: string; phone: string }
type Technician = { id: string; name: string; specialization: string | null }
type ServiceType = { id: string; name: string }

type ServiceBooking = {
  id: string
  jobCardNumber: string
  status: string
  vehicleModel: string | null
  scheduledDate: string
  finalNetAmount: string | null
  customer: Customer | null
  technician: Technician | null
  serviceType: ServiceType | null
}

type Summary = {
  total: number
  pending: number
  inProgress: number
  completed: number
  cancelled: number
  waitingForParts: number
  totalValue: string
}

type DailyServiceData = {
  date: string
  summary: Summary
  bookings: ServiceBooking[]
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:           { bg: '#FEF9C3', color: '#92400E', label: 'Pending' },
  IN_PROGRESS:       { bg: '#DBEAFE', color: '#1D4ED8', label: 'In Progress' },
  COMPLETED:         { bg: '#DCFCE7', color: '#15803D', label: 'Completed' },
  CANCELLED:         { bg: '#FEE2E2', color: '#B91C1C', label: 'Cancelled' },
  WAITING_FOR_PARTS: { bg: '#FEF3C7', color: '#D97706', label: 'Waiting Parts' },
}

const fmt = (n: string | number | null | undefined) =>
  n == null ? '—' : `₹ ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

function today() { return new Date().toISOString().slice(0, 10) }

function SummaryCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px 24px', borderLeft: `4px solid ${accent}` }}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>{label}</p>
      <p className="text-xl font-bold" style={{ color: '#1E293B' }}>{value}</p>
    </div>
  )
}

export default function DailyServicePage() {
  const [date,    setDate]    = useState(today())
  const [data,    setData]    = useState<DailyServiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/reports/daily-service?date=${date}`)
      if (!res.ok) { setError('Failed to load report'); setData(null); return }
      setData(await res.json())
    } catch { setError('Failed to load report'); setData(null) }
    finally { setLoading(false) }
  }, [date])

  useEffect(() => { fetchData() }, [fetchData])

  const inputCls = 'px-3 py-2 text-sm rounded-lg border border-[#E2E8F0] bg-white text-[#1E293B] focus:outline-none focus:border-[#CC1133] transition-colors'

  return (
    <div className="p-6" style={{ background: '#F5F7FA', minHeight: '100vh' }}>
      <div className="mb-6">
        <Link href="/reports" className="text-sm hover:underline" style={{ color: '#94A3B8' }}>← Reports</Link>
        <h1 className="text-xl font-bold mt-2" style={{ color: '#1E293B' }}>Daily Service Report</h1>
        <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>Service jobs scheduled for a day</p>
      </div>

      {/* Date filter */}
      <div className="flex items-end gap-4 mb-6" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px 20px' }}>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 text-sm rounded-lg" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>{error}</div>
      )}

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <SummaryCard label="Total Jobs"   value={data.summary.total}       accent="#2563EB" />
          <SummaryCard label="Completed"    value={data.summary.completed}   accent="#16A34A" />
          <SummaryCard label="In Progress"  value={data.summary.inProgress}  accent="#2563EB" />
          <SummaryCard label="Pending"      value={data.summary.pending}     accent="#D97706" />
          <SummaryCard label="Total Value"  value={fmt(data.summary.totalValue)} accent="#CC1133" />
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#1E293B' }}>Job Cards</h2>
          {data && <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{data.bookings.length} job{data.bookings.length !== 1 ? 's' : ''}</p>}
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
        ) : !data || data.bookings.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: '#94A3B8' }}>No service jobs for this date.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  {['Job Card #', 'Customer', 'Service Type', 'Technician', 'Vehicle', 'Status', 'Amount'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.bookings.map((b, i) => {
                  const badge = STATUS_BADGE[b.status]
                  return (
                    <tr key={b.id} style={{ borderBottom: i < data.bookings.length - 1 ? '1px solid #F1F5F9' : undefined }}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: '#CC1133' }}>{b.jobCardNumber}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm" style={{ color: '#374151' }}>{b.customer?.name ?? '—'}</div>
                        <div className="text-xs" style={{ color: '#94A3B8' }}>{b.customer?.phone}</div>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#374151' }}>{b.serviceType?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#374151' }}>{b.technician?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#64748B' }}>{b.vehicleModel ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: badge?.bg ?? '#F1F5F9', color: badge?.color ?? '#475569' }}>
                          {badge?.label ?? b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#1E293B' }}>{fmt(b.finalNetAmount)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

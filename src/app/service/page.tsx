'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type ServiceRow = {
  id: string
  jobCardNumber: string
  vehicleModel: string
  vehicleFrameNumber: string | null
  vehicleRegNumber: string | null
  status: string
  scheduledDate: string
  subTotal: string
  finalNetAmount: string
  customer:    { id: string; name: string; phone: string; email: string | null } | null
  serviceType: { id: string; name: string } | null
  technician:  { id: string; name: string; specialization: string | null } | null
  location:    { id: string; name: string } | null
}

const TABS = ['All', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'WAITING_FOR_PARTS'] as const
type Tab = typeof TABS[number]

const STATUS_BADGE: Record<string, string> = {
  PENDING:           'bg-[#DBEAFE] text-[#1D4ED8]',
  IN_PROGRESS:       'bg-[#FEF3C7] text-[#92400E]',
  COMPLETED:         'bg-[#DCFCE7] text-[#15803D]',
  CANCELLED:         'bg-[#FEE2E2] text-[#B91C1C]',
  WAITING_FOR_PARTS: 'bg-[#FEF3C7] text-[#92400E]',
  DELIVERED:         'bg-[#F0FDF4] text-[#166534]',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:           'Pending',
  IN_PROGRESS:       'In Progress',
  COMPLETED:         'Completed',
  CANCELLED:         'Cancelled',
  WAITING_FOR_PARTS: 'Waiting Parts',
  DELIVERED:         'Delivered',
}

const fmt = (n: string | number) =>
  `₹ ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export default function ServicePage() {
  const router = useRouter()
  const [tab, setTab]           = useState<Tab>('All')
  const [services, setServices] = useState<ServiceRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [query, setQuery]               = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const qs  = tab !== 'All' ? `?status=${tab}` : ''
    const data = await fetch(`/api/services${qs}`).then(r => r.json()).catch(() => [])
    setServices(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [tab])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  const filtered = debouncedQuery
    ? services.filter(s => {
        const q = debouncedQuery.toLowerCase()
        return (
          s.jobCardNumber.toLowerCase().includes(q) ||
          (s.customer?.name?.toLowerCase().includes(q) ?? false) ||
          (s.customer?.phone?.toLowerCase().includes(q) ?? false) ||
          (s.customer?.email?.toLowerCase().includes(q) ?? false) ||
          (s.vehicleFrameNumber?.toLowerCase().includes(q) ?? false) ||
          (s.technician?.name?.toLowerCase().includes(q) ?? false) ||
          (s.serviceType?.name?.toLowerCase().includes(q) ?? false)
        )
      })
    : services

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B]">Service Bookings</h1>
          <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>
            {filtered.length}{debouncedQuery ? ` of ${services.length}` : ''} job card{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/service/new" className="fp-btn-primary">
          + New Service
        </Link>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by job card, customer, mobile, email, frame no., technician, service type…"
          className="fp-input w-full"
        />
      </div>

      <div className="flex gap-1 mb-5 overflow-x-auto" style={{ borderBottom: '1px solid #E2E8F0' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded-t-md whitespace-nowrap transition ${
              tab === t ? 'font-semibold -mb-px' : ''
            }`}
            style={tab === t
              ? { background: 'rgba(204,17,51,0.08)', border: '1px solid rgba(204,17,51,0.2)', borderBottom: 'none', color: '#CC1133' }
              : { color: '#94A3B8' }
            }
          >
            {t === 'All' ? 'All' : STATUS_LABEL[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: '#94A3B8' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl" style={{ color: '#94A3B8', borderColor: '#E2E8F0' }}>
          {debouncedQuery ? 'No results match your search.' : <>No service bookings found.{' '}
          <Link href="/service/new" className="hover:underline" style={{ color: '#CC1133' }}>Create one →</Link></>}
        </div>
      ) : (
        <div className="fp-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left fp-table">
              <thead>
                <tr>
                  {['Job Card', 'Customer', 'Vehicle', 'Service Type', 'Technician', 'Status', 'Scheduled', 'Amount', ''].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs font-medium" style={{ color: '#CC1133' }}>
                      {s.jobCardNumber}
                    </td>
                    <td>
                      <div className="font-medium text-[#374151]">{s.customer?.name ?? '—'}</div>
                      <div className="text-xs" style={{ color: '#94A3B8' }}>{s.customer?.phone}</div>
                    </td>
                    <td>
                      <div style={{ color: '#374151' }}>{s.vehicleModel}</div>
                      <div className="text-xs" style={{ color: '#94A3B8' }}>
                        {s.vehicleFrameNumber && <span>{s.vehicleFrameNumber}</span>}
                        {s.vehicleRegNumber && <span className="ml-1">· {s.vehicleRegNumber}</span>}
                      </div>
                    </td>
                    <td style={{ color: '#374151' }}>{s.serviceType?.name ?? '—'}</td>
                    <td style={{ color: '#374151' }}>{s.technician?.name ?? '—'}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_BADGE[s.status] ?? 'bg-[#F1F5F9] text-[#475569]'}`}>
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-xs" style={{ color: '#94A3B8' }}>
                      {new Date(s.scheduledDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="font-medium text-[#1E293B] whitespace-nowrap">
                      {Number(s.finalNetAmount) > 0 ? fmt(s.finalNetAmount) : fmt(s.subTotal)}
                    </td>
                    <td>
                      <button
                        onClick={() => router.push(`/service/${s.id}`)}
                        className="fp-btn-secondary text-xs"
                        style={{ padding: '5px 12px' }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

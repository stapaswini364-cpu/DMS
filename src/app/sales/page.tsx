'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type BookingRow = {
  id: string
  bookingNumber: string
  status: string
  salesType: string
  grandTotal: string
  bookingDate: string
  customer: { name: string; phone: string; email: string | null } | null
  vehicle: {
    frameNumber: string
    variant: { name: string; model: { name: string; brand: string } } | null
    color: { colorName: string } | null
  } | null
}

const TABS = ['All', 'DRAFT', 'CONFIRMED', 'DELIVERED', 'CANCELLED'] as const
type Tab = typeof TABS[number]

const STATUS_BADGE: Record<string, string> = {
  DRAFT:     'fp-badge-draft',
  CONFIRMED: 'fp-badge-confirmed',
  DELIVERED: 'fp-badge-delivered',
  CANCELLED: 'fp-badge-cancelled',
}

const fmt = (n: string | number) =>
  `₹ ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export default function SalesPage() {
  const router = useRouter()
  const [tab, setTab]               = useState<Tab>('All')
  const [bookings, setBookings]     = useState<BookingRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [query, setQuery]           = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const qs = tab !== 'All' ? `?status=${tab}` : ''
    const res = await fetch(`/api/bookings${qs}`)
    if (res.ok) setBookings(await res.json())
    setLoading(false)
  }, [tab])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  const filtered = debouncedQuery
    ? bookings.filter((b) => {
        const q = debouncedQuery.toLowerCase()
        return (
          b.bookingNumber.toLowerCase().includes(q) ||
          (b.customer?.name?.toLowerCase().includes(q) ?? false) ||
          (b.customer?.phone?.toLowerCase().includes(q) ?? false) ||
          (b.customer?.email?.toLowerCase().includes(q) ?? false) ||
          (b.vehicle?.frameNumber?.toLowerCase().includes(q) ?? false)
        )
      })
    : bookings

  async function handleConfirm(id: string) {
    setConfirming(id)
    await fetch(`/api/bookings/${id}/confirm`, { method: 'POST' })
    setConfirming(null)
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B]">Sales Bookings</h1>
          <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>{filtered.length} booking{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/sales/new"
          className="fp-btn-primary"
        >
          + New Booking
        </Link>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by booking no, customer name, vehicle, mobile..."
          className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition"
          style={{
            borderColor: '#E2E8F0',
            color: '#1E293B',
            background: '#FAFAFA',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#CC1133' }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = '#E2E8F0' }}
        />
      </div>

      <div className="flex gap-1 mb-5 overflow-x-auto scrollbar-none" style={{ borderBottom: '1px solid #E2E8F0' }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded-t-md transition ${
              tab === t
                ? 'font-semibold -mb-px'
                : 'hover:text-[#1E293B]'
            }`}
            style={tab === t
              ? { background: 'rgba(204,17,51,0.08)', border: '1px solid rgba(204,17,51,0.2)', borderBottom: 'none', color: '#CC1133' }
              : { color: '#94A3B8' }
            }
          >
            {t === 'All' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: '#94A3B8' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl" style={{ color: '#94A3B8', borderColor: '#E2E8F0' }}>
          {debouncedQuery ? `No bookings match "${debouncedQuery}".` : 'No bookings found.'}{' '}
          {!debouncedQuery && <Link href="/sales/new" className="hover:underline" style={{ color: '#CC1133' }}>Create one →</Link>}
        </div>
      ) : (
        <div className="fp-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm text-left fp-table">
            <thead>
              <tr>
                {['Booking #', 'Customer', 'Vehicle', 'Grand Total', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id}>
                  <td className="font-mono text-xs font-semibold" style={{ color: '#1E3A5F' }}>{b.bookingNumber}</td>
                  <td>
                    <div className="font-medium text-[#374151]">{b.customer?.name ?? '—'}</div>
                    <div className="text-xs" style={{ color: '#94A3B8' }}>{b.customer?.phone}</div>
                  </td>
                  <td>
                    {b.vehicle ? (
                      <>
                        <div style={{ color: '#374151' }}>
                          {b.vehicle.variant?.model?.name}
                        </div>
                        <div className="text-xs" style={{ color: '#94A3B8' }}>
                          {b.vehicle.variant?.name} · {b.vehicle.color?.colorName} · {b.vehicle.frameNumber}
                        </div>
                      </>
                    ) : <span style={{ color: '#94A3B8' }}>—</span>}
                  </td>
                  <td className="font-semibold text-[#1E293B]">{fmt(b.grandTotal)}</td>
                  <td>
                    <span className={STATUS_BADGE[b.status] ?? 'fp-badge-draft'}>
                      {b.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-xs" style={{ color: '#94A3B8' }}>
                    {new Date(b.bookingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/sales/${b.id}`)}
                        className="fp-btn-secondary text-xs"
                        style={{ padding: '5px 12px' }}
                      >
                        View
                      </button>
                      {b.status === 'DRAFT' && (
                        <button
                          onClick={() => handleConfirm(b.id)}
                          disabled={confirming === b.id}
                          className="px-3 py-1 text-xs rounded-md text-white disabled:opacity-50"
                          style={{ background: '#2563EB' }}
                        >
                          {confirming === b.id ? '…' : 'Confirm'}
                        </button>
                      )}
                    </div>
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

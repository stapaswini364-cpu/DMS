'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type InvoiceRow = {
  id: string
  bookingType: 'SALES' | 'SERVICE'
  bookingNumber: string
  status: string
  salesType: string
  grandTotal: string
  bookingDate: string
  customer: { name: string; phone: string; email: string | null } | null
  frameNumber: string | null
  vehicleLabel: string | null
}

type GeneratedRow = {
  id: string
  bookingType: 'SALES' | 'SERVICE'
  invoiceNumber: string
  generatedAt: string
  bookingId: string | null
  bookingNumber: string
  grandTotal: string
  bookingDate: string | null
  customer: { name: string; phone: string } | null
}

type CollectionItem = {
  id: string
  bookingNumber: string
  status: string
  salesType: string
  grandTotal: string
  bookingAmount: string
  pendingAmount: string
  bookingDate: string
  customer: { id: string; name: string; phone: string } | null
}

type FinanceItem = {
  id: string
  bookingNumber: string
  grandTotal: string
  financeAmount: string
  financeType: string | null
  financePersonName: string | null
  deliveryOrderNumber: string | null
  bookingDate: string
  customer: { id: string; name: string; phone: string } | null
  financer: { id: string; name: string; contactPerson: string | null; phone: string | null } | null
}

type OutstandingData = {
  collectionOutstanding: {
    totalAmount: string
    count: number
    buckets: Record<string, { count: number; amount: string; items: CollectionItem[] }>
  }
  financeOutstanding: {
    totalAmount: string
    count: number
    items: FinanceItem[]
  }
}

const BUCKETS = ['0-7 days', '8-30 days', '31-60 days', '60+ days'] as const
const BUCKET_COLOR: Record<string, string> = {
  '0-7 days':   'fp-badge-active',
  '8-30 days':  'fp-badge-trial',
  '31-60 days': 'bg-[#FEF3C7] text-[#92400E]',
  '60+ days':   'fp-badge-cancelled',
}

const STATUS_BADGE: Record<string, string> = {
  CONFIRMED: 'fp-badge-confirmed',
  DELIVERED: 'fp-badge-delivered',
  COMPLETED: 'fp-badge-active',
}

const fmt = (n: string | number) =>
  `₹ ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export default function BillingPage() {
  const router = useRouter()

  const [invoices,    setInvoices]    = useState<InvoiceRow[]>([])
  const [generated,   setGenerated]   = useState<GeneratedRow[]>([])
  const [outstanding, setOutstanding] = useState<OutstandingData | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [loadError,   setLoadError]   = useState('')
  const [genLoading,  setGenLoading]  = useState(true)
  const [outLoading,  setOutLoading]  = useState(true)
  const [outTab,      setOutTab]      = useState<'collection' | 'finance'>('collection')
  const [search,      setSearch]      = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadInvoices = useCallback(async (q: string) => {
    setLoading(true)
    setLoadError('')
    const url = q ? `/api/billing/invoices?search=${encodeURIComponent(q)}` : '/api/billing/invoices'
    try {
      const res  = await fetch(url)
      const data = await res.json()
      if (!res.ok) {
        setLoadError((data as { error?: string }).error ?? `Server error ${res.status}`)
        setInvoices([])
      } else {
        setInvoices(Array.isArray(data) ? data : [])
      }
    } catch {
      setLoadError('Failed to load invoices — check server logs.')
      setInvoices([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadInvoices('')

    fetch('/api/billing/invoices/generated')
      .then(r => r.json())
      .then(d => setGenerated(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setGenLoading(false))

    fetch('/api/reports/outstanding')
      .then(r => r.json())
      .then(d => setOutstanding(d))
      .catch(() => {})
      .finally(() => setOutLoading(false))
  }, [loadInvoices])

  function handleSearch(value: string) {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadInvoices(value), 300)
  }

  const col = outstanding?.collectionOutstanding
  const fin = outstanding?.financeOutstanding

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E293B]">Billing & Invoices</h1>
        <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>
          {invoices.length} pending invoice{invoices.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Tax Invoices (pending) ── */}
      <div className="fp-card overflow-hidden mb-6">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h2 className="text-sm font-semibold text-[#1E293B]">Tax Invoices</h2>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
            Confirmed / completed bookings awaiting invoice generation
          </p>
        </div>

        <div className="px-5 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by customer, frame no., job card no., phone…"
            className="fp-input max-w-sm"
          />
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
        ) : loadError ? (
          <div className="py-16 text-center text-sm" style={{ color: '#DC2626' }}>
            Error loading invoices: {loadError}
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: '#94A3B8' }}>
            {search ? 'No invoices found.' : 'No pending invoices. All confirmed bookings have been invoiced.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left fp-table">
              <thead>
                <tr>
                  {['Booking #', 'Customer', 'Vehicle', 'Type', 'Grand Total', 'Status', 'Date', ''].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="font-mono text-xs font-medium" style={{ color: '#CC1133' }}>
                      {inv.bookingNumber}
                      {inv.bookingType === 'SERVICE' && (
                        <span className="ml-1 text-xs font-sans px-1 py-0.5 rounded" style={{ background: '#EFF6FF', color: '#2563EB' }}>SVC</span>
                      )}
                    </td>
                    <td>
                      <div className="font-medium text-[#374151]">{inv.customer?.name ?? '—'}</div>
                      <div className="text-xs" style={{ color: '#94A3B8' }}>{inv.customer?.phone}</div>
                    </td>
                    <td>
                      {inv.frameNumber
                        ? <div className="font-mono text-xs" style={{ color: '#374151' }}>{inv.frameNumber}</div>
                        : inv.vehicleLabel
                          ? <div style={{ color: '#374151' }}>{inv.vehicleLabel}</div>
                          : <span style={{ color: '#94A3B8' }}>—</span>}
                    </td>
                    <td>
                      <span className={inv.salesType === 'CASH' ? 'fp-badge-delivered' : inv.salesType === 'SERVICE' ? 'fp-badge-trial' : 'fp-badge-confirmed'}>
                        {inv.salesType}
                      </span>
                    </td>
                    <td className="font-medium text-[#1E293B]">{fmt(inv.grandTotal)}</td>
                    <td>
                      <span className={STATUS_BADGE[inv.status] ?? 'fp-badge-draft'}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-xs" style={{ color: '#94A3B8' }}>
                      {inv.bookingDate
                        ? new Date(inv.bookingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => router.push(
                            `/billing/invoices/${inv.id}${inv.bookingType === 'SERVICE' ? '?type=SERVICE' : ''}`
                          )}
                          className="text-xs px-2 py-1 rounded font-medium whitespace-nowrap"
                          style={{ color: '#2563EB', background: '#EFF6FF' }}
                        >
                          View
                        </button>
                        <button
                          onClick={() => window.open(`/api/billing/invoices/${inv.id}/pdf`, '_blank', 'noopener,noreferrer')}
                          className="text-xs px-2 py-1 rounded font-medium whitespace-nowrap"
                          style={{ color: '#64748B', background: '#F1F5F9' }}
                        >
                          ⎙ PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Generated Invoices ── */}
      <div className="fp-card overflow-hidden mb-6">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h2 className="text-sm font-semibold text-[#1E293B]">Generated Invoices</h2>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
            {genLoading ? '…' : `${generated.length} invoice${generated.length !== 1 ? 's' : ''} generated`}
          </p>
        </div>

        {genLoading ? (
          <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
        ) : generated.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>No invoices generated yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left fp-table">
              <thead>
                <tr>
                  {['Invoice #', 'Booking #', 'Customer', 'Amount', 'Generated', ''].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {generated.map(g => (
                  <tr key={g.id}>
                    <td className="font-mono text-xs font-semibold" style={{ color: '#1E293B' }}>
                      {g.invoiceNumber}
                    </td>
                    <td className="font-mono text-xs" style={{ color: '#CC1133' }}>
                      {g.bookingNumber}
                      {g.bookingType === 'SERVICE' && (
                        <span className="ml-1 font-sans px-1 py-0.5 rounded" style={{ background: '#EFF6FF', color: '#2563EB' }}>SVC</span>
                      )}
                    </td>
                    <td>
                      <div className="font-medium text-[#374151]">{g.customer?.name ?? '—'}</div>
                      <div className="text-xs" style={{ color: '#94A3B8' }}>{g.customer?.phone}</div>
                    </td>
                    <td className="font-medium text-[#1E293B]">{fmt(g.grandTotal)}</td>
                    <td className="whitespace-nowrap text-xs" style={{ color: '#94A3B8' }}>
                      {new Date(g.generatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      <button
                        onClick={() => window.open(`/api/billing/invoices/${g.bookingId}/pdf`, '_blank', 'noopener,noreferrer')}
                        className="text-xs px-2 py-1 rounded font-medium whitespace-nowrap"
                        style={{ color: '#64748B', background: '#F1F5F9' }}
                      >
                        ⎙ Reprint
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Outstanding ── */}
      <div className="fp-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <h2 className="text-sm font-semibold text-[#1E293B]">Outstanding</h2>
            {!outLoading && col && fin && (
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                Collection: {fmt(col.totalAmount)} ({col.count}) &nbsp;·&nbsp;
                Finance: {fmt(fin.totalAmount)} ({fin.count})
              </p>
            )}
          </div>
          <div className="flex gap-1">
            {(['collection', 'finance'] as const).map(t => (
              <button
                key={t}
                onClick={() => setOutTab(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  outTab === t ? 'fp-btn-primary' : 'fp-btn-secondary'
                }`}
                style={outTab === t ? { padding: '6px 12px', fontSize: '12px' } : { padding: '6px 12px', fontSize: '12px' }}
              >
                {t === 'collection' ? 'Collection' : 'Finance'}
              </button>
            ))}
          </div>
        </div>

        {outLoading ? (
          <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
        ) : outTab === 'collection' ? (
          col && col.count > 0 ? (
            <div>
              {BUCKETS.map(bucket => {
                const b = col.buckets[bucket]
                if (!b || b.count === 0) return null
                return (
                  <div key={bucket}>
                    <div className="px-5 py-2 flex items-center gap-3" style={{ background: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BUCKET_COLOR[bucket]}`}>{bucket}</span>
                      <span className="text-xs" style={{ color: '#64748B' }}>{b.count} booking{b.count !== 1 ? 's' : ''} · {fmt(b.amount)} pending</span>
                    </div>
                    <table className="w-full text-sm text-left fp-table">
                      <tbody>
                        {(b.items as CollectionItem[]).map(item => (
                          <tr key={item.id}>
                            <td className="font-mono text-xs font-medium" style={{ color: '#CC1133' }}>{item.bookingNumber}</td>
                            <td>
                              <div className="font-medium text-[#374151]">{item.customer?.name ?? '—'}</div>
                              <div className="text-xs" style={{ color: '#94A3B8' }}>{item.customer?.phone}</div>
                            </td>
                            <td className="text-xs" style={{ color: '#94A3B8' }}>
                              {new Date(item.bookingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td style={{ color: '#374151' }}>{fmt(item.grandTotal)} total</td>
                            <td className="font-semibold" style={{ color: '#DC2626' }}>{fmt(item.pendingAmount)} due</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>No collection outstanding.</div>
          )
        ) : (
          fin && fin.count > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left fp-table">
                <thead>
                  <tr>
                    {['Booking #', 'Customer', 'Financer', 'Finance Type', 'Finance Amount', 'DO Number', 'Date'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fin.items.map(item => (
                    <tr key={item.id}>
                      <td className="font-mono text-xs font-medium" style={{ color: '#CC1133' }}>{item.bookingNumber}</td>
                      <td>
                        <div className="font-medium text-[#374151]">{item.customer?.name ?? '—'}</div>
                        <div className="text-xs" style={{ color: '#94A3B8' }}>{item.customer?.phone}</div>
                      </td>
                      <td style={{ color: '#374151' }}>{item.financer?.name ?? '—'}</td>
                      <td style={{ color: '#64748B' }}>{item.financeType ?? '—'}</td>
                      <td className="font-semibold" style={{ color: '#2563EB' }}>{fmt(item.financeAmount)}</td>
                      <td className="font-mono text-xs" style={{ color: '#64748B' }}>{item.deliveryOrderNumber ?? '—'}</td>
                      <td className="text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>
                        {new Date(item.bookingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>No finance outstanding.</div>
          )
        )}
      </div>
    </div>
  )
}

'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import Link from 'next/link'

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

const BUCKET_BADGE: Record<string, { bg: string; color: string }> = {
  '0-7 days':   { bg: '#DCFCE7', color: '#15803D' },
  '8-30 days':  { bg: '#FEF3C7', color: '#92400E' },
  '31-60 days': { bg: '#FEF3C7', color: '#D97706' },
  '60+ days':   { bg: '#FEE2E2', color: '#B91C1C' },
}

const fmt = (n: string | number) =>
  `₹ ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export default function OutstandingPage() {
  const [tab,     setTab]     = useState<'collection' | 'finance'>('collection')
  const [data,    setData]    = useState<OutstandingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    fetch('/api/reports/outstanding')
      .then(r => r.json())
      .then(setData)
      .catch(() => setError('Failed to load outstanding report'))
      .finally(() => setLoading(false))
  }, [])

  const col = data?.collectionOutstanding
  const fin = data?.financeOutstanding

  return (
    <div className="p-6" style={{ background: '#F5F7FA', minHeight: '100vh' }}>
      <div className="mb-6">
        <Link href="/reports" className="text-sm hover:underline" style={{ color: '#94A3B8' }}>← Reports</Link>
        <h1 className="text-xl font-bold mt-2" style={{ color: '#1E293B' }}>Outstanding Report</h1>
        <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>Pending collection and finance settlements</p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 text-sm rounded-lg" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>{error}</div>
      )}

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px 24px', borderLeft: '4px solid #DC2626' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>Collection Outstanding</p>
            <p className="text-2xl font-bold" style={{ color: '#1E293B' }}>{fmt(col?.totalAmount ?? 0)}</p>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>{col?.count ?? 0} booking{col?.count !== 1 ? 's' : ''}</p>
          </div>
          <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px 24px', borderLeft: '4px solid #2563EB' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>Finance Outstanding</p>
            <p className="text-2xl font-bold" style={{ color: '#1E293B' }}>{fmt(fin?.totalAmount ?? 0)}</p>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>{fin?.count ?? 0} booking{fin?.count !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {/* Tab switcher + table */}
      <div className="overflow-hidden" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#1E293B' }}>
            {tab === 'collection' ? 'Collection Outstanding' : 'Finance Outstanding'}
          </h2>
          <div className="flex gap-1">
            {(['collection', 'finance'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
                style={tab === t
                  ? { background: '#CC1133', color: 'white' }
                  : { background: 'white', color: '#374151', border: '1px solid #E2E8F0' }
                }
              >
                {t === 'collection' ? 'Collection' : 'Finance'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
        ) : tab === 'collection' ? (
          !col || col.count === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: '#94A3B8' }}>No collection outstanding.</div>
          ) : (
            <div>
              {BUCKETS.map(bucket => {
                const b = col.buckets[bucket]
                if (!b || b.count === 0) return null
                const badge = BUCKET_BADGE[bucket]
                return (
                  <div key={bucket}>
                    <div className="px-5 py-2.5 flex items-center gap-3" style={{ background: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: badge.bg, color: badge.color }}>{bucket}</span>
                      <span className="text-xs" style={{ color: '#64748B' }}>{b.count} booking{b.count !== 1 ? 's' : ''} · {fmt(b.amount)} due</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                            {['Booking #', 'Customer', 'Date', 'Total', 'Paid', 'Due'].map(h => (
                              <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(b.items as CollectionItem[]).map((item, i) => (
                            <tr key={item.id} style={{ borderBottom: i < b.items.length - 1 ? '1px solid #F1F5F9' : undefined }}>
                              <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: '#CC1133' }}>{item.bookingNumber}</td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-sm" style={{ color: '#374151' }}>{item.customer?.name ?? '—'}</div>
                                <div className="text-xs" style={{ color: '#94A3B8' }}>{item.customer?.phone}</div>
                              </td>
                              <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>
                                {new Date(item.bookingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-3 text-sm" style={{ color: '#374151' }}>{fmt(item.grandTotal)}</td>
                              <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#16A34A' }}>{fmt(item.bookingAmount)}</td>
                              <td className="px-4 py-3 text-sm font-bold" style={{ color: '#DC2626' }}>{fmt(item.pendingAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          !fin || fin.count === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: '#94A3B8' }}>No finance outstanding.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                    {['Booking #', 'Customer', 'Financer', 'Finance Type', 'Finance Amt', 'DO Number', 'Date'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fin.items.map((item, i) => (
                    <tr key={item.id} style={{ borderBottom: i < fin.items.length - 1 ? '1px solid #F1F5F9' : undefined }}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: '#CC1133' }}>{item.bookingNumber}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm" style={{ color: '#374151' }}>{item.customer?.name ?? '—'}</div>
                        <div className="text-xs" style={{ color: '#94A3B8' }}>{item.customer?.phone}</div>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#374151' }}>{item.financer?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#64748B' }}>{item.financeType ?? '—'}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: '#2563EB' }}>{fmt(item.financeAmount)}</td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: '#64748B' }}>{item.deliveryOrderNumber ?? '—'}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>
                        {new Date(item.bookingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}

'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

type ServiceDetail = {
  id: string
  jobCardNumber: string
  status: string
  vehicleModel: string | null
  vehicleFrameNumber: string | null
  vehicleRegNumber: string | null
  scheduledDate: string
  bookingDate: string | null
  mrnNumber: string | null
  subTotal: string
  discount: string
  discountCategory: string | null
  discountType: 'FLAT' | 'PERCENTAGE' | null
  discountValue: string | null
  discountRemarks: string | null
  advanceAmount: string
  mrnAmount: string
  finalNetAmount: string | null
  notes: string | null
  customer: {
    id: string; name: string; phone: string
    email: string | null; address: string | null
  } | null
  serviceType: { id: string; name: string } | null
  technician: { id: string; name: string; specialization: string | null } | null
  location: { id: string; name: string } | null
  createdBy: { id: string; name: string } | null
  items?: Array<{
    id: string
    itemName: string
    isGstApplicable: boolean
    gstPercent: string
    amount: string
    sortOrder: number
  }>
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:           { bg: '#DBEAFE', color: '#1D4ED8', label: 'Pending' },
  IN_PROGRESS:       { bg: '#FEF3C7', color: '#92400E', label: 'In Progress' },
  WAITING_FOR_PARTS: { bg: '#FEF3C7', color: '#D97706', label: 'Waiting for Parts' },
  COMPLETED:         { bg: '#DCFCE7', color: '#15803D', label: 'Completed' },
  CANCELLED:         { bg: '#FEE2E2', color: '#B91C1C', label: 'Cancelled' },
  DELIVERED:         { bg: '#F0FDF4', color: '#166534', label: 'Delivered' },
}

function CancelDialog({ onConfirm, onClose, loading }: {
  onConfirm: () => void; onClose: () => void; loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4" style={{ border: '1px solid #E2E8F0' }}>
        <h3 className="text-base font-bold text-[#1E293B] mb-2">Cancel Service Booking?</h3>
        <p className="text-sm mb-6" style={{ color: '#64748B' }}>
          This action cannot be undone. The booking status will be set to <strong>CANCELLED</strong>.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-lg"
            style={{ background: 'white', border: '1.5px solid #E2E8F0', color: '#374151' }}
          >
            Keep
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
            style={{ background: '#DC2626' }}
          >
            {loading ? 'Cancelling…' : 'Yes, Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}

const fmt = (n: string | number | null | undefined) =>
  n == null ? '—' : `₹ ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>{label}</span>
      <span className="text-sm" style={{ color: value ? '#1E293B' : '#CBD5E1' }}>{value ?? '—'}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
      <div className="px-5 py-3" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
        <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>{title}</h3>
      </div>
      <div className="px-5 py-4 grid grid-cols-2 gap-4">{children}</div>
    </div>
  )
}

export default function ServiceDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()

  const [data,        setData]        = useState<ServiceDetail | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [acting,      setActing]      = useState(false)
  const [showCancel,  setShowCancel]  = useState(false)
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/services/${id}`)
      if (!res.ok) { setError('Service booking not found'); setLoading(false); return }
      setData(await res.json())
    } catch { setError('Failed to load service booking') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  async function patchStatus(status: string) {
    setActing(true)
    try {
      const res = await fetch(`/api/services/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        alert(b?.error ?? 'Action failed')
        return
      }
      await load()
    } finally { setActing(false) }
  }

  async function completeService() {
    setActing(true)
    try {
      const res = await fetch(`/api/services/${id}/complete`, { method: 'POST' })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        setActionError(b?.error ?? 'Failed to complete service')
        return
      }
      await load()
    } finally { setActing(false) }
  }

  async function handleCancel() {
    setActing(true); setActionError('')
    const res = await fetch(`/api/services/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    })
    setActing(false); setShowCancel(false)
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setActionError(b?.error ?? 'Failed to cancel booking')
      return
    }
    await load()
  }

  async function handleDeliver() {
    setActing(true); setActionError('')
    const res = await fetch(`/api/services/${id}/deliver`, { method: 'POST' })
    setActing(false)
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setActionError(b?.error ?? 'Failed to mark as delivered')
      return
    }
    await load()
  }

  if (loading) {
    return (
      <div className="p-6" style={{ background: '#F5F7FA', minHeight: '100vh' }}>
        <div className="py-20 text-center text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6" style={{ background: '#F5F7FA', minHeight: '100vh' }}>
        <Link href="/service" className="text-sm hover:underline" style={{ color: '#94A3B8' }}>← Service</Link>
        <div className="mt-6 py-20 text-center text-sm" style={{ color: '#B91C1C' }}>{error || 'Not found'}</div>
      </div>
    )
  }

  const badge = STATUS_BADGE[data.status]
  const subTotal  = Number(data.subTotal)
  const discount  = Number(data.discount)
  const advance   = Number(data.advanceAmount)
  const finalNet  = data.finalNetAmount != null ? Number(data.finalNetAmount) : Math.max(0, subTotal - discount - advance)
  const hasPayment = Number(data.advanceAmount) > 0 || Number(data.mrnAmount) > 0
  const isPreComplete = ['PENDING', 'IN_PROGRESS', 'WAITING_FOR_PARTS'].includes(data.status)

  return (
    <div className="p-6" style={{ background: '#F5F7FA', minHeight: '100vh' }}>
      {showCancel && (
        <CancelDialog
          onConfirm={handleCancel}
          onClose={() => setShowCancel(false)}
          loading={acting}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <Link href="/service" className="text-sm hover:underline" style={{ color: '#94A3B8' }}>← Service</Link>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-xl font-bold" style={{ color: '#1E293B' }}>{data.jobCardNumber}</h1>
            <span
              className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: badge?.bg ?? '#F1F5F9', color: badge?.color ?? '#475569' }}
            >
              {badge?.label ?? data.status}
            </span>
          </div>
          {data.location && (
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>{data.location.name}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 flex-shrink-0 justify-end">
          {/* Edit & Cancel — only while job is still open */}
          {isPreComplete && (
            <>
              <button
                onClick={() => router.push(`/service/${id}/edit`)}
                disabled={acting}
                className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
                style={{ background: 'white', border: '1.5px solid #E2E8F0', color: '#374151' }}
              >
                Edit
              </button>
              <button
                onClick={() => setShowCancel(true)}
                disabled={acting}
                className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
                style={{ background: 'white', border: '1.5px solid #FECACA', color: '#DC2626' }}
              >
                Cancel
              </button>
            </>
          )}

          {/* Workflow buttons */}
          {data.status === 'PENDING' && (
            <button
              onClick={() => patchStatus('IN_PROGRESS')}
              disabled={acting}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ background: '#2563EB' }}
            >
              {acting ? '…' : 'Start Service'}
            </button>
          )}
          {data.status === 'IN_PROGRESS' && (
            <>
              <button
                onClick={() => patchStatus('WAITING_FOR_PARTS')}
                disabled={acting}
                className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
                style={{ background: 'white', border: '1.5px solid #E2E8F0', color: '#374151' }}
              >
                Waiting for Parts
              </button>
              <button
                onClick={completeService}
                disabled={acting}
                className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ background: '#16A34A' }}
              >
                {acting ? '…' : 'Complete Service'}
              </button>
            </>
          )}
          {data.status === 'WAITING_FOR_PARTS' && (
            <button
              onClick={() => patchStatus('IN_PROGRESS')}
              disabled={acting}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ background: '#2563EB' }}
            >
              {acting ? '…' : 'Resume Service'}
            </button>
          )}

          {/* Mark as Delivered — visible on COMPLETED, active only if payment exists */}
          {data.status === 'COMPLETED' && (
            <button
              onClick={handleDeliver}
              disabled={acting || !hasPayment}
              title={!hasPayment ? 'Record a payment first to enable delivery' : undefined}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-40 transition-opacity hover:opacity-90"
              style={{ background: '#166534' }}
            >
              {acting ? '…' : 'Mark as Delivered'}
            </button>
          )}

          <button
            onClick={() => router.push('/service')}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{ background: 'white', border: '1.5px solid #E2E8F0', color: '#374151' }}
          >
            Back
          </button>
        </div>
      </div>

      {actionError && (
        <div className="mb-4 px-4 py-3 border text-sm rounded-lg bg-[#FEE2E2] border-[#FECACA] text-[#B91C1C]">{actionError}</div>
      )}

      {data.status === 'COMPLETED' && !hasPayment && (
        <div className="mb-4 px-4 py-3 border text-sm rounded-lg" style={{ background: '#FFF7ED', borderColor: '#FED7AA', color: '#92400E' }}>
          No payment recorded yet. Record a payment via Accounts to enable Mark as Delivered.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Customer */}
        <Section title="Customer">
          <InfoRow label="Name"  value={data.customer?.name} />
          <InfoRow label="Phone" value={data.customer?.phone} />
          <InfoRow label="Email" value={data.customer?.email} />
          <InfoRow label="Address" value={data.customer?.address} />
        </Section>

        {/* Vehicle */}
        <Section title="Vehicle">
          <InfoRow label="Model"        value={data.vehicleModel} />
          <InfoRow label="Frame Number" value={data.vehicleFrameNumber} />
          <InfoRow label="Reg Number"   value={data.vehicleRegNumber} />
          <div /> {/* spacer */}
        </Section>

        {/* Service */}
        <Section title="Service">
          <InfoRow label="Service Type" value={data.serviceType?.name} />
          <InfoRow label="Technician"   value={data.technician?.name} />
          <InfoRow label="Specialization" value={data.technician?.specialization} />
          <InfoRow
            label="Scheduled Date"
            value={new Date(data.scheduledDate).toLocaleDateString('en-IN', {
              day: '2-digit', month: 'long', year: 'numeric',
            })}
          />
          {data.bookingDate && (
            <InfoRow
              label="Booking Date"
              value={new Date(data.bookingDate).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            />
          )}
          {data.mrnNumber && <InfoRow label="MRN Number" value={data.mrnNumber} />}
        </Section>

        {/* Pricing */}
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
          <div className="px-5 py-3" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
            <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>Pricing</h3>
          </div>
          <div className="px-5 py-4 flex flex-col gap-3">
            {/* Line items table */}
            {data.items && data.items.length > 0 && (
              <div className="mb-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <th className="text-left py-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Item</th>
                      <th className="text-center py-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8', width: '5rem' }}>GST</th>
                      <th className="text-right py-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8', width: '8rem' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items
                      .slice()
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map(item => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                          <td className="py-1.5" style={{ color: '#374151' }}>{item.itemName}</td>
                          <td className="py-1.5 text-center text-xs" style={{ color: item.isGstApplicable ? '#16A34A' : '#94A3B8' }}>
                            {item.isGstApplicable ? `${Number(item.gstPercent)}%` : '—'}
                          </td>
                          <td className="py-1.5 text-right text-sm font-medium" style={{ color: '#1E293B' }}>
                            {fmt(item.amount)}
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
                <div style={{ borderTop: '1px solid #E2E8F0', marginTop: '4px' }} />
              </div>
            )}

            <PricingRow label="Sub Total"   value={fmt(data.subTotal)} />
            {discount > 0 && (
              <>
                <PricingRow label={`Discount${data.discountCategory ? ` (${data.discountCategory})` : ''}${data.discountType === 'PERCENTAGE' && data.discountValue ? ` @ ${data.discountValue}%` : ''}`}
                  value={`− ${fmt(discount)}`} color="#DC2626" />
              </>
            )}
            {discount === 0 && <PricingRow label="Discount" value="—" />}
            <PricingRow label="Advance"     value={advance  > 0 ? fmt(advance) : '—'} />
            <div style={{ borderTop: '2px solid #E2E8F0', marginTop: '4px', paddingTop: '12px' }}>
              <PricingRow label="Pending Amount" value={fmt(Math.max(0, subTotal - discount - advance))} />
            </div>
            <div style={{ borderTop: '2px solid #E2E8F0', marginTop: '4px', paddingTop: '12px' }}>
              <PricingRow label="Final Net Amount" value={fmt(finalNet)} bold />
            </div>
            {data.discountRemarks && (
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Discount remarks: {data.discountRemarks}</p>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      {data.notes && (
        <div className="mt-4" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
          <div className="px-5 py-3" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
            <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>Notes</h3>
          </div>
          <p className="px-5 py-4 text-sm" style={{ color: '#374151' }}>{data.notes}</p>
        </div>
      )}

      {/* Meta */}
      {data.createdBy && (
        <p className="mt-4 text-xs" style={{ color: '#94A3B8' }}>Created by {data.createdBy.name}</p>
      )}
    </div>
  )
}

function PricingRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm" style={{ color: '#64748B' }}>{label}</span>
      <span
        className={bold ? 'text-base font-bold' : 'text-sm font-semibold'}
        style={{ color: color ?? (bold ? '#1E293B' : '#374151') }}
      >
        {value}
      </span>
    </div>
  )
}

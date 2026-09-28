'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Booking = {
  id: string
  bookingNumber: string
  status: string
  bookingDate: string
  salesType: string
  financeType: string | null
  exShowroomPrice: string
  rtoAmount: string
  insuranceAmount: string
  onRoadPrice: string
  addonPrice: string
  extendedWarranty: string
  amc: string
  handlingCharges: string
  etcCharges: string
  subTotal: string
  discountAmount: string
  grandTotal: string
  bookingAmount: string
  pendingAmount: string
  hpEnabled: boolean
  hpAmount: string
  accessories: Array<{ name: string; amount: number }> | null
  remarks: string | null
  customer: { id: string; name: string; phone: string; email: string | null; city: string | null } | null
  vehicle: {
    frameNumber: string
    engineNumber: string
    variant: { name: string; model: { name: string; brand: string; fuelType: string } }
    color: { colorName: string; colorCode: string | null } | null
    location: { name: string } | null
  } | null
  location: { name: string } | null
  financer: { name: string } | null
  salesExecutive: { name: string } | null
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT:     'fp-badge-draft',
  CONFIRMED: 'fp-badge-confirmed',
  PAID:      'fp-badge-confirmed',
  DELIVERED: 'fp-badge-delivered',
  CANCELLED: 'fp-badge-cancelled',
}

const fmt = (v: string | number | undefined | null) =>
  `₹ ${Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="fp-card overflow-hidden">
      <div className="px-5 py-3" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
        <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between py-1.5" style={{ borderBottom: '1px solid #F8FAFC' }}>
      <span className="text-xs" style={{ color: '#94A3B8' }}>{label}</span>
      <span className={`text-xs font-medium text-[#1E293B] ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

// ── Cancel confirmation dialog ─────────────────────────────────────────────────

function CancelDialog({ onConfirm, onClose, loading }: {
  onConfirm: () => void; onClose: () => void; loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4" style={{ border: '1px solid #E2E8F0' }}>
        <h3 className="text-base font-bold text-[#1E293B] mb-2">Cancel Booking?</h3>
        <p className="text-sm mb-6" style={{ color: '#64748B' }}>
          This action cannot be undone. The booking status will be set to <strong>CANCELLED</strong>.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="fp-btn-secondary disabled:opacity-50"
          >
            Keep Booking
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: '#DC2626' }}
          >
            {loading ? 'Cancelling…' : 'Yes, Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = use(params)
  const router  = useRouter()

  const [booking,      setBooking]      = useState<Booking | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [actionError,  setActionError]  = useState('')
  const [acting,       setActing]       = useState<'confirm' | 'deliver' | 'cancel' | null>(null)
  const [showCancel,   setShowCancel]   = useState(false)

  const load = useCallback(async () => {
    setError('')
    const res = await fetch(`/api/bookings/${id}`)
    if (!res.ok) { setError('Booking not found'); setLoading(false); return }
    const d = await res.json()
    setBooking(d)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleConfirm() {
    setActing('confirm'); setActionError('')
    const res = await fetch(`/api/bookings/${id}/confirm`, { method: 'POST' })
    setActing(null)
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setActionError(b?.error ?? 'Failed to confirm booking')
      return
    }
    const updated = await res.json()
    setBooking(prev => prev ? { ...prev, status: updated.status } : prev)
  }

  async function handleDeliver() {
    setActing('deliver'); setActionError('')
    const res = await fetch(`/api/bookings/${id}/deliver`, { method: 'POST' })
    setActing(null)
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setActionError(b?.error ?? 'Failed to mark as delivered')
      return
    }
    const updated = await res.json()
    setBooking(prev => prev ? { ...prev, status: updated.status } : prev)
  }

  async function handleCancel() {
    setActing('cancel'); setActionError('')
    const res = await fetch(`/api/bookings/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    setActing(null)
    setShowCancel(false)
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setActionError(b?.error ?? 'Failed to cancel booking')
      return
    }
    const updated = await res.json()
    setBooking(prev => prev ? { ...prev, status: updated.status } : prev)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="py-24 text-center text-sm" style={{ color: '#94A3B8' }}>Loading booking…</div>
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="p-6">
        <div className="py-24 text-center text-sm" style={{ color: '#DC2626' }}>{error || 'Booking not found.'}</div>
        <div className="text-center mt-4">
          <Link href="/sales" className="text-sm underline" style={{ color: '#64748B' }}>← Back to Sales</Link>
        </div>
      </div>
    )
  }

  const b           = booking
  const vehicle     = b.vehicle
  const model       = vehicle?.variant?.model
  const accessories = Array.isArray(b.accessories) ? b.accessories : []
  const addonTotal  = accessories.reduce((s, a) => s + (a.amount ?? 0), 0)
  const isTerminal  = b.status === 'DELIVERED' || b.status === 'CANCELLED'
  const canEdit     = (b.status === 'DRAFT' || b.status === 'CONFIRMED') && Number(b.bookingAmount) === 0

  return (
    <div className="p-6 max-w-4xl">
      {showCancel && (
        <CancelDialog
          onConfirm={handleCancel}
          onClose={() => setShowCancel(false)}
          loading={acting === 'cancel'}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/sales" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Sales</Link>
            <span style={{ color: '#E2E8F0' }}>/</span>
            <span className="text-sm font-mono" style={{ color: '#64748B' }}>{b.bookingNumber}</span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-xl font-bold text-[#1E293B]">Booking {b.bookingNumber}</h1>
            <span className={STATUS_BADGE[b.status] ?? 'fp-badge-draft'}>{b.status}</span>
          </div>
          <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
            {new Date(b.bookingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            {b.location && ` · ${b.location.name}`}
            {b.salesExecutive && ` · ${b.salesExecutive.name}`}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {canEdit && (
            <Link
              href={`/sales/${id}/edit`}
              className="fp-btn-secondary text-sm"
            >
              Edit
            </Link>
          )}

          {b.status === 'DRAFT' && (
            <button
              onClick={handleConfirm}
              disabled={!!acting}
              className="fp-btn-primary disabled:opacity-50"
            >
              {acting === 'confirm' ? 'Confirming…' : 'Confirm'}
            </button>
          )}

          {(b.status === 'CONFIRMED' || b.status === 'PAID') && (
            <button
              onClick={handleDeliver}
              disabled={!!acting}
              className="fp-btn-primary disabled:opacity-50"
            >
              {acting === 'deliver' ? 'Updating…' : 'Mark as Delivered'}
            </button>
          )}

          {!isTerminal && (
            <button
              onClick={() => setShowCancel(true)}
              disabled={!!acting}
              className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
              style={{ background: 'white', border: '1.5px solid #FECACA', color: '#DC2626' }}
            >
              Cancel Booking
            </button>
          )}

          <button onClick={() => router.push('/sales')} className="fp-btn-secondary">
            Back to Sales
          </button>
        </div>
      </div>

      {actionError && (
        <div className="mb-4 px-4 py-3 border text-sm rounded-lg bg-[#FEE2E2] border-[#FECACA] text-[#B91C1C]">
          {actionError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Customer */}
        <Section title="Customer">
          <Row label="Name"  value={b.customer?.name  ?? '—'} />
          <Row label="Phone" value={b.customer?.phone ?? '—'} />
          {b.customer?.email && <Row label="Email" value={b.customer.email} />}
          {b.customer?.city  && <Row label="City"  value={b.customer.city}  />}
        </Section>

        {/* Vehicle */}
        <Section title="Vehicle">
          <Row label="Model"   value={model?.name ?? '—'} />
          <Row label="Variant" value={vehicle?.variant?.name ?? '—'} />
          <Row label="Color"   value={vehicle?.color?.colorName ?? '—'} />
          <Row label="Fuel"    value={model?.fuelType ?? '—'} />
          <Row label="Frame #"  value={vehicle?.frameNumber  ?? '—'} mono />
          <Row label="Engine #" value={vehicle?.engineNumber ?? '—'} mono />
          {vehicle?.location && <Row label="Stock at" value={vehicle.location.name} />}
        </Section>

        {/* Pricing breakdown */}
        <Section title="Pricing">
          <Row label="Ex-Showroom"       value={fmt(b.exShowroomPrice)} />
          <Row label="RTO"               value={fmt(b.rtoAmount)} />
          <Row label="Insurance"         value={fmt(b.insuranceAmount)} />
          <Row label="On-Road Price"     value={fmt(b.onRoadPrice)} />
          {Number(b.addonPrice) > 0 && (
            <Row label="Addon / Accessories" value={fmt(b.addonPrice)} />
          )}
          {Number(b.extendedWarranty) > 0 && (
            <Row label="Extended Warranty"  value={fmt(b.extendedWarranty)} />
          )}
          {Number(b.amc) > 0 && <Row label="AMC" value={fmt(b.amc)} />}
          {Number(b.handlingCharges) > 0 && (
            <Row label="Handling" value={fmt(b.handlingCharges)} />
          )}
          {Number(b.etcCharges) > 0 && (
            <Row label="ETC Charges" value={fmt(b.etcCharges)} />
          )}
          {b.hpEnabled && Number(b.hpAmount) > 0 && (
            <Row label="HP Amount" value={fmt(b.hpAmount)} />
          )}
          {Number(b.discountAmount) > 0 && (
            <Row label="Discount" value={<span style={{ color: '#16A34A' }}>− {fmt(b.discountAmount)}</span>} />
          )}
          <div className="flex justify-between pt-2 mt-1" style={{ borderTop: '1px solid #E2E8F0' }}>
            <span className="text-xs font-semibold text-[#1E293B]">Grand Total</span>
            <span className="text-sm font-bold" style={{ color: '#1E3A5F' }}>{fmt(b.grandTotal)}</span>
          </div>
        </Section>

        {/* Payment */}
        <Section title="Payment">
          <Row label="Sales Type" value={b.salesType} />
          {b.salesType === 'FINANCE' && (
            <>
              <Row label="Finance Type" value={b.financeType ?? '—'} />
              <Row label="Financer"     value={b.financer?.name ?? '—'} />
            </>
          )}
          <Row
            label="Booking Amount"
            value={<span style={{ color: '#16A34A', fontWeight: 600 }}>{fmt(b.bookingAmount)}</span>}
          />
          <Row
            label="Pending Amount"
            value={
              Number(b.pendingAmount) > 0
                ? <span style={{ color: '#DC2626', fontWeight: 600 }}>{fmt(b.pendingAmount)}</span>
                : <span style={{ color: '#16A34A' }}>Nil</span>
            }
          />
        </Section>

        {/* Accessories */}
        {accessories.length > 0 && (
          <Section title="Accessories">
            {accessories.map((a, i) => <Row key={i} label={a.name} value={fmt(a.amount)} />)}
            <div className="flex justify-between pt-2 mt-1" style={{ borderTop: '1px solid #E2E8F0' }}>
              <span className="text-xs font-semibold text-[#1E293B]">Total</span>
              <span className="text-xs font-bold text-[#1E293B]">{fmt(addonTotal)}</span>
            </div>
          </Section>
        )}

        {/* Remarks */}
        {b.remarks && (
          <Section title="Remarks">
            <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{b.remarks}</p>
          </Section>
        )}
      </div>
    </div>
  )
}

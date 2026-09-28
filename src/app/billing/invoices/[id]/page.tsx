'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

type SalesBooking = {
  id: string
  bookingNumber: string
  status: string
  bookingDate: string
  salesType: string
  grandTotal: string
  exShowroomPrice: string
  rtoAmount: string
  insuranceAmount: string
  customer: { id: string; name: string; phone: string; email: string | null } | null
  vehicle: {
    frameNumber: string
    engineNumber: string
    variant: { name: string; model: { name: string; brand: string } } | null
    color: { colorName: string } | null
  } | null
}

type ServiceBooking = {
  id: string
  jobCardNumber: string
  status: string
  bookingDate: string | null
  scheduledDate: string
  finalNetAmount: string
  vehicleFrameNumber: string | null
  vehicleModel: string
  vehicleVariant: string | null
  customer: { id: string; name: string; phone: string | null; email: string | null } | null
}

const fmt = (v: string | number | null | undefined) =>
  `₹ ${Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between py-1.5" style={{ borderBottom: '1px solid #F8FAFC' }}>
      <span className="text-xs" style={{ color: '#94A3B8' }}>{label}</span>
      <span className={`text-xs font-medium text-[#1E293B] ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="fp-card overflow-hidden">
      <div className="px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
        <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ── Generate Invoice Modal ────────────────────────────────────────────────────

function GenerateModal({
  bookingType,
  prefillDate,
  prefillFrame,
  prefillJobCard,
  prefillCustomer,
  prefillGrandTotal,
  onClose,
  onSuccess,
}: {
  bookingType: 'SALES' | 'SERVICE'
  prefillDate: string
  prefillFrame?: string | null
  prefillJobCard?: string
  prefillCustomer: string
  prefillGrandTotal: string
  onClose: () => void
  onSuccess: (invoiceNumber: string) => Promise<void>
}) {
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [suggested,    setSuggested]     = useState('')
  const [submitting,   setSubmitting]    = useState(false)
  const [error,        setError]         = useState('')

  useEffect(() => {
    fetch('/api/billing/invoices/suggest-number')
      .then(r => r.json())
      .then(d => setSuggested(d.suggested ?? ''))
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = invoiceNumber.trim()
    if (!trimmed) { setError('Invoice number is required'); return }
    setError(''); setSubmitting(true)
    try {
      await onSuccess(trimmed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" style={{ border: '1px solid #E2E8F0' }}>
        <h3 className="text-base font-bold text-[#1E293B] mb-4">Generate Invoice</h3>

        <div className="rounded-lg p-3 mb-4 space-y-1" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <div className="flex justify-between text-xs">
            <span style={{ color: '#94A3B8' }}>Date</span>
            <span className="font-medium text-[#1E293B]">
              {prefillDate ? new Date(prefillDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
            </span>
          </div>
          {bookingType === 'SERVICE' && prefillJobCard && (
            <div className="flex justify-between text-xs">
              <span style={{ color: '#94A3B8' }}>Job Card No.</span>
              <span className="font-mono font-medium text-[#1E293B]">{prefillJobCard}</span>
            </div>
          )}
          {prefillFrame && (
            <div className="flex justify-between text-xs">
              <span style={{ color: '#94A3B8' }}>Frame No.</span>
              <span className="font-mono font-medium text-[#1E293B]">{prefillFrame}</span>
            </div>
          )}
          <div className="flex justify-between text-xs">
            <span style={{ color: '#94A3B8' }}>Customer</span>
            <span className="font-medium text-[#1E293B]">{prefillCustomer}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span style={{ color: '#94A3B8' }}>Grand Total</span>
            <span className="font-semibold text-[#1E293B]">{prefillGrandTotal}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-3 px-3 py-2 text-xs rounded-lg bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C]">{error}</div>
          )}
          <div className="mb-4">
            <label className="fp-label">Invoice Number *</label>
            <input
              autoFocus
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-20260823-001"
              className="fp-input"
            />
            {suggested && (
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                Suggested: <button type="button" className="font-mono hover:underline" style={{ color: '#CC1133' }} onClick={() => setInvoiceNumber(suggested)}>{suggested}</button>
              </p>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} disabled={submitting} className="fp-btn-secondary disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="fp-btn-primary disabled:opacity-50">
              {submitting ? 'Generating…' : 'Generate Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Post-generation success banner ────────────────────────────────────────────

function SuccessBanner({ invoiceNumber, pdfUrl, onBack }: { invoiceNumber: string; pdfUrl: string; onBack: () => void }) {
  return (
    <div className="mb-6 px-5 py-4 rounded-xl" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
      <p className="text-sm font-semibold" style={{ color: '#166534' }}>
        Invoice {invoiceNumber} generated successfully.
      </p>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
          className="text-xs px-3 py-1.5 rounded-lg font-medium"
          style={{ background: '#166534', color: '#fff' }}
        >
          ⎙ Download Invoice PDF
        </button>
        <button
          onClick={onBack}
          className="text-xs px-3 py-1.5 rounded-lg font-medium"
          style={{ background: '#DCFCE7', color: '#166534' }}
        >
          ← Back to Billing
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }      = use(params)
  const searchParams = useSearchParams()
  const router       = useRouter()
  const bookingType  = searchParams.get('type') === 'SERVICE' ? 'SERVICE' : 'SALES'

  const [salesBooking,          setSalesBooking]          = useState<SalesBooking | null>(null)
  const [serviceBooking,        setServiceBooking]        = useState<ServiceBooking | null>(null)
  const [loading,               setLoading]               = useState(true)
  const [error,                 setError]                 = useState('')
  const [showModal,             setShowModal]             = useState(false)
  const [submitError,           setSubmitError]           = useState('')
  const [generatedInvoiceNumber, setGeneratedInvoiceNumber] = useState('')

  useEffect(() => {
    if (bookingType === 'SERVICE') {
      fetch(`/api/services/${id}`)
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(d => setServiceBooking(d))
        .catch(() => setError('Service booking not found'))
        .finally(() => setLoading(false))
    } else {
      fetch(`/api/bookings/${id}`)
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(d => setSalesBooking(d))
        .catch(() => setError('Booking not found'))
        .finally(() => setLoading(false))
    }
  }, [id, bookingType])

  async function handleGenerate(invoiceNumber: string) {
    setSubmitError('')
    const res = await fetch(`/api/billing/invoices/${id}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceNumber, bookingType }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setShowModal(false)
      setSubmitError(data?.error ?? 'Failed to generate invoice')
      throw new Error(data?.error ?? 'Failed')
    }
    setShowModal(false)
    setGeneratedInvoiceNumber(invoiceNumber)
  }

  const pdfUrl = `/api/billing/invoices/${id}/pdf`

  if (loading) {
    return (
      <div className="p-6">
        <div className="py-24 text-center text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="py-24 text-center text-sm" style={{ color: '#DC2626' }}>{error}</div>
        <div className="text-center mt-4">
          <Link href="/billing" className="text-sm underline" style={{ color: '#64748B' }}>← Back to Billing</Link>
        </div>
      </div>
    )
  }

  // ── Service booking view ───────────────────────────────────────────────────

  if (bookingType === 'SERVICE' && serviceBooking) {
    const sb = serviceBooking
    const displayDate = sb.bookingDate ?? sb.scheduledDate

    return (
      <div className="p-6 max-w-2xl">
        {showModal && (
          <GenerateModal
            bookingType="SERVICE"
            prefillDate={displayDate}
            prefillJobCard={sb.jobCardNumber}
            prefillFrame={sb.vehicleFrameNumber}
            prefillCustomer={sb.customer?.name ?? '—'}
            prefillGrandTotal={fmt(sb.finalNetAmount)}
            onClose={() => setShowModal(false)}
            onSuccess={handleGenerate}
          />
        )}

        <div className="flex items-center gap-3 mb-6">
          <Link href="/billing" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Billing</Link>
          <span style={{ color: '#E2E8F0' }}>/</span>
          <span className="text-sm font-mono" style={{ color: '#64748B' }}>{sb.jobCardNumber}</span>
        </div>

        {submitError && (
          <div className="mb-4 px-4 py-3 border text-sm rounded-lg bg-[#FEE2E2] border-[#FECACA] text-[#B91C1C]">
            {submitError}
          </div>
        )}

        {generatedInvoiceNumber ? (
          <SuccessBanner
            invoiceNumber={generatedInvoiceNumber}
            pdfUrl={pdfUrl}
            onBack={() => router.push('/billing')}
          />
        ) : (
          <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
            <h1 className="text-xl font-bold text-[#1E293B]">Service Invoice — {sb.jobCardNumber}</h1>
            <div className="flex gap-2">
              <button
                onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
                className="fp-btn-secondary"
              >
                ⎙ Preview PDF
              </button>
              <button onClick={() => setShowModal(true)} className="fp-btn-primary">
                Generate Invoice
              </button>
            </div>
          </div>
        )}

        {!generatedInvoiceNumber && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Section title="Customer">
              <Row label="Name"  value={sb.customer?.name  ?? '—'} />
              <Row label="Phone" value={sb.customer?.phone ?? '—'} />
              {sb.customer?.email && <Row label="Email" value={sb.customer.email} />}
            </Section>
            <Section title="Vehicle">
              <Row label="Model"   value={[sb.vehicleModel, sb.vehicleVariant].filter(Boolean).join(' ') || '—'} />
              {sb.vehicleFrameNumber && <Row label="Frame #" value={sb.vehicleFrameNumber} mono />}
            </Section>
            <Section title="Pricing">
              <Row label="Grand Total" value={fmt(sb.finalNetAmount)} />
            </Section>
            <Section title="Status">
              <Row label="Status" value={sb.status} />
              <Row label="Date"   value={displayDate ? new Date(displayDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} />
            </Section>
          </div>
        )}
      </div>
    )
  }

  // ── Sales booking view ─────────────────────────────────────────────────────

  const b = salesBooking!
  return (
    <div className="p-6 max-w-2xl">
      {showModal && (
        <GenerateModal
          bookingType="SALES"
          prefillDate={b.bookingDate}
          prefillFrame={b.vehicle?.frameNumber}
          prefillCustomer={b.customer?.name ?? '—'}
          prefillGrandTotal={fmt(b.grandTotal)}
          onClose={() => setShowModal(false)}
          onSuccess={handleGenerate}
        />
      )}

      <div className="flex items-center gap-3 mb-6">
        <Link href="/billing" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Billing</Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <span className="text-sm font-mono" style={{ color: '#64748B' }}>{b.bookingNumber}</span>
      </div>

      {submitError && (
        <div className="mb-4 px-4 py-3 border text-sm rounded-lg bg-[#FEE2E2] border-[#FECACA] text-[#B91C1C]">
          {submitError}
        </div>
      )}

      {generatedInvoiceNumber ? (
        <SuccessBanner
          invoiceNumber={generatedInvoiceNumber}
          pdfUrl={pdfUrl}
          onBack={() => router.push('/billing')}
        />
      ) : (
        <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
          <h1 className="text-xl font-bold text-[#1E293B]">Sales Invoice — {b.bookingNumber}</h1>
          <div className="flex gap-2">
            <button
              onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
              className="fp-btn-secondary"
            >
              ⎙ Preview PDF
            </button>
            <button onClick={() => setShowModal(true)} className="fp-btn-primary">
              Generate Invoice
            </button>
          </div>
        </div>
      )}

      {!generatedInvoiceNumber && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Section title="Customer">
            <Row label="Name"  value={b.customer?.name  ?? '—'} />
            <Row label="Phone" value={b.customer?.phone ?? '—'} />
            {b.customer?.email && <Row label="Email" value={b.customer.email} />}
          </Section>
          <Section title="Vehicle">
            {b.vehicle?.variant?.model && (
              <Row label="Model" value={b.vehicle.variant.model.name} />
            )}
            {b.vehicle?.variant && <Row label="Variant" value={b.vehicle.variant.name} />}
            {b.vehicle?.color   && <Row label="Color"   value={b.vehicle.color.colorName} />}
            {b.vehicle?.frameNumber  && <Row label="Frame #"  value={b.vehicle.frameNumber}  mono />}
            {b.vehicle?.engineNumber && <Row label="Engine #" value={b.vehicle.engineNumber} mono />}
          </Section>
          <Section title="Pricing">
            <Row label="Ex-Showroom" value={fmt(b.exShowroomPrice)} />
            <Row label="RTO"         value={fmt(b.rtoAmount)} />
            <Row label="Insurance"   value={fmt(b.insuranceAmount)} />
            <div className="flex justify-between pt-2 mt-1" style={{ borderTop: '1px solid #E2E8F0' }}>
              <span className="text-xs font-semibold text-[#1E293B]">Grand Total</span>
              <span className="text-sm font-bold" style={{ color: '#1E3A5F' }}>{fmt(b.grandTotal)}</span>
            </div>
          </Section>
          <Section title="Status">
            <Row label="Status"     value={b.status} />
            <Row label="Sales Type" value={b.salesType} />
            <Row label="Date"       value={new Date(b.bookingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
          </Section>
        </div>
      )}
    </div>
  )
}

'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, use, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────────────────────

type MrnReceipt = {
  id: string
  mrnNumber: string
  paymentMode: string
  amount: string
  referenceNumber: string | null
  receivedAt: string
}

type BookingData = {
  id: string
  bookingNumber: string
  status: string
  bookingDate: string
  exShowroomPrice: string
  rtoAmount: string
  insuranceAmount: string
  onRoadPrice: string
  addonPrice: string
  extendedWarranty: string
  amc: string
  handlingCharges: string
  etcCharges: string
  discountAmount: string
  grandTotal: string
  bookingAmount: string
  pendingAmount: string
  accessories: Array<{ name: string; amount: number }> | null
  customer: {
    id: string
    name: string
    phone: string
    email: string | null
    city: string | null
    address: string | null
  } | null
  vehicle: {
    frameNumber: string
    engineNumber: string
    variant: {
      name: string
      model: { name: string; brand: string; fuelType: string }
    }
    color: { colorName: string } | null
    location: { name: string } | null
  } | null
  location: { id: string; name: string } | null
  financer: { name: string } | null
  mrnReceipts: MrnReceipt[]
}

type ServiceBookingData = {
  id: string
  jobCardNumber: string
  status: string
  scheduledDate: string
  bookingDate: string | null
  vehicleFrameNumber: string | null
  vehicleRegNumber: string | null
  vehicleModel: string
  vehicleVariant: string | null
  vehicleColor: string | null
  vehicleEngineNumber: string | null
  subTotal: string
  discount: string
  advanceAmount: string
  mrnAmount: string
  finalNetAmount: string
  customer: {
    id: string
    name: string
    phone: string | null
    email: string | null
  } | null
  location: { id: string; name: string } | null
  mrnReceipts: MrnReceipt[]
}

type VoucherEntry = {
  id: string
  debit: string
  credit: string
  account: {
    id: string
    accountCode: string
    accountName: string
    accountType: string
  }
}

type VoucherDetail = {
  id: string
  voucherNumber: string
  voucherType: string
  referenceType: string | null
  date: string
  amount: string
  narration: string | null
  reference: string | null
  location: { id: string; name: string } | null
  createdBy: { id: string; name: string; email: string } | null
  entries: VoucherEntry[]
  booking: BookingData | null
  serviceBooking: ServiceBookingData | null
}

type FlatLedger = {
  id:              string
  ledgerCode:      string
  ledgerName:      string
  isActive:        boolean
  allowManualEntry: boolean
  subGroupName:    string
  groupName:       string
  majorHeadName:   string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (v: string | number | undefined | null) =>
  `₹ ${Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const VOUCHER_TYPE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  RECEIPT:     { bg: '#DCFCE7', color: '#15803D', label: 'Receipt' },
  SERVICE:     { bg: '#EFF6FF', color: '#1D4ED8', label: 'Service' },
  PAYMENT:     { bg: '#FEE2E2', color: '#B91C1C', label: 'Payment' },
  CONTRA:      { bg: '#DBEAFE', color: '#1D4ED8', label: 'Contra' },
  JOURNAL:     { bg: '#FEF3C7', color: '#92400E', label: 'Journal' },
  SALES:       { bg: '#F3E8FF', color: '#7E22CE', label: 'Sales' },
  PURCHASE:    { bg: '#FFF7ED', color: '#C2410C', label: 'Purchase' },
  DEBIT_NOTE:  { bg: '#FEF9C3', color: '#713F12', label: 'Debit Note' },
  CREDIT_NOTE: { bg: '#F0FDF4', color: '#15803D', label: 'Credit Note' },
}

const inputCls = [
  'w-full px-3 py-2.5 text-sm rounded-lg',
  'border border-[#E2E8F0] bg-white text-[#1E293B]',
  'placeholder:text-[#94A3B8]',
  'focus:outline-none focus:border-[#CC1133]',
  'transition-colors',
].join(' ')

function displayTypeOf(v: VoucherDetail): string {
  if (v.referenceType === 'service') return 'SERVICE'
  return v.voucherType
}

// ── Section / Row helpers ──────────────────────────────────────────────────────

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

// ── Record Payment Dialog (ledger-based) ──────────────────────────────────────

type LedgerRow = {
  ledgerId:    string
  side:        'DR' | 'CR'
  amount:      string
}

type PaymentContext = {
  voucherId:     string
  refNumber:     string  // bookingNumber or jobCardNumber
  customerName:  string
  customerPhone: string | null
  grandTotal:    number
  paid:          number
  pending:       number
  lastPaymentAt: string | null
}

function RecordPaymentDialog({
  ctx,
  ledgers,
  onSuccess,
  onClose,
}: {
  ctx:      PaymentContext
  ledgers:  FlatLedger[]
  onSuccess: (result: { pendingAfter: number; lastPaymentAt: string; mrnNumber: string }) => void
  onClose:   () => void
}) {
  const cashBankLedgers = useMemo(
    () => ledgers.filter(l => {
      const sg = l.subGroupName.toLowerCase()
      return (sg.includes('cash') || sg.includes('bank')) && l.isActive && l.allowManualEntry
    }),
    [ledgers],
  )
  const tradeRecLedgers = useMemo(
    () => ledgers.filter(l => {
      const sg = l.subGroupName.toLowerCase()
      return (sg.includes('trade receivable') || sg.includes('accounts receivable')) && l.isActive
    }),
    [ledgers],
  )
  const allActiveLedgers = useMemo(
    () => ledgers.filter(l => l.isActive && l.allowManualEntry),
    [ledgers],
  )

  const [mrnNumber,   setMrnNumber]  = useState('')
  const [cashBankId,  setCashBankId] = useState('')
  const [cashAmount,  setCashAmount] = useState('')
  const [receivedId,  setReceivedId] = useState(tradeRecLedgers[0]?.id ?? '')
  const [crAmount,    setCrAmount]   = useState('')
  const [extraRows,   setExtraRows]  = useState<LedgerRow[]>([])
  const [submitting,  setSubmitting] = useState(false)
  const [error,       setError]      = useState('')

  useEffect(() => {
    if (!receivedId && tradeRecLedgers.length > 0) setReceivedId(tradeRecLedgers[0].id)
  }, [tradeRecLedgers, receivedId])

  // Keep Cr amount in sync with Dr amount when the user is only using the
  // two default rows (simple case).
  useEffect(() => {
    if (extraRows.length === 0) setCrAmount(cashAmount)
  }, [cashAmount, extraRows.length])

  const totalDr = Number(cashAmount || 0) + extraRows
    .filter(r => r.side === 'DR')
    .reduce((s, r) => s + Number(r.amount || 0), 0)
  const totalCr = Number(crAmount || 0) + extraRows
    .filter(r => r.side === 'CR')
    .reduce((s, r) => s + Number(r.amount || 0), 0)
  const paymentAmount = totalDr
  const newPending = Math.max(0, ctx.pending - paymentAmount)

  function updateExtra(idx: number, patch: Partial<LedgerRow>) {
    setExtraRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }
  function addExtraRow() {
    setExtraRows(prev => [...prev, { ledgerId: '', side: 'DR', amount: '' }])
  }
  function removeExtraRow(idx: number) {
    setExtraRows(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    setError('')

    if (!cashBankId)  { setError('Cash / Bank Account is required.'); return }
    if (!receivedId)  { setError('Received From ledger is required.'); return }
    if (!mrnNumber.trim()) { setError('MRN No. is required.'); return }

    const cashAmt = Number(cashAmount)
    const crAmt   = Number(crAmount)
    if (!cashAmt || cashAmt <= 0) { setError('Cash / Bank amount must be greater than 0.'); return }
    if (!crAmt   || crAmt   <= 0) { setError('Received From amount must be greater than 0.'); return }

    for (let i = 0; i < extraRows.length; i++) {
      const r = extraRows[i]
      if (!r.ledgerId)          { setError(`Extra row ${i + 1}: ledger is required.`);  return }
      if (!Number(r.amount) || Number(r.amount) <= 0) {
        setError(`Extra row ${i + 1}: amount must be greater than 0.`)
        return
      }
    }

    if (Math.abs(totalDr - totalCr) > 0.01) {
      setError(`Entry is not balanced — Dr ${totalDr.toFixed(2)} ≠ Cr ${totalCr.toFixed(2)}`)
      return
    }
    if (paymentAmount - ctx.pending > 0.01) {
      setError(`Payment (${fmt(paymentAmount)}) exceeds pending amount (${fmt(ctx.pending)}).`)
      return
    }

    const lines = [
      { ledgerId: cashBankId, debit: cashAmt, credit: 0 },
      { ledgerId: receivedId, debit: 0,       credit: crAmt },
      ...extraRows.map(r => ({
        ledgerId: r.ledgerId,
        debit:    r.side === 'DR' ? Number(r.amount) : 0,
        credit:   r.side === 'CR' ? Number(r.amount) : 0,
      })),
    ]

    setSubmitting(true)
    try {
      const res = await fetch(`/api/accounts/vouchers/${ctx.voucherId}/record-payment`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mrnNumber: mrnNumber.trim(), lines }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((body as { error?: string }).error ?? 'Failed to record payment')
        return
      }
      const parsed = body as { pendingAfter: number; lastPaymentAt: string; mrnNumber: string }
      onSuccess(parsed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.4)' }}
    >
      <div
        className="bg-white rounded-xl shadow-xl p-6 w-full mx-4 my-8"
        style={{ maxWidth: '640px', border: '1px solid #E2E8F0' }}
      >
        <h3 className="text-base font-bold text-[#1E293B] mb-0.5">Record Payment</h3>
        <p className="text-xs mb-4" style={{ color: '#94A3B8' }}>
          {ctx.refNumber} · {ctx.customerName}
          {ctx.customerPhone && <> · {ctx.customerPhone}</>}
          {' · '}Pending {fmt(ctx.pending)}
        </p>

        {/* Payment Summary strip */}
        <div className="grid grid-cols-4 rounded-lg mb-5 overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
          <div className="px-3 py-3 text-center" style={{ borderRight: '1px solid #E2E8F0' }}>
            <p className="text-xs mb-0.5" style={{ color: '#94A3B8' }}>Total</p>
            <p className="text-sm font-bold text-[#1E293B]">{fmt(ctx.grandTotal)}</p>
          </div>
          <div className="px-3 py-3 text-center" style={{ borderRight: '1px solid #E2E8F0', background: '#F0FDF4' }}>
            <p className="text-xs mb-0.5" style={{ color: '#94A3B8' }}>Paid</p>
            <p className="text-sm font-bold" style={{ color: '#16A34A' }}>{fmt(ctx.paid + paymentAmount)}</p>
          </div>
          <div className="px-3 py-3 text-center" style={{ borderRight: '1px solid #E2E8F0', background: newPending > 0 ? '#FFF5F5' : '#F0FDF4' }}>
            <p className="text-xs mb-0.5" style={{ color: '#94A3B8' }}>Pending</p>
            <p className="text-sm font-bold" style={{ color: newPending > 0 ? '#DC2626' : '#16A34A' }}>{fmt(newPending)}</p>
          </div>
          <div className="px-3 py-3 text-center">
            <p className="text-xs mb-0.5" style={{ color: '#94A3B8' }}>Last Paid</p>
            <p className="text-xs font-semibold text-[#1E293B]">
              {ctx.lastPaymentAt
                ? new Date(ctx.lastPaymentAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                : '—'}
            </p>
          </div>
        </div>

        {/* MRN */}
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
            MRN No. <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <input
            value={mrnNumber}
            onChange={e => setMrnNumber(e.target.value.toUpperCase())}
            placeholder="Enter unique MRN number"
            className={inputCls}
          />
        </div>

        {/* Ledger Accounts */}
        <div className="mb-3">
          <div className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>Ledger Accounts</div>

          {/* Cash / Bank (Dr) */}
          <div className="grid grid-cols-12 gap-2 mb-2">
            <div className="col-span-8">
              <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>
                Cash / Bank Account (Dr) <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select value={cashBankId} onChange={e => setCashBankId(e.target.value)} className={inputCls}>
                <option value="">Select cash / bank ledger…</option>
                {cashBankLedgers.map(l => (
                  <option key={l.id} value={l.id}>{l.ledgerCode} — {l.ledgerName}</option>
                ))}
              </select>
            </div>
            <div className="col-span-4">
              <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>
                Amount (Dr) <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type="number" min="0" step="0.01"
                value={cashAmount}
                onChange={e => setCashAmount(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
          </div>

          {/* Received From (Cr) */}
          <div className="grid grid-cols-12 gap-2 mb-2">
            <div className="col-span-8">
              <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>
                Received From (Cr) <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select value={receivedId} onChange={e => setReceivedId(e.target.value)} className={inputCls}>
                <option value="">Select receivable ledger…</option>
                {tradeRecLedgers.map(l => (
                  <option key={l.id} value={l.id}>{l.ledgerCode} — {l.ledgerName}</option>
                ))}
              </select>
            </div>
            <div className="col-span-4">
              <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>
                Amount (Cr) <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type="number" min="0" step="0.01"
                value={crAmount}
                onChange={e => setCrAmount(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
          </div>

          {/* Extra rows */}
          {extraRows.map((r, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-end">
              <div className="col-span-6">
                <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>Ledger</label>
                <select
                  value={r.ledgerId}
                  onChange={e => updateExtra(i, { ledgerId: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Select ledger…</option>
                  {allActiveLedgers.map(l => (
                    <option key={l.id} value={l.id}>{l.ledgerCode} — {l.ledgerName}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>Side</label>
                <select
                  value={r.side}
                  onChange={e => updateExtra(i, { side: e.target.value as 'DR' | 'CR' })}
                  className={inputCls}
                >
                  <option value="DR">Dr</option>
                  <option value="CR">Cr</option>
                </select>
              </div>
              <div className="col-span-3">
                <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>Amount</label>
                <input
                  type="number" min="0" step="0.01"
                  value={r.amount}
                  onChange={e => updateExtra(i, { amount: e.target.value })}
                  placeholder="0.00"
                  className={inputCls}
                />
              </div>
              <div className="col-span-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeExtraRow(i)}
                  className="px-2 py-2 rounded text-sm"
                  style={{ color: '#DC2626', background: '#FEF2F2' }}
                  title="Remove row"
                >
                  ×
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addExtraRow}
            className="mt-1 text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ color: '#CC1133', background: '#FFF5F7', border: '1px solid #FECDD3' }}
          >
            + Add More Ledger
          </button>
        </div>

        {/* Balance strip */}
        <div className="grid grid-cols-3 rounded-lg my-4 overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
          <div className="px-4 py-2 text-center" style={{ borderRight: '1px solid #E2E8F0' }}>
            <p className="text-xs" style={{ color: '#94A3B8' }}>Total Dr</p>
            <p className="text-sm font-semibold text-[#1E293B]">{fmt(totalDr)}</p>
          </div>
          <div className="px-4 py-2 text-center" style={{ borderRight: '1px solid #E2E8F0' }}>
            <p className="text-xs" style={{ color: '#94A3B8' }}>Total Cr</p>
            <p className="text-sm font-semibold text-[#1E293B]">{fmt(totalCr)}</p>
          </div>
          <div className="px-4 py-2 text-center" style={{ background: Math.abs(totalDr - totalCr) < 0.01 ? '#F0FDF4' : '#FFF5F5' }}>
            <p className="text-xs" style={{ color: '#94A3B8' }}>Diff</p>
            <p className="text-sm font-semibold" style={{ color: Math.abs(totalDr - totalCr) < 0.01 ? '#16A34A' : '#DC2626' }}>
              {fmt(Math.abs(totalDr - totalCr))}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 text-xs rounded-lg" style={{ background: '#FEF2F2', color: '#B91C1C' }}>
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={submitting} className="fp-btn-secondary disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: '#CC1133' }}
          >
            {submitting ? 'Saving…' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VoucherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router  = useRouter()

  const [voucher,      setVoucher]      = useState<VoucherDetail | null>(null)
  const [ledgers,      setLedgers]      = useState<FlatLedger[]>([])
  const [loading,      setLoading]      = useState(true)
  const [loadError,    setLoadError]    = useState('')
  const [showPayment,  setShowPayment]  = useState(false)
  const [confirming,   setConfirming]   = useState(false)
  const [banner,       setBanner]       = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const res = await fetch(`/api/accounts/vouchers/${id}`)
      if (!res.ok) {
        setLoadError('Voucher not found')
        setLoading(false)
        return
      }
      const data = await res.json() as VoucherDetail
      setVoucher(data)
    } catch {
      setLoadError('Failed to load voucher')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/master/chart-of-accounts/flat')
      .then(r => r.ok ? r.json() : [])
      .then((d: unknown) => { if (Array.isArray(d)) setLedgers(d as FlatLedger[]) })
      .catch(() => {})
  }, [])

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6">
        <div className="py-24 text-center text-sm" style={{ color: '#94A3B8' }}>Loading voucher…</div>
      </div>
    )
  }

  if (loadError || !voucher) {
    return (
      <div className="p-6">
        <div className="py-24 text-center text-sm" style={{ color: '#DC2626' }}>{loadError || 'Voucher not found.'}</div>
        <div className="text-center mt-4">
          <Link href="/accounts" className="text-sm underline" style={{ color: '#64748B' }}>← Back to Accounts</Link>
        </div>
      </div>
    )
  }

  const v    = voucher
  const b    = v.booking
  const sb   = v.serviceBooking
  const dt   = displayTypeOf(v)
  const badge = VOUCHER_TYPE_BADGE[dt] ?? VOUCHER_TYPE_BADGE[v.voucherType]

  // ── Payment context (works for both sales booking and service booking) ─────
  let ctx: PaymentContext | null = null
  let isLocked        = false
  let confirmEndpoint = ''
  let confirmDisableReason = ''
  let pendingAmount   = 0

  if (b) {
    const grand   = Number(b.grandTotal)
    const paid    = Number(b.bookingAmount)
    const pending = Number(b.pendingAmount)
    pendingAmount = pending
    isLocked = b.status === 'PAID' || b.status === 'DELIVERED'
    confirmEndpoint = `/api/bookings/${b.id}/pay`
    if (b.status === 'DRAFT') confirmDisableReason = 'Booking must be confirmed by Sales first'
    else if (pending > 0)     confirmDisableReason = 'Settle full amount first'
    ctx = {
      voucherId:     v.id,
      refNumber:     b.bookingNumber,
      customerName:  b.customer?.name ?? '—',
      customerPhone: b.customer?.phone ?? null,
      grandTotal:    grand,
      paid,
      pending,
      lastPaymentAt: b.mrnReceipts[0]?.receivedAt ?? null,
    }
  } else if (sb) {
    const grand   = Number(sb.finalNetAmount)
    const paid    = Number(sb.mrnAmount)
    const pending = Math.max(0, grand - paid)
    pendingAmount = pending
    // service_status has no PAID/DELIVERED value in the live DB — treat
    // "fully paid" as (mrnAmount ≥ finalNetAmount) instead of a status flag.
    isLocked = grand > 0 && paid >= grand
    confirmEndpoint = `/api/services/${sb.id}/confirm-paid`
    if (sb.status !== 'COMPLETED') {
      confirmDisableReason = 'Service must be completed before confirming payment'
    } else if (pending > 0) {
      confirmDisableReason = 'Settle full amount first'
    }
    ctx = {
      voucherId:     v.id,
      refNumber:     sb.jobCardNumber,
      customerName:  sb.customer?.name ?? '—',
      customerPhone: sb.customer?.phone ?? null,
      grandTotal:    grand,
      paid,
      pending,
      lastPaymentAt: sb.mrnReceipts[0]?.receivedAt ?? null,
    }
  }

  const canConfirm = ctx !== null && !isLocked && pendingAmount <= 0 && !confirmDisableReason
  const showRichDetail = ctx !== null

  async function handleConfirm() {
    if (!confirmEndpoint) return
    setConfirming(true)
    setBanner(null)
    try {
      const res = await fetch(confirmEndpoint, { method: 'POST' })
      if (res.ok) {
        setBanner({ type: 'success', message: 'Payment complete — voucher marked as paid.' })
        setTimeout(() => router.push('/accounts'), 1200)
      } else {
        const body = await res.json().catch(() => ({}))
        setBanner({ type: 'error', message: (body as { error?: string }).error ?? 'Failed to confirm payment' })
      }
    } catch {
      setBanner({ type: 'error', message: 'Network error — please try again' })
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl" style={{ background: '#F5F7FA', minHeight: '100vh' }}>
      {showPayment && ctx && (
        <RecordPaymentDialog
          ctx={ctx}
          ledgers={ledgers}
          onSuccess={(result) => {
            setShowPayment(false)
            setBanner({
              type: 'success',
              message: `Payment ${result.mrnNumber} recorded. Pending now ${fmt(result.pendingAfter)}.`,
            })
            load()
          }}
          onClose={() => setShowPayment(false)}
        />
      )}

      {banner && (
        <div
          className="mb-4 px-4 py-3 rounded-lg text-sm"
          style={{
            background: banner.type === 'success' ? '#DCFCE7' : banner.type === 'info' ? '#DBEAFE' : '#FEE2E2',
            color:      banner.type === 'success' ? '#15803D' : banner.type === 'info' ? '#1D4ED8' : '#B91C1C',
            border:     `1px solid ${banner.type === 'success' ? '#86EFAC' : banner.type === 'info' ? '#93C5FD' : '#FECACA'}`,
          }}
        >
          {banner.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="mb-2">
            <Link href="/accounts" className="text-sm hover:underline" style={{ color: '#94A3B8' }}>
              ← Accounts
            </Link>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold font-mono" style={{ color: '#CC1133' }}>{v.voucherNumber}</h1>
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: badge?.bg ?? '#F1F5F9', color: badge?.color ?? '#475569' }}
            >
              {badge?.label ?? dt.replace('_', ' ')}
            </span>
            {isLocked && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC' }}>
                Paid
              </span>
            )}
          </div>
          <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
            {new Date(v.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            {v.location && ` · ${v.location.name}`}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          {showRichDetail && !isLocked && (
            <button
              onClick={() => setShowPayment(true)}
              disabled={pendingAmount <= 0}
              title={pendingAmount <= 0 ? 'No pending amount — nothing to record' : ''}
              className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', color: '#16A34A' }}
            >
              Record Payment
            </button>
          )}

          {showRichDetail && (
            <button
              onClick={canConfirm ? handleConfirm : undefined}
              disabled={!canConfirm || confirming}
              title={confirmDisableReason}
              className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{
                background: canConfirm ? '#DCFCE7' : '#F1F5F9',
                border:     `1.5px solid ${canConfirm ? '#86EFAC' : '#E2E8F0'}`,
                color:      canConfirm ? '#16A34A' : '#94A3B8',
              }}
            >
              {isLocked ? 'Already Paid' : confirming ? 'Saving…' : 'Mark As Paid'}
            </button>
          )}

          <Link href="/accounts" className="fp-btn-secondary">Back to Accounts</Link>
        </div>
      </div>

      {/* ── SALES / SERVICE rich detail ─────────────────────────────────────── */}
      {showRichDetail && ctx ? (
        <div className="flex flex-col gap-4">

          {/* Payment Summary strip */}
          <div className="fp-card overflow-hidden grid grid-cols-4">
            <div className="px-5 py-4 text-center" style={{ borderRight: '1px solid #F1F5F9' }}>
              <p className="text-xs mb-1" style={{ color: '#94A3B8' }}>Grand Total</p>
              <p className="text-lg font-bold text-[#1E293B]">{fmt(ctx.grandTotal)}</p>
            </div>
            <div className="px-5 py-4 text-center" style={{ borderRight: '1px solid #F1F5F9', background: '#F0FDF4' }}>
              <p className="text-xs mb-1" style={{ color: '#94A3B8' }}>Paid So Far</p>
              <p className="text-lg font-bold" style={{ color: '#16A34A' }}>{fmt(ctx.paid)}</p>
            </div>
            <div className="px-5 py-4 text-center" style={{ borderRight: '1px solid #F1F5F9', background: ctx.pending > 0 ? '#FFF5F5' : '#F0FDF4' }}>
              <p className="text-xs mb-1" style={{ color: '#94A3B8' }}>Pending</p>
              <p className="text-lg font-bold" style={{ color: ctx.pending > 0 ? '#DC2626' : '#16A34A' }}>
                {fmt(ctx.pending)}
              </p>
            </div>
            <div className="px-5 py-4 text-center">
              <p className="text-xs mb-1" style={{ color: '#94A3B8' }}>Last Payment</p>
              <p className="text-sm font-semibold text-[#1E293B]">
                {ctx.lastPaymentAt
                  ? new Date(ctx.lastPaymentAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                  : '—'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Customer Details */}
            <Section title="Customer Details">
              {b && (
                <>
                  <Row label="Name"    value={b.customer?.name    ?? '—'} />
                  <Row label="Phone"   value={b.customer?.phone   ?? '—'} />
                  {b.customer?.email   && <Row label="Email"   value={b.customer.email} />}
                  {b.customer?.city    && <Row label="City"    value={b.customer.city} />}
                  {b.customer?.address && <Row label="Address" value={b.customer.address} />}
                </>
              )}
              {sb && (
                <>
                  <Row label="Name"    value={sb.customer?.name    ?? '—'} />
                  <Row label="Phone"   value={sb.customer?.phone   ?? '—'} />
                  {sb.customer?.email  && <Row label="Email"   value={sb.customer.email} />}
                </>
              )}
            </Section>

            {/* Vehicle Details */}
            <Section title="Vehicle Details">
              {b && b.vehicle && (
                <>
                  <Row label="Model" value={b.vehicle.variant.model.name} />
                  <Row label="Variant"       value={b.vehicle.variant.name} />
                  <Row label="Color"         value={b.vehicle.color?.colorName ?? '—'} />
                  <Row label="Fuel Type"     value={b.vehicle.variant.model.fuelType} />
                  <Row label="Frame #"       value={b.vehicle.frameNumber}  mono />
                  <Row label="Engine #"      value={b.vehicle.engineNumber} mono />
                  {b.vehicle.location && <Row label="Stock Location" value={b.vehicle.location.name} />}
                </>
              )}
              {sb && (
                <>
                  <Row label="Model"    value={[sb.vehicleModel, sb.vehicleVariant].filter(Boolean).join(' ') || '—'} />
                  {sb.vehicleColor       && <Row label="Color"       value={sb.vehicleColor} />}
                  {sb.vehicleFrameNumber && <Row label="Frame #"     value={sb.vehicleFrameNumber} mono />}
                  {sb.vehicleEngineNumber && <Row label="Engine #"   value={sb.vehicleEngineNumber} mono />}
                  {sb.vehicleRegNumber   && <Row label="Reg. No."    value={sb.vehicleRegNumber} mono />}
                </>
              )}
              {!b?.vehicle && !sb && (
                <p className="text-xs" style={{ color: '#94A3B8' }}>No vehicle linked.</p>
              )}
            </Section>

            {/* Pricing Details */}
            <Section title="Pricing Details">
              {b && (
                <>
                  <Row label="Ex-Showroom"   value={fmt(b.exShowroomPrice)} />
                  <Row label="RTO"           value={fmt(b.rtoAmount)} />
                  <Row label="Insurance"     value={fmt(b.insuranceAmount)} />
                  <Row label="On-Road Price" value={fmt(b.onRoadPrice)} />
                  {Number(b.addonPrice) > 0        && <Row label="Addon / Accessories" value={fmt(b.addonPrice)} />}
                  {Number(b.extendedWarranty) > 0  && <Row label="Extended Warranty"   value={fmt(b.extendedWarranty)} />}
                  {Number(b.amc) > 0               && <Row label="AMC"                 value={fmt(b.amc)} />}
                  {Number(b.handlingCharges) > 0   && <Row label="Handling"            value={fmt(b.handlingCharges)} />}
                  {Number(b.etcCharges) > 0        && <Row label="ETC Charges"         value={fmt(b.etcCharges)} />}
                  {Number(b.discountAmount) > 0    && (
                    <Row label="Discount" value={<span style={{ color: '#16A34A' }}>− {fmt(b.discountAmount)}</span>} />
                  )}
                  <div className="flex justify-between pt-2 mt-1" style={{ borderTop: '1px solid #E2E8F0' }}>
                    <span className="text-xs font-semibold text-[#1E293B]">Grand Total</span>
                    <span className="text-sm font-bold" style={{ color: '#1E3A5F' }}>{fmt(b.grandTotal)}</span>
                  </div>
                </>
              )}
              {sb && (
                <>
                  <Row label="Sub Total"     value={fmt(sb.subTotal)} />
                  {Number(sb.discount) > 0     && (
                    <Row label="Discount" value={<span style={{ color: '#16A34A' }}>− {fmt(sb.discount)}</span>} />
                  )}
                  {Number(sb.advanceAmount) > 0 && (
                    <Row label="Advance Received" value={<span style={{ color: '#16A34A' }}>− {fmt(sb.advanceAmount)}</span>} />
                  )}
                  <div className="flex justify-between pt-2 mt-1" style={{ borderTop: '1px solid #E2E8F0' }}>
                    <span className="text-xs font-semibold text-[#1E293B]">Final Net (Receivable)</span>
                    <span className="text-sm font-bold" style={{ color: '#1E3A5F' }}>{fmt(sb.finalNetAmount)}</span>
                  </div>
                </>
              )}
            </Section>

            {/* Payment History */}
            <Section title="Payment History">
              {(() => {
                const receipts = b?.mrnReceipts ?? sb?.mrnReceipts ?? []
                if (receipts.length === 0) {
                  return <p className="text-xs py-2" style={{ color: '#94A3B8' }}>No payments recorded yet.</p>
                }
                return (
                  <>
                    <div className="overflow-x-auto -mx-1">
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                            {['MRN #', 'Mode', 'Amount', 'Reference', 'Date'].map(h => (
                              <th key={h} className="pb-2 text-left pr-3" style={{ color: '#94A3B8', fontWeight: 600 }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {receipts.map(r => (
                            <tr key={r.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                              <td className="py-1.5 pr-3 font-mono" style={{ color: '#1E3A5F' }}>{r.mrnNumber}</td>
                              <td className="py-1.5 pr-3" style={{ color: '#374151' }}>{r.paymentMode.replace('_', ' ')}</td>
                              <td className="py-1.5 pr-3 font-semibold" style={{ color: '#1E293B' }}>{fmt(r.amount)}</td>
                              <td className="py-1.5 pr-3 font-mono" style={{ color: '#64748B' }}>{r.referenceNumber ?? '—'}</td>
                              <td className="py-1.5" style={{ color: '#94A3B8' }}>
                                {new Date(r.receivedAt).toLocaleDateString('en-IN', {
                                  day: '2-digit', month: 'short', year: 'numeric',
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-between pt-2 mt-2 text-xs font-semibold" style={{ borderTop: '1px solid #E2E8F0' }}>
                      <span style={{ color: '#374151' }}>Total Paid</span>
                      <span style={{ color: '#16A34A' }}>{fmt(ctx.paid)}</span>
                    </div>
                  </>
                )
              })()}
            </Section>
          </div>
        </div>
      ) : (
        /* ── RECEIPT / PAYMENT / CONTRA / JOURNAL — journal breakdown ─────── */
        <div className="fp-card overflow-hidden">
          <div className="px-5 py-3" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
            <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
              Journal Entries
            </h2>
          </div>
          {v.entries.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs" style={{ color: '#94A3B8' }}>No entries found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
                    {['Account', 'Debit', 'Credit'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold" style={{ color: '#64748B' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {v.entries.map((e, i) => (
                    <tr key={e.id} style={{ borderBottom: i < v.entries.length - 1 ? '1px solid #F1F5F9' : undefined }}>
                      <td className="px-5 py-3 text-xs text-[#1E293B]">
                        <span className="font-mono text-[#64748B] mr-2">{e.account.accountCode}</span>
                        {e.account.accountName}
                      </td>
                      <td className="px-5 py-3 text-xs font-semibold" style={{ color: '#1E293B' }}>
                        {Number(e.debit) > 0 ? fmt(e.debit) : '—'}
                      </td>
                      <td className="px-5 py-3 text-xs font-semibold" style={{ color: '#1E293B' }}>
                        {Number(e.credit) > 0 ? fmt(e.credit) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {v.narration && (
            <div className="px-5 py-3 text-xs" style={{ borderTop: '1px solid #F1F5F9', color: '#64748B' }}>
              Narration: {v.narration}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

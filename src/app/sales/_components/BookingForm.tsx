'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type Model    = { id: string; name: string; brand: string }
type Variant  = { id: string; name: string; exShowroomPrice: string }
type Color    = { id: string; colorName: string }
type Location = { id: string; name: string }
type Financer = { id: string; name: string; contactPerson: string | null; phone: string | null }

export type BookingFormValues = {
  customerName: string
  customerPhone: string
  customerEmail: string
  customerAddress: string
  customerState: string
  customerPincode: string
  locationId: string
  modelId: string
  variantId: string
  colorId: string
  frameNumber: string
  engineNumber: string
  vehicleId: string
  exShowroomPrice: string
  rtoAmount: string
  insuranceAmount: string
  extendedWarranty: string
  amc: string
  handlingCharges: string
  etcCharges: string
  addonPrice: string
  discountEnabled: boolean
  discountCategory: string
  discountType: 'FLAT' | 'PERCENTAGE'
  discountValue: string
  discountRemarks: string
  exchangeEnabled: boolean
  exchangeBrand: string
  exchangeVehicleNumber: string
  exchangeValue: string
  salesType: 'CASH' | 'FINANCE'
  financeType: 'BANK' | 'NBFC' | 'DSA' | 'OTHER'
  financerId: string
  financePersonName: string
  financePersonPhone: string
  financeAmount: string
  deliveryOrderNumber: string
  hpEnabled: boolean
  hpAmount: string
  mrnNumber: string
  bookingAmount: string
  referredByType: 'EMPLOYEE' | 'CUSTOMER' | 'DEALER' | 'OTHER' | ''
  ownerName: string
  remarks: string
  bookingDate: string
}

export type BookingFormProps = {
  mode: 'new' | 'edit'
  bookingId?: string
  bookingNumber?: string
  existingCustomerId?: string
  initialValues?: Partial<BookingFormValues>
  initialFrameStatus?: 'idle' | 'found'
  preloadedVariants?: Variant[]
  preloadedColors?: Color[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir',
  'Ladakh', 'Lakshadweep', 'Puducherry',
]

const INIT: BookingFormValues = {
  customerName: '', customerPhone: '', customerEmail: '', customerAddress: '',
  customerState: '', customerPincode: '', locationId: '',
  modelId: '', variantId: '', colorId: '', frameNumber: '', engineNumber: '', vehicleId: '',
  exShowroomPrice: '', rtoAmount: '', insuranceAmount: '',
  extendedWarranty: '', amc: '', handlingCharges: '', etcCharges: '', addonPrice: '',
  discountEnabled: false, discountCategory: '', discountType: 'FLAT',
  discountValue: '', discountRemarks: '',
  exchangeEnabled: false, exchangeBrand: '', exchangeVehicleNumber: '', exchangeValue: '',
  salesType: 'CASH',
  financeType: 'BANK', financerId: '', financePersonName: '', financePersonPhone: '',
  financeAmount: '', deliveryOrderNumber: '',
  hpEnabled: false, hpAmount: '',
  mrnNumber: '', bookingAmount: '',
  referredByType: '', ownerName: '', remarks: '',
  bookingDate: new Date().toISOString().slice(0, 10),
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const num = (s: string | number | null | undefined) => parseFloat(String(s ?? '0') || '0') || 0

function calcTotals(f: BookingFormValues) {
  const ex       = num(f.exShowroomPrice)
  const rto      = num(f.rtoAmount)
  const ins      = num(f.insuranceAmount)
  const onRoad   = ex + rto + ins
  const hp       = f.hpEnabled ? num(f.hpAmount) : 0
  const addons   = num(f.addonPrice) + num(f.extendedWarranty) + num(f.amc) +
                   num(f.handlingCharges) + num(f.etcCharges) + hp
  const subTotal = onRoad + addons

  let discountAmount = 0
  if (f.discountEnabled && num(f.discountValue) > 0) {
    discountAmount = f.discountType === 'PERCENTAGE'
      ? (subTotal * num(f.discountValue)) / 100
      : num(f.discountValue)
  }

  const exchangeValue  = f.exchangeEnabled ? num(f.exchangeValue) : 0
  const grandTotal     = Math.max(0, subTotal - discountAmount - exchangeValue)
  const financeAmount  = f.salesType === 'FINANCE' ? num(f.financeAmount) : 0
  const pending        = Math.max(0, grandTotal - num(f.bookingAmount) - financeAmount)

  return { onRoad, addons, subTotal, discountAmount, exchangeValue, grandTotal, financeAmount, pending }
}

const fmtNum = (n: number) => `₹ ${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

// ── Sub-components ────────────────────────────────────────────────────────────

const inputCls  = 'fp-input'
const selectCls = 'fp-input fp-select'

function FormSection({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="fp-card overflow-hidden p-5 mb-4">
      <div className="flex items-center gap-3 pb-3 mb-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
        <span className="section-badge">{n}</span>
        <h2 className="text-sm font-semibold text-[#1E293B]">{title}</h2>
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">{children}</div>
    </div>
  )
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="fp-label">{label}</label>
      {children}
    </div>
  )
}

function NumInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <input
      type="number" min="0" step="0.01"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? '0'}
      className={inputCls}
    />
  )
}

function Toggle({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        onClick={onToggle}
        className={`w-10 h-5 rounded-full transition-colors cursor-pointer flex items-center px-0.5 ${enabled ? 'bg-[#CC1133]' : 'bg-[#E2E8F0]'}`}
      >
        <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
      </div>
      <span className="text-sm" style={{ color: '#374151' }}>{label}</span>
    </label>
  )
}

function SummaryRow({ label, value, bold, large }: {
  label: string; value: number; bold?: boolean; large?: boolean
}) {
  if (value === 0 && !bold) return null
  const isNeg = value < 0
  return (
    <div className={`flex justify-between ${large ? 'text-base' : 'text-sm'}`}
      style={{ color: bold ? '#1E3A5F' : '#64748B', fontWeight: bold ? 700 : 400 }}>
      <span>{label}</span>
      <span style={{ color: isNeg ? '#DC2626' : bold && large ? '#1E3A5F' : bold ? '#2563EB' : undefined }}>
        {isNeg ? '− ' : ''}{fmtNum(Math.abs(value))}
      </span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BookingForm({
  mode,
  bookingId,
  bookingNumber,
  existingCustomerId,
  initialValues,
  initialFrameStatus = 'idle',
  preloadedVariants = [],
  preloadedColors   = [],
}: BookingFormProps) {
  const router = useRouter()
  const [form, setForm] = useState<BookingFormValues>({ ...INIT, ...initialValues })

  const [models,      setModels]      = useState<Model[]>([])
  const [variants,    setVariants]    = useState<Variant[]>(preloadedVariants)
  const [colors,      setColors]      = useState<Color[]>(preloadedColors)
  const [locations,   setLocations]   = useState<Location[]>([])
  const [financers,   setFinancers]   = useState<Financer[]>([])
  const [frameStatus,   setFrameStatus]   = useState<'idle' | 'loading' | 'found' | 'not-found'>(initialFrameStatus)
  const [frameConflict, setFrameConflict] = useState<{ bookingNumber: string; status: string; bookingId: string } | null>(null)
  const [mrnStatus,   setMrnStatus]   = useState<'idle' | 'loading' | 'found' | 'not-found'>('idle')
  const [mrnFound,    setMrnFound]    = useState<{ amount: string; receivedAt: string } | null>(null)
  const [submitting,  setSubmitting]  = useState<'draft' | 'save' | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [error,       setError]       = useState('')

  const up = useCallback(<K extends keyof BookingFormValues>(key: K, val: BookingFormValues[K]) =>
    setForm(f => ({ ...f, [key]: val })), [])

  const safeArr = <T,>(d: unknown): T[] => Array.isArray(d) ? (d as T[]) : []

  useEffect(() => {
    Promise.all([
      fetch('/api/products/models').then(r => r.json()).catch(() => []),
      fetch('/api/locations').then(r => r.json()).catch(() => []),
      fetch('/api/financers').then(r => r.json()).catch(() => []),
    ]).then(([m, l, f]) => {
      setModels(safeArr<Model>(m))
      setLocations(safeArr<Location>(l))
      setFinancers(safeArr<Financer>(f))
      setDataLoading(false)
    })
  }, [])

  async function onModelChange(modelId: string) {
    setForm(f => ({ ...f, modelId, variantId: '', colorId: '', exShowroomPrice: '', vehicleId: '', frameNumber: '', engineNumber: '' }))
    setVariants([])
    setColors([])
    setFrameStatus('idle')
    if (!modelId) return
    const data = await fetch(`/api/products/variants?modelId=${modelId}`).then(r => r.json()).catch(() => [])
    setVariants(safeArr<Variant>(data))
  }

  async function onVariantChange(variantId: string) {
    const v = variants.find(x => x.id === variantId)
    setForm(f => ({ ...f, variantId, colorId: '', exShowroomPrice: v?.exShowroomPrice ?? '', vehicleId: '', frameNumber: '', engineNumber: '' }))
    setColors([])
    setFrameStatus('idle')
    if (!variantId) return
    const data = await fetch(`/api/products/colors?variantId=${variantId}`).then(r => r.json()).catch(() => [])
    setColors(safeArr<Color>(data))
  }

  function onLocationChange(newLocationId: string) {
    up('locationId', newLocationId)
    // If a vehicle was already fetched for a different location, clear it
    if (frameStatus === 'found') {
      setFrameStatus('idle')
      setFrameConflict(null)
      setForm(f => ({ ...f, vehicleId: '', frameNumber: '', engineNumber: '', modelId: '', variantId: '', colorId: '', exShowroomPrice: '' }))
      setVariants([])
      setColors([])
    }
  }

  async function onFrameBlur() {
    const fn = form.frameNumber.trim().toUpperCase()
    if (!fn) { setFrameStatus('idle'); setFrameConflict(null); return }
    setFrameStatus('loading')

    // Check for an existing active booking on this frame number
    const conflictRes = await fetch(`/api/bookings/frame/${encodeURIComponent(fn)}`)
    if (conflictRes.ok) {
      const existing = await conflictRes.json() as { id: string; bookingNumber: string; status: string }
      // Flag conflict only if it's a different booking (not the one currently being edited)
      if (existing.id !== bookingId) {
        setFrameConflict({ bookingNumber: existing.bookingNumber, status: existing.status, bookingId: existing.id })
      } else {
        setFrameConflict(null)
      }
    } else {
      setFrameConflict(null)
    }

    const locParam = form.locationId ? `?locationId=${encodeURIComponent(form.locationId)}` : ''
    const res = await fetch(`/api/inventory/frame/${encodeURIComponent(fn)}${locParam}`)
    if (!res.ok) { setFrameStatus('not-found'); return }
    const v = await res.json()
    setFrameStatus('found')
    const variantId = v.variant?.id ?? ''
    const colorId   = v.color?.id ?? ''
    const exPrice   = v.variant?.exShowroomPrice ?? ''

    if (v.variant?.modelId) {
      const vData = await fetch(`/api/products/variants?modelId=${v.variant.modelId}`).then(r => r.json()).catch(() => [])
      setVariants(safeArr<Variant>(vData))
    }
    if (variantId) {
      const cData = await fetch(`/api/products/colors?variantId=${variantId}`).then(r => r.json()).catch(() => [])
      setColors(safeArr<Color>(cData))
    }

    setForm(f => ({
      ...f,
      vehicleId: v.id,
      frameNumber: fn,
      engineNumber: v.engineNumber ?? '',
      modelId: v.variant?.modelId ?? '',
      variantId,
      colorId,
      exShowroomPrice: exPrice,
    }))
  }

  async function onMrnBlur() {
    const mrn = form.mrnNumber.trim().toUpperCase()
    if (!mrn) { setMrnStatus('idle'); setMrnFound(null); return }
    setMrnStatus('loading')
    const res = await fetch(`/api/mrn/lookup?mrnNumber=${encodeURIComponent(mrn)}`)
    if (!res.ok) { setMrnStatus('not-found'); setMrnFound(null); return }
    const data = await res.json()
    setMrnStatus('found')
    setMrnFound({ amount: data.amount, receivedAt: data.receivedAt })
    up('bookingAmount', String(Number(data.amount)))
  }

  const totals = calcTotals(form)

  async function submit(submitMode: 'draft' | 'save') {
    setError('')
    setSubmitting(submitMode)

    try {
      // ── Frame number conflict check (authoritative gate — runs on every submit) ──
      const fn = form.frameNumber.trim().toUpperCase()
      if (fn) {
        const conflictRes = await fetch(`/api/bookings/frame/${encodeURIComponent(fn)}`)
        if (conflictRes.ok) {
          const existing = await conflictRes.json() as { id: string; bookingNumber: string; status: string }
          if (existing.id !== bookingId) {
            setFrameConflict({ bookingNumber: existing.bookingNumber, status: existing.status, bookingId: existing.id })
            setError(`Frame number already on booking ${existing.bookingNumber} (${existing.status}). Remove or change the frame number to proceed.`)
            return
          }
        }
        // No conflict (404 = no active booking) — clear any stale warning
        setFrameConflict(null)
      }

      if (mode === 'new') {
        // Create or find customer
        const custRes = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:    form.customerName,
            phone:   form.customerPhone,
            email:   form.customerEmail.trim() || undefined,
            address: form.customerAddress.trim() || undefined,
            state:   form.customerState || undefined,
            pincode: form.customerPincode.trim() || undefined,
          }),
        })
        if (!custRes.ok) {
          setError('Could not save customer. Check name and phone.')
          return
        }
        const { id: customerId } = await custRes.json()

        const payload = buildPayload(customerId)
        const bookRes = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, status: 'DRAFT' }),
        })
        if (!bookRes.ok) {
          const body = await bookRes.json().catch(() => ({}))
          setError(body?.error ?? 'Failed to create booking.')
          return
        }
        const { id } = await bookRes.json()
        router.push(submitMode === 'save' ? `/sales/${id}` : '/sales')
      } else {
        // Edit mode — PUT existing booking
        const payload = buildPayload(existingCustomerId!)
        const res = await fetch(`/api/bookings/${bookingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setError(body?.error ?? 'Failed to update booking.')
          return
        }
        router.push(`/sales/${bookingId}`)
      }
    } finally {
      setSubmitting(null)
    }
  }

  function buildPayload(customerId: string) {
    return {
      customerId,
      locationId:            form.locationId,
      vehicleId:             form.vehicleId || null,
      exShowroomPrice:       num(form.exShowroomPrice),
      rtoAmount:             num(form.rtoAmount),
      insuranceAmount:       num(form.insuranceAmount),
      onRoadPrice:           totals.onRoad,
      addonPrice:            num(form.addonPrice),
      extendedWarranty:      num(form.extendedWarranty),
      amc:                   num(form.amc),
      handlingCharges:       num(form.handlingCharges),
      etcCharges:            num(form.etcCharges),
      subTotal:              totals.subTotal,
      discountEnabled:       form.discountEnabled,
      discountCategory:      form.discountCategory || null,
      discountType:          form.discountEnabled ? form.discountType : null,
      discountAmount:        totals.discountAmount,
      discountRemarks:       form.discountRemarks || null,
      exchangeEnabled:       form.exchangeEnabled,
      exchangeBrand:         form.exchangeBrand || null,
      exchangeVehicleNumber: form.exchangeVehicleNumber || null,
      exchangeValue:         totals.exchangeValue,
      grandTotal:            totals.grandTotal,
      salesType:             form.salesType,
      financeType:           form.salesType === 'FINANCE' ? form.financeType : null,
      financerId:            form.salesType === 'FINANCE' && form.financerId ? form.financerId : null,
      financePersonName:     form.salesType === 'FINANCE' ? form.financePersonName || null : null,
      financePersonPhone:    form.salesType === 'FINANCE' ? form.financePersonPhone || null : null,
      financeAmount:         form.salesType === 'FINANCE' ? num(form.financeAmount) : 0,
      deliveryOrderNumber:   form.salesType === 'FINANCE' ? form.deliveryOrderNumber || null : null,
      hpEnabled:             form.hpEnabled,
      hpAmount:              form.hpEnabled ? num(form.hpAmount) : 0,
      mrnNumber:             form.mrnNumber.trim() || null,
      bookingAmount:         num(form.bookingAmount),
      pendingAmount:         totals.pending,
      referredByType:        form.referredByType || null,
      ownerName:             form.ownerName || null,
      remarks:               form.remarks || null,
      bookingDate:           new Date(form.bookingDate).toISOString(),
    }
  }

  const isNew  = mode === 'new'
  const isEdit = mode === 'edit'

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/sales" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Sales</Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">
          {isNew ? 'New Booking' : `Edit Booking ${bookingNumber ?? ''}`}
        </h1>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 border text-sm rounded-lg bg-[#FEE2E2] border-[#FECACA] text-[#B91C1C]">
          {error}
        </div>
      )}

      {dataLoading ? (
        <div className="text-center py-16 text-sm" style={{ color: '#94A3B8' }}>Loading form…</div>
      ) : (
        <div className="flex flex-col gap-6 items-start lg:flex-row">
          <div className="flex-1 min-w-0 flex flex-col gap-4">

            {/* 1 — Customer Details */}
            <FormSection n={1} title="Customer Details">
              <Field label="Location / Branch *" full>
                <select value={form.locationId} onChange={e => onLocationChange(e.target.value)} className={selectCls}>
                  <option value="">Select location…</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </Field>
              {isNew ? (
                <>
                  <Field label="Customer Name *">
                    <input
                      value={form.customerName}
                      onChange={e => up('customerName', e.target.value)}
                      placeholder="Full name"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Phone Number *">
                    <input
                      value={form.customerPhone}
                      onChange={e => up('customerPhone', e.target.value)}
                      placeholder="+91 XXXXX XXXXX"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Email ID">
                    <input
                      type="email"
                      value={form.customerEmail}
                      onChange={e => up('customerEmail', e.target.value)}
                      placeholder="customer@example.com"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Address" full>
                    <textarea
                      value={form.customerAddress}
                      onChange={e => up('customerAddress', e.target.value)}
                      placeholder="House no., street, area…"
                      rows={2}
                      className={inputCls}
                      style={{ resize: 'vertical' }}
                    />
                  </Field>
                  <Field label="State">
                    <select
                      value={form.customerState}
                      onChange={e => up('customerState', e.target.value)}
                      className={selectCls}
                    >
                      <option value="">Select state…</option>
                      {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="PIN Code">
                    <input
                      value={form.customerPincode}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                        up('customerPincode', v)
                      }}
                      placeholder="6-digit PIN"
                      maxLength={6}
                      inputMode="numeric"
                      className={inputCls}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Customer Name">
                    <input value={form.customerName} readOnly className={inputCls} style={{ background: '#F8FAFC', color: '#64748B' }} />
                  </Field>
                  <Field label="Phone">
                    <input value={form.customerPhone} readOnly className={inputCls} style={{ background: '#F8FAFC', color: '#64748B' }} />
                  </Field>
                </>
              )}
              <Field label="Booking Date">
                <input
                  type="date"
                  value={form.bookingDate}
                  onChange={e => up('bookingDate', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Owner Name">
                <input
                  value={form.ownerName}
                  onChange={e => up('ownerName', e.target.value)}
                  placeholder="If different from customer"
                  className={inputCls}
                />
              </Field>
            </FormSection>

            {/* 2 — Vehicle Selection */}
            <FormSection n={2} title="Vehicle Selection">
              <Field label="Frame Number" full>
                <div className="relative">
                  <input
                    value={form.frameNumber}
                    onChange={e => { setForm(f => ({ ...f, frameNumber: e.target.value.toUpperCase(), engineNumber: '', vehicleId: '' })); setFrameStatus('idle'); setFrameConflict(null) }}
                    onBlur={onFrameBlur}
                    placeholder="Scan or type — auto-fills model, variant, color & engine no."
                    className={inputCls + ' pr-24'}
                    style={frameConflict ? { borderColor: '#DC2626' } : undefined}
                  />
                  {frameStatus === 'loading'   && <span className="absolute right-3 top-2 text-xs" style={{ color: '#94A3B8' }}>searching…</span>}
                  {frameStatus === 'found'     && !frameConflict && <span className="absolute right-3 top-2 text-xs font-medium" style={{ color: '#16A34A' }}>found</span>}
                  {frameStatus === 'not-found' && <span className="absolute right-3 top-2 text-xs" style={{ color: '#DC2626' }}>not found</span>}
                </div>
                {frameConflict && (
                  <p className="mt-1.5 text-xs font-medium rounded px-2 py-1.5" style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
                    ⚠ Frame already on booking <strong>{frameConflict.bookingNumber}</strong> (status: {frameConflict.status}). Each vehicle can only be booked once.
                  </p>
                )}
              </Field>
              <Field label="Model">
                <select value={form.modelId} onChange={e => onModelChange(e.target.value)} className={selectCls}>
                  <option value="">Select model…</option>
                  {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </Field>
              <Field label="Variant">
                <select value={form.variantId} onChange={e => onVariantChange(e.target.value)} disabled={!form.modelId} className={selectCls}>
                  <option value="">Select variant…</option>
                  {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </Field>
              <Field label="Color">
                <select value={form.colorId} onChange={e => up('colorId', e.target.value)} disabled={!form.variantId} className={selectCls}>
                  <option value="">Select color…</option>
                  {colors.map(c => <option key={c.id} value={c.id}>{c.colorName}</option>)}
                </select>
              </Field>
              <Field label="Engine No.">
                <input
                  value={form.engineNumber}
                  onChange={e => up('engineNumber', e.target.value.toUpperCase())}
                  placeholder="Auto-filled from frame number"
                  className={inputCls}
                />
              </Field>
            </FormSection>

            {/* 3 — Pricing */}
            <FormSection n={3} title="Pricing">
              <Field label="Ex-Showroom Price *">
                <NumInput value={form.exShowroomPrice} onChange={v => up('exShowroomPrice', v)} placeholder="Auto-filled from variant" />
              </Field>
              <Field label="RTO Amount">
                <NumInput value={form.rtoAmount} onChange={v => up('rtoAmount', v)} />
              </Field>
              <Field label="Insurance Amount">
                <NumInput value={form.insuranceAmount} onChange={v => up('insuranceAmount', v)} />
              </Field>
              <Field label="On-Road Price">
                <input readOnly value={totals.onRoad > 0 ? fmtNum(totals.onRoad) : ''} className={inputCls} style={{ background: '#F8FAFC', color: '#64748B' }} />
              </Field>
              <Field label="Accessories">
                <NumInput value={form.addonPrice} onChange={v => up('addonPrice', v)} />
              </Field>
              <Field label="Extended Warranty">
                <NumInput value={form.extendedWarranty} onChange={v => up('extendedWarranty', v)} />
              </Field>
              <Field label="AMC">
                <NumInput value={form.amc} onChange={v => up('amc', v)} />
              </Field>
              <Field label="Handling Charges">
                <NumInput value={form.handlingCharges} onChange={v => up('handlingCharges', v)} />
              </Field>
              <Field label="ETC Charges">
                <NumInput value={form.etcCharges} onChange={v => up('etcCharges', v)} />
              </Field>
              <Field label="Sub-Total">
                <input readOnly value={totals.subTotal > 0 ? fmtNum(totals.subTotal) : ''} className={inputCls} style={{ background: '#F8FAFC', color: '#64748B' }} />
              </Field>
            </FormSection>

            {/* 4 — Discount */}
            <FormSection n={4} title="Discount">
              <Field label="" full>
                <Toggle enabled={form.discountEnabled} onToggle={() => up('discountEnabled', !form.discountEnabled)} label="Apply discount" />
              </Field>
              {form.discountEnabled && (
                <>
                  <Field label="Discount Category">
                    <input value={form.discountCategory} onChange={e => up('discountCategory', e.target.value)} placeholder="e.g. Exchange Bonus" className={inputCls} />
                  </Field>
                  <Field label="Discount Type">
                    <select value={form.discountType} onChange={e => up('discountType', e.target.value as 'FLAT' | 'PERCENTAGE')} className={selectCls}>
                      <option value="FLAT">Flat (₹)</option>
                      <option value="PERCENTAGE">Percentage (%)</option>
                    </select>
                  </Field>
                  <Field label={form.discountType === 'PERCENTAGE' ? 'Discount %' : 'Discount Amount'}>
                    <NumInput value={form.discountValue} onChange={v => up('discountValue', v)} />
                  </Field>
                  <Field label="Calculated Discount">
                    <input readOnly value={fmtNum(totals.discountAmount)} className={inputCls} style={{ background: '#F8FAFC', color: '#64748B' }} />
                  </Field>
                  <Field label="Remarks" full>
                    <input value={form.discountRemarks} onChange={e => up('discountRemarks', e.target.value)} className={inputCls} />
                  </Field>
                </>
              )}
            </FormSection>

            {/* 5 — Exchange Vehicle */}
            <FormSection n={5} title="Exchange Vehicle">
              <Field label="" full>
                <Toggle enabled={form.exchangeEnabled} onToggle={() => up('exchangeEnabled', !form.exchangeEnabled)} label="Customer is exchanging a vehicle" />
              </Field>
              {form.exchangeEnabled && (
                <>
                  <Field label="Brand / Make">
                    <input value={form.exchangeBrand} onChange={e => up('exchangeBrand', e.target.value)} placeholder="e.g. Hero, Honda" className={inputCls} />
                  </Field>
                  <Field label="Vehicle Number">
                    <input value={form.exchangeVehicleNumber} onChange={e => up('exchangeVehicleNumber', e.target.value.toUpperCase())} className={inputCls} />
                  </Field>
                  <Field label="Exchange Value (₹)" full>
                    <NumInput value={form.exchangeValue} onChange={v => up('exchangeValue', v)} />
                  </Field>
                </>
              )}
            </FormSection>

            {/* 6 — Sales Type & Finance */}
            <FormSection n={6} title="Sales Type & Finance">
              <Field label="Sales Type" full>
                <div className="flex gap-2">
                  {(['CASH', 'FINANCE'] as const).map(t => (
                    <button
                      key={t} type="button"
                      onClick={() => up('salesType', t)}
                      className="flex-1 py-2 text-sm font-medium rounded-lg border transition"
                      style={form.salesType === t
                        ? { background: 'rgba(204,17,51,0.08)', border: '1.5px solid #CC1133', color: '#CC1133' }
                        : { background: '#F8FAFC', border: '1.5px solid #E2E8F0', color: '#64748B' }
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </Field>
              {form.salesType === 'FINANCE' && (
                <>
                  <Field label="Finance Type">
                    <select value={form.financeType} onChange={e => up('financeType', e.target.value as BookingFormValues['financeType'])} className={selectCls}>
                      <option value="BANK">Bank</option>
                      <option value="NBFC">NBFC</option>
                      <option value="DSA">DSA</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </Field>
                  <Field label="Financer">
                    <select
                      value={form.financerId}
                      onChange={e => {
                        const f = financers.find(x => x.id === e.target.value)
                        setForm(prev => ({
                          ...prev,
                          financerId:        e.target.value,
                          financePersonName:  f?.contactPerson ?? prev.financePersonName,
                          financePersonPhone: f?.phone         ?? prev.financePersonPhone,
                        }))
                      }}
                      className={selectCls}
                    >
                      <option value="">Select financer…</option>
                      {financers.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Finance Person Name">
                    <input value={form.financePersonName} onChange={e => up('financePersonName', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Finance Person Phone">
                    <input value={form.financePersonPhone} onChange={e => up('financePersonPhone', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Finance Amount (₹)">
                    <NumInput value={form.financeAmount} onChange={v => up('financeAmount', v)} />
                  </Field>
                  <Field label="Delivery Order Number">
                    <input value={form.deliveryOrderNumber} onChange={e => up('deliveryOrderNumber', e.target.value)} className={inputCls} />
                  </Field>
                </>
              )}
              <Field label="" full>
                <Toggle enabled={form.hpEnabled} onToggle={() => up('hpEnabled', !form.hpEnabled)} label="Hypothecation (HP)" />
              </Field>
              {form.hpEnabled && (
                <Field label="HP Amount (₹)" full>
                  <NumInput value={form.hpAmount} onChange={v => up('hpAmount', v)} />
                </Field>
              )}
            </FormSection>

            {/* 7 — Booking Advance */}
            <FormSection n={7} title="Booking Advance">
              <Field label="MRN Number" full>
                <div className="relative">
                  <input
                    value={form.mrnNumber}
                    onChange={e => {
                      up('mrnNumber', e.target.value.toUpperCase())
                      setMrnStatus('idle')
                      setMrnFound(null)
                    }}
                    onBlur={onMrnBlur}
                    placeholder="e.g. MRN-20260729-0001 — leave blank to enter amount manually"
                    className={inputCls + ' pr-24'}
                  />
                  {mrnStatus === 'loading'   && <span className="absolute right-3 top-2.5 text-xs" style={{ color: '#94A3B8' }}>looking up…</span>}
                  {mrnStatus === 'not-found' && <span className="absolute right-3 top-2.5 text-xs font-medium" style={{ color: '#DC2626' }}>not found</span>}
                </div>
                {mrnStatus === 'found' && mrnFound && (
                  <p className="mt-1 text-xs font-medium" style={{ color: '#16A34A' }}>
                    ✓ MRN found — ₹ {Number(mrnFound.amount).toLocaleString('en-IN')} received on {new Date(mrnFound.receivedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </Field>
              <Field label="Advance Amount (₹)">
                <NumInput value={form.bookingAmount} onChange={v => {
                  up('bookingAmount', v)
                  if (mrnStatus === 'found') { setMrnStatus('idle'); setMrnFound(null) }
                }} />
              </Field>
              <Field label="Pending Amount">
                <input readOnly value={fmtNum(totals.pending)} className={inputCls} style={{ background: '#F8FAFC', color: '#64748B' }} />
              </Field>
            </FormSection>

            {/* 8 — Referral & Remarks */}
            <FormSection n={8} title="Referral & Remarks">
              <Field label="Referred By">
                <select value={form.referredByType} onChange={e => up('referredByType', e.target.value as BookingFormValues['referredByType'])} className={selectCls}>
                  <option value="">None</option>
                  <option value="EMPLOYEE">Employee</option>
                  <option value="CUSTOMER">Customer</option>
                  <option value="DEALER">Dealer</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Remarks">
                <input value={form.remarks} onChange={e => up('remarks', e.target.value)} className={inputCls} />
              </Field>
            </FormSection>

            {/* Actions */}
            <div className="flex gap-3 pb-8">
              <Link href={isEdit ? `/sales/${bookingId}` : '/sales'} className="fp-btn-secondary text-xs">
                Cancel
              </Link>
              {isNew ? (
                <>
                  <button
                    onClick={() => submit('draft')}
                    disabled={!!submitting || !!frameConflict}
                    className="fp-btn-secondary disabled:opacity-50"
                    title={frameConflict ? 'Resolve the frame number conflict first' : undefined}
                  >
                    {submitting === 'draft' ? 'Saving…' : 'Save as Draft'}
                  </button>
                  <button
                    onClick={() => submit('save')}
                    disabled={!!submitting || !!frameConflict}
                    className="fp-btn-primary disabled:opacity-50"
                    title={frameConflict ? 'Resolve the frame number conflict first' : undefined}
                  >
                    {submitting === 'save' ? 'Creating…' : 'Create Booking'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => submit('save')}
                  disabled={!!submitting || !!frameConflict}
                  className="fp-btn-primary disabled:opacity-50"
                  title={frameConflict ? 'Resolve the frame number conflict first' : undefined}
                >
                  {submitting === 'save' ? 'Saving…' : 'Save Changes'}
                </button>
              )}
            </div>
          </div>

          {/* Sticky summary sidebar */}
          <div className="w-full lg:w-72 flex-shrink-0 lg:sticky lg:top-6">
            <div className="fp-card overflow-hidden" style={{ borderTop: '2px solid #CC1133' }}>
              <div className="px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
                <h3 className="text-sm font-semibold text-[#1E293B]">Booking Summary</h3>
              </div>
              <div className="px-5 py-4 flex flex-col gap-2 text-sm">
                <SummaryRow label="Ex-Showroom" value={num(form.exShowroomPrice)} />
                <SummaryRow label="RTO"         value={num(form.rtoAmount)} />
                <SummaryRow label="Insurance"   value={num(form.insuranceAmount)} />
                <div className="pt-2 mt-1" style={{ borderTop: '1px solid #F1F5F9' }}>
                  <SummaryRow label="On-Road Price" value={totals.onRoad} bold />
                </div>
                <SummaryRow label="Accessories"       value={num(form.addonPrice)} />
                <SummaryRow label="Extended Warranty" value={num(form.extendedWarranty)} />
                <SummaryRow label="AMC"               value={num(form.amc)} />
                <SummaryRow label="Handling Charges"  value={num(form.handlingCharges)} />
                <SummaryRow label="ETC Charges"       value={num(form.etcCharges)} />
                {form.hpEnabled && num(form.hpAmount) > 0 && (
                  <SummaryRow label="HP Amount" value={num(form.hpAmount)} />
                )}
                <div className="pt-2 mt-1" style={{ borderTop: '1px solid #F1F5F9' }}>
                  <SummaryRow label="Sub-Total" value={totals.subTotal} bold />
                </div>
                {form.discountEnabled && totals.discountAmount > 0 && (
                  <SummaryRow label="Discount" value={-totals.discountAmount} />
                )}
                {form.exchangeEnabled && totals.exchangeValue > 0 && (
                  <SummaryRow label="Exchange" value={-totals.exchangeValue} />
                )}
                <div className="pt-2 mt-1" style={{ borderTop: '2px solid #E2E8F0' }}>
                  <SummaryRow label="Grand Total" value={totals.grandTotal} bold large />
                </div>
                <div className="pt-2 mt-1" style={{ borderTop: '1px solid #F1F5F9' }}>
                  <SummaryRow label="Advance Paid" value={num(form.bookingAmount)} />
                  <SummaryRow label="Pending" value={totals.pending} bold />
                </div>
                {form.salesType === 'FINANCE' && totals.financeAmount > 0 && (
                  <div className="pt-2 mt-1" style={{ borderTop: '1px solid #F1F5F9' }}>
                    <SummaryRow label="Finance Amount" value={totals.financeAmount} />
                  </div>
                )}
              </div>
              <div className="px-5 pb-4 flex flex-col gap-1">
                {form.customerName && (
                  <div className="text-xs" style={{ color: '#94A3B8' }}>
                    <span className="font-medium" style={{ color: '#64748B' }}>{form.customerName}</span>
                    {form.customerPhone && <span> · {form.customerPhone}</span>}
                  </div>
                )}
                {(form.modelId || form.frameNumber) && (
                  <div className="text-xs" style={{ color: '#94A3B8' }}>
                    {variants.find(v => v.id === form.variantId)?.name || form.frameNumber || '—'}
                    {colors.find(c => c.id === form.colorId) && ` · ${colors.find(c => c.id === form.colorId)!.colorName}`}
                  </div>
                )}
                <div className="mt-1 text-xs font-medium uppercase tracking-wide" style={{ color: '#94A3B8' }}>
                  {form.salesType}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

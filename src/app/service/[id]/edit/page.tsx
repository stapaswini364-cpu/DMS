'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

type ServiceType = { id: string; name: string; basePrice: string }
type Technician  = { id: string; name: string; specialization: string | null }
type Location    = { id: string; name: string }

const inputCls  = 'fp-input'
const readCls   = 'fp-input'
const selectCls = 'fp-input fp-select'

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="fp-label">{label}</label>
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="fp-card overflow-hidden">
      <div className="px-5 py-3" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
        <h2 className="text-sm font-semibold text-[#1E293B]">{title}</h2>
      </div>
      <div className="px-5 py-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {children}
      </div>
    </div>
  )
}

const LINE_ITEMS = [
  { name: 'Parts',          isGstApplicable: true,  gstPercent: 18 },
  { name: 'Lubes',          isGstApplicable: true,  gstPercent: 18 },
  { name: 'Accessories',    isGstApplicable: true,  gstPercent: 18 },
  { name: 'Labour',         isGstApplicable: false, gstPercent: 0  },
  { name: 'Gear Oil',       isGstApplicable: true,  gstPercent: 18 },
  { name: 'Leather',        isGstApplicable: true,  gstPercent: 18 },
  { name: 'Chain Lubes',    isGstApplicable: true,  gstPercent: 18 },
  { name: 'Polish',         isGstApplicable: true,  gstPercent: 18 },
  { name: 'Rust Treatment', isGstApplicable: true,  gstPercent: 18 },
  { name: 'Painting',       isGstApplicable: true,  gstPercent: 18 },
  { name: 'Denting',        isGstApplicable: true,  gstPercent: 18 },
  { name: 'Petrol',         isGstApplicable: true,  gstPercent: 18 },
  { name: 'Tyre',           isGstApplicable: true,  gstPercent: 18 },
  { name: 'Battery',        isGstApplicable: true,  gstPercent: 18 },
]

const num = (s: string | number | null | undefined) => parseFloat(String(s ?? '0') || '0') || 0

export default function EditServicePage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [dataReady,    setDataReady]    = useState(false)
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [technicians,  setTechnicians]  = useState<Technician[]>([])
  const [locations,    setLocations]    = useState<Location[]>([])

  // Booking Info
  const [jobCardNumber,  setJobCardNumber]  = useState('')
  const [bookingDate,    setBookingDate]    = useState('')

  // Vehicle
  const [frameNumber,     setFrameNumber]     = useState('')
  const [vehicleRegNum,   setVehicleRegNum]   = useState('')
  const [vehicleModel,    setVehicleModel]    = useState('')
  const [vehicleVariant,  setVehicleVariant]  = useState('')
  const [vehicleColor,    setVehicleColor]    = useState('')
  const [vehicleEngineNo, setVehicleEngineNo] = useState('')

  // Customer
  const [customerId,      setCustomerId]      = useState('')
  const [customerName,    setCustomerName]    = useState('')
  const [customerPhone,   setCustomerPhone]   = useState('')
  const [customerEmail,   setCustomerEmail]   = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerState,   setCustomerState]   = useState('')
  const [customerPincode, setCustomerPincode] = useState('')

  // Service Details
  const [serviceTypeId, setServiceTypeId] = useState('')
  const [technicianId,  setTechnicianId]  = useState('')
  const [locationId,    setLocationId]    = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [notes,         setNotes]         = useState('')

  // Pricing
  const [amounts, setAmounts] = useState<string[]>(LINE_ITEMS.map(() => ''))

  // Discount
  const [discountType,     setDiscountType]     = useState<'' | 'FLAT' | 'PERCENTAGE'>('')
  const [discountCategory, setDiscountCategory] = useState('')
  const [discountValue,    setDiscountValue]    = useState('')
  const [discountRemarks,  setDiscountRemarks]  = useState('')

  // Insurance
  const [paymentType,          setPaymentType]          = useState<'CASH' | 'INSURANCE'>('CASH')
  const [insuranceCompany,     setInsuranceCompany]     = useState('')
  const [insurancePersonName,  setInsurancePersonName]  = useState('')
  const [insurancePersonPhone, setInsurancePersonPhone] = useState('')
  const [insuranceAmount,      setInsuranceAmount]      = useState('')
  const [deliveryOrderNo,      setDeliveryOrderNo]      = useState('')

  // Advance
  const [mrnNumber,     setMrnNumber]     = useState('')
  const [mrnStatus,     setMrnStatus]     = useState<'idle' | 'loading' | 'found' | 'not-found'>('idle')
  const [mrnFound,      setMrnFound]      = useState<{ amount: string; receivedAt: string } | null>(null)
  const [advanceAmount, setAdvanceAmount] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  const subTotal     = amounts.reduce((s, a) => s + num(a), 0)
  const calcDiscount = discountType === 'FLAT'
    ? num(discountValue)
    : discountType === 'PERCENTAGE'
      ? (subTotal * num(discountValue)) / 100
      : 0
  const pendingAmount = Math.max(0, subTotal - calcDiscount - num(advanceAmount))

  const safeArr = <T,>(d: unknown): T[] => Array.isArray(d) ? d as T[] : []

  useEffect(() => {
    Promise.all([
      fetch(`/api/services/${id}`).then(r => r.json()),
      fetch('/api/service-types').then(r => r.json()).catch(() => []),
      fetch('/api/technicians').then(r => r.json()).catch(() => []),
      fetch('/api/locations').then(r => r.json()).catch(() => []),
    ]).then(([booking, st, tech, loc]) => {
      setServiceTypes(safeArr<ServiceType>(st))
      setTechnicians(safeArr<Technician>(tech))
      setLocations(safeArr<Location>(loc))

      // Pre-fill all fields from existing booking
      setJobCardNumber(booking.jobCardNumber ?? '')
      setBookingDate(booking.bookingDate ? booking.bookingDate.slice(0, 10) : '')
      setFrameNumber(booking.vehicleFrameNumber ?? '')
      setVehicleRegNum(booking.vehicleRegNumber ?? '')
      setVehicleModel(booking.vehicleModel ?? '')
      setVehicleVariant(booking.vehicleVariant ?? '')
      setVehicleColor(booking.vehicleColor ?? '')
      setVehicleEngineNo(booking.vehicleEngineNumber ?? '')
      setCustomerId(booking.customer?.id ?? '')
      setCustomerName(booking.customer?.name ?? '')
      setCustomerPhone(booking.customer?.phone ?? '')
      setCustomerEmail(booking.customer?.email ?? '')
      setCustomerAddress(booking.customer?.address ?? '')
      setCustomerState(booking.customer?.state ?? '')
      setCustomerPincode(booking.customer?.pincode ?? '')
      setServiceTypeId(booking.serviceTypeId ?? '')
      setTechnicianId(booking.technicianId ?? '')
      setLocationId(booking.locationId ?? '')
      setScheduledDate(booking.scheduledDate ? booking.scheduledDate.slice(0, 10) : '')
      setNotes(booking.notes ?? '')
      setDiscountType(booking.discountType ?? '')
      setDiscountCategory(booking.discountCategory ?? '')
      setDiscountValue(booking.discountValue ?? '')
      setDiscountRemarks(booking.discountRemarks ?? '')
      setPaymentType(booking.paymentType === 'INSURANCE' ? 'INSURANCE' : 'CASH')
      setInsuranceCompany(booking.insuranceCompany ?? '')
      setInsurancePersonName(booking.insurancePersonName ?? '')
      setInsurancePersonPhone(booking.insurancePersonPhone ?? '')
      setInsuranceAmount(booking.insuranceAmount ?? '')
      setDeliveryOrderNo(booking.deliveryOrderNo ?? '')
      setMrnNumber(booking.mrnNumber ?? '')
      setAdvanceAmount(booking.advanceAmount ?? '')

      // Pre-fill pricing from existing items
      if (Array.isArray(booking.items) && booking.items.length > 0) {
        const filled = LINE_ITEMS.map(li => {
          const existing = (booking.items as Array<{ itemName: string; amount: string }>)
            .find(i => i.itemName === li.name)
          return existing ? String(Number(existing.amount) || '') : ''
        })
        setAmounts(filled)
      }

      setDataReady(true)
    })
  }, [id])

  function setAmount(idx: number, val: string) {
    setAmounts(prev => { const next = [...prev]; next[idx] = val; return next })
  }

  async function onMrnBlur() {
    const mrn = mrnNumber.trim().toUpperCase()
    if (!mrn) { setMrnStatus('idle'); setMrnFound(null); return }
    setMrnStatus('loading')
    const res = await fetch(`/api/mrn/lookup?mrnNumber=${encodeURIComponent(mrn)}`)
    if (!res.ok) { setMrnStatus('not-found'); setMrnFound(null); return }
    const data = await res.json()
    setMrnStatus('found')
    setMrnFound({ amount: data.amount, receivedAt: data.receivedAt })
    setAdvanceAmount(String(Number(data.amount) || ''))
  }

  async function handleSubmit() {
    setError('')
    if (!customerName.trim())  { setError('Customer name is required');  return }
    if (!customerPhone.trim()) { setError('Customer phone is required'); return }
    if (!vehicleModel.trim())  { setError('Vehicle model is required');  return }
    if (!locationId)           { setError('Location is required');       return }
    if (!scheduledDate)        { setError('Scheduled date is required'); return }

    setSubmitting(true)

    // Update customer fields if customerId exists
    if (customerId) {
      await fetch(`/api/customers/${customerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    customerName.trim(),
          phone:   customerPhone.trim(),
          email:   customerEmail.trim()   || null,
          address: customerAddress.trim() || null,
          state:   customerState.trim()   || null,
          pincode: customerPincode.trim() || null,
        }),
      })
    }

    const lineItems = LINE_ITEMS.map((item, idx) => ({
      itemName:        item.name,
      isGstApplicable: item.isGstApplicable,
      gstPercent:      item.gstPercent,
      amount:          num(amounts[idx]),
    }))

    const res = await fetch(`/api/services/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingDate:         bookingDate ? new Date(bookingDate).toISOString() : null,
        vehicleFrameNumber:  frameNumber.trim().toUpperCase() || null,
        vehicleRegNumber:    vehicleRegNum.trim() || null,
        vehicleModel:        vehicleModel.trim(),
        vehicleVariant:      vehicleVariant.trim() || null,
        vehicleColor:        vehicleColor.trim() || null,
        vehicleEngineNumber: vehicleEngineNo.trim() || null,
        serviceTypeId:       serviceTypeId || null,
        technicianId:        technicianId  || null,
        locationId,
        scheduledDate:       new Date(scheduledDate).toISOString(),
        notes:               notes.trim() || null,
        lineItems,
        subTotal:            String(subTotal),
        discount:            String(calcDiscount),
        discountCategory:    discountType ? discountCategory.trim() || null : null,
        discountType:        discountType || null,
        discountValue:       discountType ? num(discountValue) : null,
        discountRemarks:     discountType ? discountRemarks.trim() || null : null,
        paymentType,
        insuranceCompany:     paymentType === 'INSURANCE' ? insuranceCompany.trim()     || null : null,
        insurancePersonName:  paymentType === 'INSURANCE' ? insurancePersonName.trim()  || null : null,
        insurancePersonPhone: paymentType === 'INSURANCE' ? insurancePersonPhone.trim() || null : null,
        insuranceAmount:      paymentType === 'INSURANCE' ? num(insuranceAmount)         : null,
        deliveryOrderNo:      paymentType === 'INSURANCE' ? deliveryOrderNo.trim()       || null : null,
        mrnNumber:            mrnNumber.trim().toUpperCase() || null,
        advanceAmount:        num(advanceAmount),
      }),
    })

    setSubmitting(false)

    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setError((b as { error?: string })?.error ?? 'Failed to update service booking')
      return
    }

    router.push(`/service/${id}`)
  }

  if (!dataReady) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="text-center py-16 text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/service/${id}`} className="text-sm hover:underline" style={{ color: '#64748B' }}>← Back</Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">Edit Service Booking</h1>
        <span className="text-sm font-mono" style={{ color: '#94A3B8' }}>{jobCardNumber}</span>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 border text-sm rounded-lg bg-[#FEE2E2] border-[#FECACA] text-[#B91C1C]">{error}</div>
      )}

      <div className="flex flex-col gap-4">

        {/* Booking Info */}
        <Section title="Booking Info">
          <Field label="Job Card No.">
            <input readOnly value={jobCardNumber} className={readCls} style={{ background: '#F8FAFC', color: '#64748B' }} />
          </Field>
          <Field label="Booking Date">
            <input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} className={inputCls} />
          </Field>
        </Section>

        {/* Vehicle Details */}
        <Section title="Vehicle Details">
          <Field label="Frame Number">
            <input
              value={frameNumber}
              onChange={e => setFrameNumber(e.target.value.toUpperCase())}
              placeholder="Frame number"
              className={inputCls}
            />
          </Field>
          <Field label="Registration Number">
            <input
              value={vehicleRegNum}
              onChange={e => setVehicleRegNum(e.target.value.toUpperCase())}
              placeholder="MH01AB1234"
              className={inputCls}
            />
          </Field>
          <Field label="Vehicle Model *" full>
            <input value={vehicleModel} onChange={e => setVehicleModel(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Variant">
            <input value={vehicleVariant} onChange={e => setVehicleVariant(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Color">
            <input value={vehicleColor} onChange={e => setVehicleColor(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Engine Number">
            <input value={vehicleEngineNo} onChange={e => setVehicleEngineNo(e.target.value.toUpperCase())} className={inputCls} />
          </Field>
        </Section>

        {/* Customer Details */}
        <Section title="Customer Details">
          <Field label="Name *">
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Phone *">
            <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Email" full>
            <input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Address" full>
            <input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className={inputCls} />
          </Field>
          <Field label="State">
            <input value={customerState} onChange={e => setCustomerState(e.target.value)} className={inputCls} />
          </Field>
          <Field label="PIN Code">
            <input value={customerPincode} onChange={e => setCustomerPincode(e.target.value)} className={inputCls} />
          </Field>
        </Section>

        {/* Service Details */}
        <Section title="Service Details">
          <Field label="Location *">
            <select value={locationId} onChange={e => setLocationId(e.target.value)} className={selectCls}>
              <option value="">Select location…</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Service Type">
            <select value={serviceTypeId} onChange={e => setServiceTypeId(e.target.value)} className={selectCls}>
              <option value="">Select service type…</option>
              {serviceTypes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Technician">
            <select value={technicianId} onChange={e => setTechnicianId(e.target.value)} className={selectCls}>
              <option value="">Assign technician…</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.specialization ? ` — ${t.specialization}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Scheduled Date *">
            <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Notes" full>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className={inputCls + ' resize-none'}
            />
          </Field>
        </Section>

        {/* Pricing */}
        <div className="fp-card overflow-hidden">
          <div className="px-5 py-3" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
            <h2 className="text-sm font-semibold text-[#1E293B]">Pricing</h2>
          </div>
          <div className="px-5 py-4">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <th className="text-left py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8', width: '2rem' }}>#</th>
                  <th className="text-left py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Item</th>
                  <th className="text-center py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8', width: '5rem' }}>GST</th>
                  <th className="text-right py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8', width: '9rem' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {LINE_ITEMS.map((item, idx) => (
                  <tr key={item.name} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td className="py-2 text-xs" style={{ color: '#94A3B8' }}>{idx + 1}</td>
                    <td className="py-2" style={{ color: '#1E293B' }}>{item.name}</td>
                    <td className="py-2 text-center text-xs" style={{ color: item.isGstApplicable ? '#16A34A' : '#94A3B8' }}>
                      {item.isGstApplicable ? `${item.gstPercent}%` : '—'}
                    </td>
                    <td className="py-2">
                      <input
                        type="number" min="0" step="0.01"
                        value={amounts[idx]}
                        onChange={e => setAmount(idx, e.target.value)}
                        placeholder="0"
                        className={inputCls}
                        style={{ textAlign: 'right' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end mt-3 pt-3" style={{ borderTop: '2px solid #E2E8F0' }}>
              <span className="text-sm font-semibold" style={{ color: '#1E293B' }}>
                Sub Total: ₹ {subTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>

        {/* Discount */}
        <Section title="Discount">
          <Field label="Discount Type" full>
            <select
              value={discountType}
              onChange={e => setDiscountType(e.target.value as '' | 'FLAT' | 'PERCENTAGE')}
              className={selectCls}
            >
              <option value="">— No Discount —</option>
              <option value="FLAT">Flat Amount (₹)</option>
              <option value="PERCENTAGE">Percentage (%)</option>
            </select>
          </Field>
          {discountType && (
            <>
              <Field label="Discount Category">
                <input value={discountCategory} onChange={e => setDiscountCategory(e.target.value)} className={inputCls} />
              </Field>
              <Field label={discountType === 'PERCENTAGE' ? 'Discount %' : 'Discount Amount (₹)'}>
                <input type="number" min="0" step="0.01" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder="0" className={inputCls} />
              </Field>
              <Field label="Calculated Discount">
                <input readOnly value={`₹ ${calcDiscount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} className={readCls} style={{ background: '#F8FAFC', color: '#64748B' }} />
              </Field>
              <Field label="Remarks" full>
                <input value={discountRemarks} onChange={e => setDiscountRemarks(e.target.value)} className={inputCls} />
              </Field>
            </>
          )}
        </Section>

        {/* Service Type & Insurance */}
        <Section title="Service Type & Insurance">
          <Field label="Payment Type" full>
            <div className="flex gap-2">
              {(['CASH', 'INSURANCE'] as const).map(t => (
                <button
                  key={t} type="button"
                  onClick={() => {
                    setPaymentType(t)
                    if (t === 'CASH') {
                      setInsuranceCompany(''); setInsurancePersonName('')
                      setInsurancePersonPhone(''); setInsuranceAmount(''); setDeliveryOrderNo('')
                    }
                  }}
                  className="flex-1 py-2 text-sm font-medium rounded-lg border transition"
                  style={paymentType === t
                    ? { background: 'rgba(204,17,51,0.08)', border: '1.5px solid #CC1133', color: '#CC1133' }
                    : { background: '#F8FAFC', border: '1.5px solid #E2E8F0', color: '#64748B' }
                  }
                >
                  {t === 'CASH' ? 'Cash' : 'Insurance'}
                </button>
              ))}
            </div>
          </Field>
          {paymentType === 'INSURANCE' && (
            <>
              <Field label="Insurance Company">
                <input value={insuranceCompany} onChange={e => setInsuranceCompany(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Insurance Amount (₹)">
                <input type="number" min="0" step="0.01" value={insuranceAmount} onChange={e => setInsuranceAmount(e.target.value)} placeholder="0" className={inputCls} />
              </Field>
              <Field label="Insurance Person Name">
                <input value={insurancePersonName} onChange={e => setInsurancePersonName(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Insurance Person Phone">
                <input value={insurancePersonPhone} onChange={e => setInsurancePersonPhone(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Delivery Order No." full>
                <input value={deliveryOrderNo} onChange={e => setDeliveryOrderNo(e.target.value)} className={inputCls} />
              </Field>
            </>
          )}
        </Section>

        {/* Advance & MRN */}
        <Section title="Advance & MRN">
          <Field label="MRN Number" full>
            <div className="relative">
              <input
                value={mrnNumber}
                onChange={e => {
                  setMrnNumber(e.target.value.toUpperCase())
                  setMrnStatus('idle')
                  setMrnFound(null)
                }}
                onBlur={onMrnBlur}
                placeholder="e.g. MRN-20260822-0001 — leave blank to enter amount manually"
                className={inputCls + ' pr-24'}
              />
              {mrnStatus === 'loading'   && <span className="absolute right-3 top-2.5 text-xs" style={{ color: '#94A3B8' }}>looking up…</span>}
              {mrnStatus === 'not-found' && <span className="absolute right-3 top-2.5 text-xs font-medium" style={{ color: '#DC2626' }}>not found</span>}
            </div>
            {mrnStatus === 'found' && mrnFound && (
              <p className="mt-1 text-xs font-medium" style={{ color: '#16A34A' }}>
                ✓ MRN found — ₹ {Number(mrnFound.amount).toLocaleString('en-IN')} received on{' '}
                {new Date(mrnFound.receivedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            )}
          </Field>
          <Field label="Advance Amount (₹)">
            <input
              type="number" min="0" step="0.01"
              value={advanceAmount}
              onChange={e => setAdvanceAmount(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
          </Field>
          <Field label="Pending Amount">
            <input
              readOnly
              value={`₹ ${pendingAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
              className={readCls}
              style={{ background: '#F8FAFC', color: '#64748B' }}
            />
          </Field>
        </Section>

        <div className="flex gap-3 pb-8">
          <Link href={`/service/${id}`} className="fp-btn-secondary text-xs">
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="fp-btn-primary disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

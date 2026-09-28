'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import BookingForm, { type BookingFormValues } from '@/app/sales/_components/BookingForm'

type FullBooking = {
  id: string
  bookingNumber: string
  status: string
  customerId: string
  locationId: string
  vehicleId: string | null
  customer: { id: string; name: string; phone: string } | null
  vehicle: {
    id: string
    frameNumber: string
    engineNumber: string | null
    variant: { id: string; modelId: string; exShowroomPrice: string; model: { id: string } }
    color: { id: string } | null
  } | null
  // Pricing
  exShowroomPrice: string; rtoAmount: string; insuranceAmount: string
  addonPrice: string; extendedWarranty: string; amc: string
  handlingCharges: string; etcCharges: string; subTotal: string
  discountEnabled: boolean; discountCategory: string | null
  discountType: 'FLAT' | 'PERCENTAGE' | null; discountAmount: string; discountRemarks: string | null
  exchangeEnabled: boolean; exchangeBrand: string | null
  exchangeVehicleNumber: string | null; exchangeValue: string
  grandTotal: string; salesType: 'CASH' | 'FINANCE'
  financeType: string | null; financerId: string | null
  financePersonName: string | null; financePersonPhone: string | null
  financeAmount: string; deliveryOrderNumber: string | null
  hpEnabled: boolean; hpAmount: string
  bookingAmount: string; pendingAmount: string
  referredByType: string | null; ownerName: string | null; remarks: string | null
  bookingDate: string
}

type Variant = { id: string; name: string; exShowroomPrice: string }
type Color   = { id: string; colorName: string }

function bookingToFormValues(b: FullBooking): Partial<BookingFormValues> {
  const subTotal      = Number(b.subTotal)
  const discountAmt   = Number(b.discountAmount)
  const discountType  = (b.discountType ?? 'FLAT') as 'FLAT' | 'PERCENTAGE'
  let discountValue   = ''
  if (b.discountEnabled && discountAmt > 0) {
    discountValue = discountType === 'PERCENTAGE' && subTotal > 0
      ? ((discountAmt / subTotal) * 100).toFixed(2)
      : String(discountAmt)
  }

  return {
    customerName:          b.customer?.name  ?? '',
    customerPhone:         b.customer?.phone ?? '',
    locationId:            b.locationId,
    modelId:               b.vehicle?.variant?.model?.id ?? '',
    variantId:             b.vehicle?.variant?.id ?? '',
    colorId:               b.vehicle?.color?.id ?? '',
    frameNumber:           b.vehicle?.frameNumber ?? '',
    engineNumber:          b.vehicle?.engineNumber ?? '',
    vehicleId:             b.vehicleId ?? '',
    exShowroomPrice:       b.exShowroomPrice,
    rtoAmount:             b.rtoAmount,
    insuranceAmount:       b.insuranceAmount,
    extendedWarranty:      b.extendedWarranty,
    amc:                   b.amc,
    handlingCharges:       b.handlingCharges,
    etcCharges:            b.etcCharges,
    addonPrice:            b.addonPrice,
    discountEnabled:       b.discountEnabled,
    discountCategory:      b.discountCategory ?? '',
    discountType,
    discountValue,
    discountRemarks:       b.discountRemarks ?? '',
    exchangeEnabled:       b.exchangeEnabled,
    exchangeBrand:         b.exchangeBrand ?? '',
    exchangeVehicleNumber: b.exchangeVehicleNumber ?? '',
    exchangeValue:         b.exchangeValue,
    salesType:             b.salesType,
    financeType:           (b.financeType ?? 'BANK') as BookingFormValues['financeType'],
    financerId:            b.financerId ?? '',
    financePersonName:     b.financePersonName ?? '',
    financePersonPhone:    b.financePersonPhone ?? '',
    financeAmount:         b.financeAmount,
    deliveryOrderNumber:   b.deliveryOrderNumber ?? '',
    hpEnabled:             b.hpEnabled,
    hpAmount:              b.hpAmount,
    bookingAmount:         b.bookingAmount,
    referredByType:        (b.referredByType ?? '') as BookingFormValues['referredByType'],
    ownerName:             b.ownerName ?? '',
    remarks:               b.remarks ?? '',
    bookingDate:           new Date(b.bookingDate).toISOString().slice(0, 10),
  }
}

export default function EditBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [booking,   setBooking]   = useState<FullBooking | null>(null)
  const [variants,  setVariants]  = useState<Variant[]>([])
  const [colors,    setColors]    = useState<Color[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/bookings/${id}`)
        if (!res.ok) { setError('Booking not found'); return }
        const b: FullBooking = await res.json()

        // Block editing terminal bookings
        if (b.status === 'DELIVERED' || b.status === 'CANCELLED') {
          setError(`Cannot edit a ${b.status} booking.`)
          setBooking(b)
          return
        }

        setBooking(b)

        // Preload variants/colors for the vehicle's model/variant
        if (b.vehicle?.variant?.model?.id) {
          const vData = await fetch(`/api/products/variants?modelId=${b.vehicle.variant.model.id}`)
            .then(r => r.json()).catch(() => [])
          if (Array.isArray(vData)) setVariants(vData)
        }
        if (b.vehicle?.variant?.id) {
          const cData = await fetch(`/api/products/colors?variantId=${b.vehicle.variant.id}`)
            .then(r => r.json()).catch(() => [])
          if (Array.isArray(cData)) setColors(cData)
        }
      } catch {
        setError('Failed to load booking')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

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
        <div className="py-8 text-sm text-center" style={{ color: '#DC2626' }}>{error || 'Booking not found.'}</div>
        <div className="text-center mt-2">
          <Link href={`/sales/${id}`} className="text-sm underline" style={{ color: '#64748B' }}>← Back to Booking</Link>
        </div>
      </div>
    )
  }

  return (
    <BookingForm
      mode="edit"
      bookingId={id}
      bookingNumber={booking.bookingNumber}
      existingCustomerId={booking.customerId}
      initialValues={bookingToFormValues(booking)}
      initialFrameStatus={booking.vehicleId ? 'found' : 'idle'}
      preloadedVariants={variants}
      preloadedColors={colors}
    />
  )
}

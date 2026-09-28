import { and, count, eq, gte, lt, lte, or } from 'drizzle-orm'
import { db } from '@/db'
import { bookings } from '@/db/schema/bookings'
import { getCompanySettings, financialYearBounds } from './tenant-settings'

// ── Core invoice builder ──────────────────────────────────────────────────────

export async function buildInvoiceData(
  bookingId: string,
  tenantId: string,
  invoiceNumberOverride?: string,
) {
  const [booking, settings] = await Promise.all([
    db.query.bookings.findFirst({
      where: and(eq(bookings.id, bookingId), eq(bookings.tenantId, tenantId)),
      with: {
        customer:  true,
        vehicle: {
          with: {
            variant: { with: { model: true } },
            color:    true,
            location: true,
          },
        },
        location: true,
        financer: true,
      },
    }),
    getCompanySettings(tenantId),
  ])

  if (!booking) return null

  // ── Invoice number ────────────────────────────────────────────────────────────
  // If a manually generated invoice number is stored, use it.
  // Otherwise fall back to sequential auto-generation (legacy / preview behaviour).
  let invoiceNumber: string
  if (invoiceNumberOverride) {
    invoiceNumber = invoiceNumberOverride
  } else {
    const fy = financialYearBounds(
      new Date(booking.bookingDate),
      settings?.fyStartMonth ?? 4,
      settings?.fyStartDay   ?? 1,
    )
    const [{ seq }] = await db
      .select({ seq: count() })
      .from(bookings)
      .where(
        and(
          eq(bookings.tenantId, tenantId),
          or(eq(bookings.status, 'CONFIRMED'), eq(bookings.status, 'DELIVERED')),
          gte(bookings.bookingDate, fy.start),
          lt(bookings.bookingDate,  fy.end),
          lte(bookings.createdAt,   new Date(booking.createdAt)),
        ),
      )
    invoiceNumber = `INV/${fy.label}/${String(Number(seq)).padStart(4, '0')}`
  }

  // ── GST calculation ──────────────────────────────────────────────────────────
  const locationState = (booking.location?.state ?? '').trim().toLowerCase()
  const customerState = (booking.customer.state   ?? '').trim().toLowerCase()
  const isIntrastate  = locationState !== '' && locationState === customerState

  const taxableAmount = Number(booking.exShowroomPrice)
  const cgst = isIntrastate ? +(taxableAmount * 0.09).toFixed(2) : 0
  const sgst = isIntrastate ? +(taxableAmount * 0.09).toFixed(2) : 0
  const igst = isIntrastate ? 0 : +(taxableAmount * 0.18).toFixed(2)
  const totalGst = cgst + sgst + igst

  // ── TCS: 1 % if grandTotal > ₹10 lakh ───────────────────────────────────────
  const grandTotal = Number(booking.grandTotal)
  const tcsAmount  = grandTotal > 1_000_000 ? +(grandTotal * 0.01).toFixed(2) : 0
  const invoiceTotal = +(grandTotal + tcsAmount).toFixed(2)

  return {
    invoiceNumber,
    invoiceDate:   new Date(booking.bookingDate).toISOString().slice(0, 10),
    bookingId:     booking.id,
    bookingNumber: booking.bookingNumber,
    status:        booking.status,

    seller: {
      name:    booking.location?.name ?? '',
      address: [
        booking.location?.address,
        booking.location?.city,
        booking.location?.state,
      ].filter(Boolean).join(', '),
      state:   booking.location?.state ?? '',
    },

    buyer: {
      id:      booking.customer.id,
      name:    booking.customer.name,
      phone:   booking.customer.phone,
      email:   booking.customer.email ?? null,
      address: [
        booking.customer.address,
        booking.customer.city,
        booking.customer.state,
      ].filter(Boolean).join(', '),
      state:   booking.customer.state ?? null,
    },

    vehicle: booking.vehicle
      ? {
          frameNumber:  booking.vehicle.frameNumber,
          brand:        booking.vehicle.variant?.model?.brand  ?? '',
          model:        booking.vehicle.variant?.model?.name   ?? '',
          variant:      booking.vehicle.variant?.name          ?? '',
          color:        booking.vehicle.color?.colorName       ?? '',
        }
      : null,

    pricing: {
      exShowroomPrice: booking.exShowroomPrice,
      rtoAmount:       booking.rtoAmount,
      insuranceAmount: booking.insuranceAmount,
      addonPrice:      booking.addonPrice,
      handlingCharges: booking.handlingCharges,
      etcCharges:      booking.etcCharges,
      discountAmount:  booking.discountAmount,
      grandTotal:      booking.grandTotal,
    },

    gst: {
      type:          isIntrastate ? 'INTRASTATE' : 'INTERSTATE',
      taxableAmount: taxableAmount.toFixed(2),
      ...(isIntrastate
        ? { cgst: { rate: 9, amount: cgst.toFixed(2) }, sgst: { rate: 9, amount: sgst.toFixed(2) } }
        : { igst: { rate: 18, amount: igst.toFixed(2) } }),
      totalGst: totalGst.toFixed(2),
    },

    tcs: tcsAmount > 0 ? { rate: 1, amount: tcsAmount.toFixed(2) } : null,

    invoiceTotal: invoiceTotal.toFixed(2),

    payment: {
      salesType:     booking.salesType,
      bookingAmount: booking.bookingAmount,
      pendingAmount: booking.pendingAmount,
      financeAmount: booking.financeAmount,
      financer:      booking.financer ?? null,
    },
  }
}

export type InvoiceData = NonNullable<Awaited<ReturnType<typeof buildInvoiceData>>>

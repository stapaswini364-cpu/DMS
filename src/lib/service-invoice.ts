import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { serviceBookings } from '@/db/schema/services'
import { getCompanySettings } from './tenant-settings'

export async function buildServiceInvoiceData(
  serviceBookingId: string,
  tenantId: string,
  invoiceNumber: string,
) {
  const [booking, settings] = await Promise.all([
    db.query.serviceBookings.findFirst({
      where: and(eq(serviceBookings.id, serviceBookingId), eq(serviceBookings.tenantId, tenantId)),
      with: { customer: true, location: true, items: true },
    }),
    getCompanySettings(tenantId),
  ])

  if (!booking) return null

  const companyName = settings?.companyName ?? 'Dealership'
  const companyAddr = [settings?.address, settings?.state].filter(Boolean).join(', ')

  return {
    invoiceNumber,
    invoiceDate: (booking.bookingDate ?? new Date()).toISOString().slice(0, 10),
    jobCardNumber: booking.jobCardNumber,
    status: booking.status,

    seller: {
      name:    booking.location?.name ?? companyName,
      address: booking.location ? '' : companyAddr,
      gstin:   settings?.gstin ?? '',
    },

    customer: {
      name:  booking.customer.name,
      phone: booking.customer.phone ?? null,
      email: booking.customer.email ?? null,
    },

    vehicle: {
      frameNumber:  booking.vehicleFrameNumber  ?? '',
      model:        booking.vehicleModel        ?? '',
      variant:      booking.vehicleVariant      ?? '',
      engineNumber: booking.vehicleEngineNumber ?? '',
    },

    items: (booking.items ?? []).map(i => ({
      itemName:       i.itemName,
      amount:         Number(i.amount),
      isGstApplicable: i.isGstApplicable,
      gstPercent:     Number(i.gstPercent),
    })),

    pricing: {
      subTotal:       Number(booking.subTotal),
      discount:       Number(booking.discount),
      finalNetAmount: Number(booking.finalNetAmount),
    },
  }
}

export type ServiceInvoiceData = NonNullable<Awaited<ReturnType<typeof buildServiceInvoiceData>>>

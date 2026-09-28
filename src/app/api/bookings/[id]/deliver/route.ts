export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { bookings } from '@/db/schema/bookings'
import { vehicleInventory } from '@/db/schema/inventory'
import { requireTenant } from '@/lib/api-auth'
import { postDeliveryEntry } from '@/lib/accounting/booking-postings'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params
  const filter = and(eq(bookings.id, id), eq(bookings.tenantId, tenant.id))

  const [existing] = await db
    .select({
      id:               bookings.id,
      status:           bookings.status,
      vehicleId:        bookings.vehicleId,
      bookingNumber:    bookings.bookingNumber,
      locationId:       bookings.locationId,
      exShowroomPrice:  bookings.exShowroomPrice,
      rtoAmount:        bookings.rtoAmount,
      insuranceAmount:  bookings.insuranceAmount,
      extendedWarranty: bookings.extendedWarranty,
      amc:              bookings.amc,
      handlingCharges:  bookings.handlingCharges,
      etcCharges:       bookings.etcCharges,
      hpAmount:         bookings.hpAmount,
      addonPrice:       bookings.addonPrice,
      discountAmount:   bookings.discountAmount,
      exchangeValue:    bookings.exchangeValue,
      subTotal:         bookings.subTotal,
      grandTotal:       bookings.grandTotal,
    })
    .from(bookings)
    .where(filter)
    .limit(1)

  if (!existing) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (existing.status !== 'PAID' && existing.status !== 'CONFIRMED') {
    return NextResponse.json(
      { error: `Only PAID (or legacy CONFIRMED) bookings can be delivered (current: ${existing.status})` },
      { status: 400 },
    )
  }

  const delivered = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(bookings)
      .set({ status: 'DELIVERED', updatedAt: new Date() })
      .where(filter)
      .returning()

    if (existing.vehicleId) {
      await tx
        .update(vehicleInventory)
        .set({ status: 'SOLD' })
        .where(
          and(
            eq(vehicleInventory.id, existing.vehicleId),
            eq(vehicleInventory.tenantId, tenant.id),
          ),
        )
    }

    return updated
  })

  // Post journal entry after transaction (fire-and-forget; delivery is already committed)
  postDeliveryEntry({
    tenantId:      tenant.id,
    bookingId:     existing.id,
    bookingNumber: existing.bookingNumber,
    locationId:    existing.locationId,
    createdBy:     undefined,
    components: {
      exShowroom:       Number(existing.exShowroomPrice),
      rto:              Number(existing.rtoAmount),
      insurance:        Number(existing.insuranceAmount),
      extendedWarranty: Number(existing.extendedWarranty),
      amc:              Number(existing.amc),
      handling:         Number(existing.handlingCharges),
      etc:              Number(existing.etcCharges),
      hp:               Number(existing.hpAmount),
      accessories:      Number(existing.addonPrice),
      discount:         Number(existing.discountAmount),
      exchange:         Number(existing.exchangeValue),
      subTotal:         Number(existing.subTotal),
      grandTotal:       Number(existing.grandTotal),
    },
  }).catch(err => {
    console.error('[accounting] postDeliveryEntry failed for', existing.bookingNumber, err)
  })

  return NextResponse.json(delivered)
}

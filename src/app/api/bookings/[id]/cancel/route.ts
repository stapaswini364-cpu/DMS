export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { bookings } from '@/db/schema/bookings'
import { vehicleInventory } from '@/db/schema/inventory'
import { requireTenant } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { tenant, userId, err } = await requireTenant()
  if (err) return err

  const { id } = await params
  const bookingFilter = and(eq(bookings.id, id), eq(bookings.tenantId, tenant.id))

  const [existing] = await db
    .select({
      status:    bookings.status,
      vehicleId: bookings.vehicleId,
      bookingNumber: bookings.bookingNumber,
    })
    .from(bookings)
    .where(bookingFilter)
    .limit(1)

  if (!existing) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  if (existing.status === 'DELIVERED') {
    return NextResponse.json({ error: 'A delivered booking cannot be cancelled' }, { status: 400 })
  }
  if (existing.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Booking is already cancelled' }, { status: 400 })
  }

  const cancelled = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(bookings)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(bookingFilter)
      .returning()

    // Reset the vehicle to AVAILABLE only if it is currently BOOKED.
    // (SOLD would mean delivery already happened, which is blocked above.)
    if (existing.vehicleId) {
      await tx
        .update(vehicleInventory)
        .set({ status: 'AVAILABLE' })
        .where(
          and(
            eq(vehicleInventory.id, existing.vehicleId),
            eq(vehicleInventory.tenantId, tenant.id),
            eq(vehicleInventory.status, 'BOOKED'),
          ),
        )
    }

    return updated
  })

  logAudit({
    tenantId: tenant.id,
    userId,
    action:   'BOOKING_CANCELLED',
    module:   'Sales',
    recordId: id,
    details:  { bookingNumber: existing.bookingNumber, from: existing.status },
  })

  return NextResponse.json(cancelled)
}

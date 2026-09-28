export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and, ne } from 'drizzle-orm'
import { db } from '@/db'
import { bookings } from '@/db/schema/bookings'
import { vehicleInventory } from '@/db/schema/inventory'
import { requireTenant } from '@/lib/api-auth'

type Ctx = { params: Promise<{ frameNumber: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { frameNumber } = await params
  const fn = frameNumber.trim().toUpperCase()

  // Find vehicle by frame number
  const [vehicle] = await db
    .select({ id: vehicleInventory.id })
    .from(vehicleInventory)
    .where(and(eq(vehicleInventory.tenantId, tenant.id), eq(vehicleInventory.frameNumber, fn)))
    .limit(1)

  if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })

  // Find most recent non-cancelled booking for this vehicle
  const [booking] = await db.query.bookings.findMany({
    where: and(
      eq(bookings.tenantId, tenant.id),
      eq(bookings.vehicleId, vehicle.id),
      ne(bookings.status, 'CANCELLED'),
    ),
    columns: { id: true, bookingNumber: true, status: true },
    with: {
      customer: { columns: { id: true, name: true, phone: true, email: true } },
    },
    orderBy: (b, { desc }) => [desc(b.createdAt)],
    limit: 1,
  })

  if (!booking) return NextResponse.json({ error: 'No booking found for this frame number' }, { status: 404 })

  return NextResponse.json({
    id:            booking.id,
    bookingNumber: booking.bookingNumber,
    status:        booking.status,
    customer:      booking.customer,
  })
}

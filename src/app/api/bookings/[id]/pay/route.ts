export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { bookings } from '@/db/schema/bookings'
import { requireTenant } from '@/lib/api-auth'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params
  const filter = and(eq(bookings.id, id), eq(bookings.tenantId, tenant.id))

  const [existing] = await db
    .select({ id: bookings.id, status: bookings.status, pendingAmount: bookings.pendingAmount })
    .from(bookings)
    .where(filter)
    .limit(1)

  if (!existing) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (existing.status !== 'CONFIRMED') {
    return NextResponse.json(
      { error: `Only CONFIRMED bookings can be marked as paid (current: ${existing.status})` },
      { status: 400 },
    )
  }
  if (Number(existing.pendingAmount) > 0) {
    return NextResponse.json(
      { error: 'Booking has a pending balance — settle all payments before marking as paid' },
      { status: 400 },
    )
  }

  const [updated] = await db
    .update(bookings)
    .set({ status: 'PAID', updatedAt: new Date() })
    .where(filter)
    .returning()

  return NextResponse.json(updated)
}

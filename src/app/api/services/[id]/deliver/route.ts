export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { serviceBookings } from '@/db/schema/services'
import { requireTenant } from '@/lib/api-auth'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params
  const filter = and(eq(serviceBookings.id, id), eq(serviceBookings.tenantId, tenant.id))

  const [existing] = await db
    .select({
      id:            serviceBookings.id,
      status:        serviceBookings.status,
      advanceAmount: serviceBookings.advanceAmount,
      mrnAmount:     serviceBookings.mrnAmount,
    })
    .from(serviceBookings)
    .where(filter)
    .limit(1)

  if (!existing) return NextResponse.json({ error: 'Service booking not found' }, { status: 404 })

  if (existing.status !== 'COMPLETED') {
    return NextResponse.json(
      { error: `Only COMPLETED service bookings can be marked as delivered (current: ${existing.status})` },
      { status: 400 },
    )
  }

  const hasPayment = Number(existing.advanceAmount) > 0 || Number(existing.mrnAmount) > 0
  if (!hasPayment) {
    return NextResponse.json(
      { error: 'At least one payment must be recorded before marking as delivered' },
      { status: 400 },
    )
  }

  const [delivered] = await db
    .update(serviceBookings)
    .set({ status: 'DELIVERED', updatedAt: new Date() })
    .where(filter)
    .returning()

  return NextResponse.json(delivered)
}

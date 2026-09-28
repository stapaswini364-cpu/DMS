export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { serviceBookings } from '@/db/schema/services'
import { requireTenant } from '@/lib/api-auth'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/services/[id]/confirm-paid
// "Paid in full" is signalled by (finalNetAmount − mrnAmount) ≤ 0.
// service_status has no PAID / DELIVERED value in this DB, so we do not
// write a status change here — the pending amount reaching 0 is the
// authoritative signal. This endpoint validates that and returns success.
export async function POST(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params
  const filter = and(eq(serviceBookings.id, id), eq(serviceBookings.tenantId, tenant.id))

  const [existing] = await db
    .select({
      id:             serviceBookings.id,
      status:         serviceBookings.status,
      finalNetAmount: serviceBookings.finalNetAmount,
      mrnAmount:      serviceBookings.mrnAmount,
    })
    .from(serviceBookings)
    .where(filter)
    .limit(1)

  if (!existing) return NextResponse.json({ error: 'Service booking not found' }, { status: 404 })

  if (existing.status !== 'COMPLETED') {
    return NextResponse.json(
      { error: `Service must be COMPLETED before confirming payment (current: ${existing.status})` },
      { status: 400 },
    )
  }

  const pending = Number(existing.finalNetAmount) - Number(existing.mrnAmount)
  if (pending > 0.01) {
    return NextResponse.json(
      { error: `Service has ₹${pending.toFixed(2)} pending — settle all payments before confirming` },
      { status: 400 },
    )
  }

  return NextResponse.json({ id: existing.id, paid: true })
}

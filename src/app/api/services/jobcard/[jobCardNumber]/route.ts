export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { serviceBookings } from '@/db/schema/services'
import { requireTenant } from '@/lib/api-auth'

type Ctx = { params: Promise<{ jobCardNumber: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { jobCardNumber } = await params
  const jcn = jobCardNumber.trim().toUpperCase()

  const [booking] = await db.query.serviceBookings.findMany({
    where: and(
      eq(serviceBookings.tenantId, tenant.id),
      eq(serviceBookings.jobCardNumber, jcn),
    ),
    columns: { id: true, jobCardNumber: true, vehicleModel: true },
    with: {
      customer: { columns: { id: true, name: true, phone: true, email: true } },
    },
    limit: 1,
  })

  if (!booking) {
    return NextResponse.json({ error: 'Job card not found' }, { status: 404 })
  }

  return NextResponse.json({
    id:            booking.id,
    jobCardNumber: booking.jobCardNumber,
    vehicleModel:  booking.vehicleModel,
    customer:      booking.customer,
  })
}

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/db'
import { serviceBookings } from '@/db/schema/services'
import { requireTenant } from '@/lib/api-auth'

type Ctx = { params: Promise<{ frameNumber: string }> }

// Looks up the most recent service booking for a frame number and returns
// the associated customer for CRM auto-fill in the service form.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { frameNumber } = await params
  const normalised = frameNumber.trim().toUpperCase()

  const record = await db.query.serviceBookings.findFirst({
    where: and(
      eq(serviceBookings.tenantId, tenant.id),
      eq(serviceBookings.vehicleFrameNumber, normalised),
    ),
    columns: {
      id: true,
      jobCardNumber: true,
      vehicleModel: true,
      vehicleFrameNumber: true,
      vehicleRegNumber: true,
      vehicleVariant: true,
      vehicleColor: true,
      vehicleEngineNumber: true,
      scheduledDate: true,
      status: true,
    },
    with: {
      customer: {
        columns: { id: true, name: true, phone: true, email: true, address: true, city: true, state: true, pincode: true },
      },
    },
    orderBy: (s, { desc: d }) => [d(s.createdAt)],
  })

  if (!record) return NextResponse.json({ error: 'No service history found for this frame number' }, { status: 404 })
  return NextResponse.json(record)
}

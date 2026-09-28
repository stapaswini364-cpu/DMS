export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { vehicleInventory } from '@/db/schema/inventory'
import { requireTenant } from '@/lib/api-auth'

type Ctx = { params: Promise<{ frameNumber: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { frameNumber } = await params
  const locationId = new URL(req.url).searchParams.get('locationId')

  const vehicle = await db.query.vehicleInventory.findFirst({
    where: and(
      eq(vehicleInventory.tenantId, tenant.id),
      eq(vehicleInventory.frameNumber, frameNumber.toUpperCase()),
      ...(locationId ? [eq(vehicleInventory.locationId, locationId)] : []),
    ),
    with: {
      variant: { with: { model: true } },
      color: true,
      location: true,
    },
  })

  if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
  return NextResponse.json(vehicle)
}

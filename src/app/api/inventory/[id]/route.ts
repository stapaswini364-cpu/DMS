export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and, ne } from 'drizzle-orm'
import { db } from '@/db'
import { vehicleInventory, productVariants, productColors, vehicleStatusEnum } from '@/db/schema/inventory'
import { locations } from '@/db/schema/auth'
import { requireTenant } from '@/lib/api-auth'

type Ctx = { params: Promise<{ id: string }> }

const STATUSES = vehicleStatusEnum.enumValues

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  const vehicle = await db.query.vehicleInventory.findFirst({
    where: and(eq(vehicleInventory.id, id), eq(vehicleInventory.tenantId, tenant.id)),
    with: {
      variant: { with: { model: true } },
      color: true,
      location: true,
    },
  })

  if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
  return NextResponse.json(vehicle)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params
  const tenantFilter = and(eq(vehicleInventory.id, id), eq(vehicleInventory.tenantId, tenant.id))

  const [existing] = await db
    .select({ id: vehicleInventory.id, status: vehicleInventory.status })
    .from(vehicleInventory)
    .where(tenantFilter)
    .limit(1)

  if (!existing) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })

  const body = await req.json() as Record<string, string | undefined>
  const { variantId, colorId, locationId, engineNumber, purchaseDate, expectedDeliveryDate, status } = body

  const updates: Record<string, unknown> = {}

  // Status-only update path (kept for internal use by booking flows)
  if (status !== undefined) {
    if (!STATUSES.includes(status as typeof STATUSES[number])) {
      return NextResponse.json({ error: `status must be one of: ${STATUSES.join(', ')}` }, { status: 400 })
    }
    updates.status = status as typeof STATUSES[number]
  }

  // Field edits — validate foreign keys belong to this tenant
  if (variantId !== undefined) {
    const [v] = await db.select({ id: productVariants.id }).from(productVariants)
      .where(and(eq(productVariants.id, variantId), eq(productVariants.tenantId, tenant.id))).limit(1)
    if (!v) return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    updates.variantId = variantId
  }

  if (colorId !== undefined) {
    const [c] = await db.select({ id: productColors.id }).from(productColors)
      .where(and(eq(productColors.id, colorId), eq(productColors.tenantId, tenant.id))).limit(1)
    if (!c) return NextResponse.json({ error: 'Color not found' }, { status: 404 })
    updates.colorId = colorId
  }

  if (locationId !== undefined) {
    const [l] = await db.select({ id: locations.id }).from(locations)
      .where(and(eq(locations.id, locationId), eq(locations.tenantId, tenant.id))).limit(1)
    if (!l) return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    updates.locationId = locationId
  }

  if (engineNumber !== undefined) {
    const trimmed = engineNumber.trim().toUpperCase()
    if (!trimmed) return NextResponse.json({ error: 'engineNumber cannot be empty' }, { status: 400 })
    // Uniqueness check excluding this vehicle
    const [dup] = await db
      .select({ id: vehicleInventory.id })
      .from(vehicleInventory)
      .where(and(
        eq(vehicleInventory.tenantId, tenant.id),
        eq(vehicleInventory.engineNumber, trimmed),
        ne(vehicleInventory.id, id),
      ))
      .limit(1)
    if (dup) return NextResponse.json({ error: 'Engine number already exists in inventory' }, { status: 400 })
    updates.engineNumber = trimmed
  }

  if (purchaseDate !== undefined)
    updates.purchaseDate = purchaseDate?.trim() || null
  if (expectedDeliveryDate !== undefined)
    updates.expectedDeliveryDate = expectedDeliveryDate?.trim() || null

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  const [updated] = await db
    .update(vehicleInventory)
    .set(updates)
    .where(tenantFilter)
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  const [existing] = await db
    .select({ status: vehicleInventory.status })
    .from(vehicleInventory)
    .where(and(eq(vehicleInventory.id, id), eq(vehicleInventory.tenantId, tenant.id)))
    .limit(1)

  if (!existing) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })

  if (existing.status === 'BOOKED') {
    return NextResponse.json(
      { error: 'This vehicle is linked to an active booking and cannot be deleted.' },
      { status: 409 },
    )
  }
  if (existing.status === 'SOLD') {
    return NextResponse.json(
      { error: 'This vehicle has been sold and cannot be deleted.' },
      { status: 409 },
    )
  }

  const [deleted] = await db
    .delete(vehicleInventory)
    .where(and(eq(vehicleInventory.id, id), eq(vehicleInventory.tenantId, tenant.id)))
    .returning()

  if (!deleted) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}

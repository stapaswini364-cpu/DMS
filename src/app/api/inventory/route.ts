export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { vehicleInventory, productVariants, productColors } from '@/db/schema/inventory'
import { locations } from '@/db/schema/auth'
import { requireTenant } from '@/lib/api-auth'

export async function GET() {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const rows = await db.query.vehicleInventory.findMany({
    where: eq(vehicleInventory.tenantId, tenant.id),
    with: {
      variant: { with: { model: true } },
      color: true,
      location: true,
    },
    orderBy: (v, { desc }) => [desc(v.id)],
  })

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const body = await req.json()
  const { variantId, colorId, frameNumber, engineNumber, locationId, purchaseDate, expectedDeliveryDate } =
    body as Record<string, string | undefined>

  if (!variantId?.trim())    return NextResponse.json({ error: 'variantId is required' }, { status: 400 })
  if (!colorId?.trim())      return NextResponse.json({ error: 'colorId is required' }, { status: 400 })
  if (!frameNumber?.trim())  return NextResponse.json({ error: 'frameNumber is required' }, { status: 400 })
  if (!engineNumber?.trim()) return NextResponse.json({ error: 'engineNumber is required' }, { status: 400 })
  if (!locationId?.trim())   return NextResponse.json({ error: 'locationId is required' }, { status: 400 })

  // Verify variant, color, and location all belong to this tenant
  const [variant, color, location] = await Promise.all([
    db.select({ id: productVariants.id })
      .from(productVariants)
      .where(and(eq(productVariants.id, variantId), eq(productVariants.tenantId, tenant.id)))
      .limit(1),
    db.select({ id: productColors.id })
      .from(productColors)
      .where(and(eq(productColors.id, colorId), eq(productColors.tenantId, tenant.id)))
      .limit(1),
    db.select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.id, locationId), eq(locations.tenantId, tenant.id)))
      .limit(1),
  ])

  if (!variant.length)  return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
  if (!color.length)    return NextResponse.json({ error: 'Color not found' }, { status: 404 })
  if (!location.length) return NextResponse.json({ error: 'Location not found' }, { status: 404 })

  const cleanFrame  = frameNumber.trim().toUpperCase()
  const cleanEngine = engineNumber.trim().toUpperCase()

  try {
    const [vehicle] = await db
      .insert(vehicleInventory)
      .values({
        tenantId:             tenant.id,
        variantId,
        colorId,
        frameNumber:          cleanFrame,
        engineNumber:         cleanEngine,
        locationId,
        status:               'AVAILABLE',
        purchaseDate:         purchaseDate?.trim()         || null,
        expectedDeliveryDate: expectedDeliveryDate?.trim() || null,
      })
      .returning()

    return NextResponse.json(vehicle, { status: 201 })
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('unique')) {
      // Distinguish frame vs engine number constraint violations
      const msg = e.message.includes('engine_number')
        ? 'Engine number already exists in inventory'
        : 'Frame number already exists in inventory'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    throw e
  }
}

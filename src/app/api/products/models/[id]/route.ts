export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { productModels, fuelTypeEnum } from '@/db/schema/inventory'
import { requireTenant } from '@/lib/api-auth'

type Ctx = { params: Promise<{ id: string }> }

const FUEL_TYPES = fuelTypeEnum.enumValues

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params
  const filter = and(eq(productModels.id, id), eq(productModels.tenantId, tenant.id))

  const existing = await db.select({ id: productModels.id }).from(productModels).where(filter).limit(1)
  if (!existing.length) return NextResponse.json({ error: 'Model not found' }, { status: 404 })

  const body = await req.json()
  const { name, brand, fuelType, isActive } = body as Record<string, unknown>

  if (name !== undefined && !String(name).trim()) {
    return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
  }
  if (brand !== undefined && !String(brand).trim()) {
    return NextResponse.json({ error: 'brand cannot be empty' }, { status: 400 })
  }
  if (fuelType !== undefined && !FUEL_TYPES.includes(fuelType as typeof FUEL_TYPES[number])) {
    return NextResponse.json(
      { error: `fuelType must be one of: ${FUEL_TYPES.join(', ')}` },
      { status: 400 },
    )
  }

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = String(name).trim()
  if (brand !== undefined) updates.brand = String(brand).trim()
  if (fuelType !== undefined) updates.fuelType = fuelType
  if (isActive !== undefined) updates.isActive = Boolean(isActive)

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const [updated] = await db.update(productModels).set(updates).where(filter).returning()
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  const [deleted] = await db
    .delete(productModels)
    .where(and(eq(productModels.id, id), eq(productModels.tenantId, tenant.id)))
    .returning()

  if (!deleted) return NextResponse.json({ error: 'Model not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}

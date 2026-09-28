export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/db'
import { productModels, fuelTypeEnum } from '@/db/schema/inventory'
import { requireTenant } from '@/lib/api-auth'

const FUEL_TYPES = fuelTypeEnum.enumValues

export async function GET() {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const rows = await db
    .select()
    .from(productModels)
    .where(eq(productModels.tenantId, tenant.id))
    .orderBy(desc(productModels.name))

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const body = await req.json()
  const { name, brand, fuelType } = body as Record<string, string | undefined>

  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!brand?.trim()) return NextResponse.json({ error: 'brand is required' }, { status: 400 })
  if (!fuelType || !FUEL_TYPES.includes(fuelType as typeof FUEL_TYPES[number])) {
    return NextResponse.json(
      { error: `fuelType must be one of: ${FUEL_TYPES.join(', ')}` },
      { status: 400 },
    )
  }

  const [model] = await db
    .insert(productModels)
    .values({
      tenantId: tenant.id,
      name: name.trim(),
      brand: brand.trim(),
      fuelType: fuelType as typeof FUEL_TYPES[number],
    })
    .returning()

  return NextResponse.json(model, { status: 201 })
}

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { productVariants, productModels } from '@/db/schema/inventory'
import { requireTenant } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const modelId = new URL(req.url).searchParams.get('modelId')

  const rows = await db
    .select()
    .from(productVariants)
    .where(
      modelId
        ? and(eq(productVariants.tenantId, tenant.id), eq(productVariants.modelId, modelId))
        : eq(productVariants.tenantId, tenant.id),
    )
    .orderBy(productVariants.name)

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const body = await req.json()
  const { modelId, name, exShowroomPrice } = body as Record<string, string | undefined>

  if (!modelId?.trim()) return NextResponse.json({ error: 'modelId is required' }, { status: 400 })
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!exShowroomPrice) return NextResponse.json({ error: 'exShowroomPrice is required' }, { status: 400 })

  const price = Number(exShowroomPrice)
  if (isNaN(price) || price <= 0) {
    return NextResponse.json({ error: 'exShowroomPrice must be a positive number' }, { status: 400 })
  }

  // Verify model belongs to this tenant
  const [model] = await db
    .select({ id: productModels.id })
    .from(productModels)
    .where(and(eq(productModels.id, modelId), eq(productModels.tenantId, tenant.id)))
    .limit(1)

  if (!model) return NextResponse.json({ error: 'Model not found' }, { status: 404 })

  const [variant] = await db
    .insert(productVariants)
    .values({
      tenantId: tenant.id,
      modelId,
      name: name.trim(),
      exShowroomPrice: String(price),
    })
    .returning()

  return NextResponse.json(variant, { status: 201 })
}

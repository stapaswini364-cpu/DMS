export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { productColors, productVariants } from '@/db/schema/inventory'
import { requireTenant } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const variantId = new URL(req.url).searchParams.get('variantId')

  const rows = await db
    .select()
    .from(productColors)
    .where(
      variantId
        ? and(eq(productColors.tenantId, tenant.id), eq(productColors.variantId, variantId))
        : eq(productColors.tenantId, tenant.id),
    )
    .orderBy(productColors.colorName)

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const body = await req.json()
  const { variantId, colorName, colorCode } = body as Record<string, string | undefined>

  if (!variantId?.trim()) return NextResponse.json({ error: 'variantId is required' }, { status: 400 })
  if (!colorName?.trim()) return NextResponse.json({ error: 'colorName is required' }, { status: 400 })

  // Verify variant belongs to this tenant
  const [variant] = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(and(eq(productVariants.id, variantId), eq(productVariants.tenantId, tenant.id)))
    .limit(1)

  if (!variant) return NextResponse.json({ error: 'Variant not found' }, { status: 404 })

  const [color] = await db
    .insert(productColors)
    .values({
      tenantId: tenant.id,
      variantId,
      colorName: colorName.trim(),
      colorCode: colorCode?.trim() || null,
    })
    .returning()

  return NextResponse.json(color, { status: 201 })
}

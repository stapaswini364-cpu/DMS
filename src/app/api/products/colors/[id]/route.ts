export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { productColors } from '@/db/schema/inventory'
import { requireTenant } from '@/lib/api-auth'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params
  const filter = and(eq(productColors.id, id), eq(productColors.tenantId, tenant.id))

  const existing = await db.select({ id: productColors.id }).from(productColors).where(filter).limit(1)
  if (!existing.length) return NextResponse.json({ error: 'Color not found' }, { status: 404 })

  const body = await req.json()
  const { colorName, colorCode, isActive } = body as Record<string, unknown>

  if (colorName !== undefined && !String(colorName).trim()) {
    return NextResponse.json({ error: 'colorName cannot be empty' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (colorName !== undefined) updates.colorName = String(colorName).trim()
  if (colorCode !== undefined) updates.colorCode = String(colorCode).trim() || null
  if (isActive !== undefined) updates.isActive = Boolean(isActive)

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const [updated] = await db.update(productColors).set(updates).where(filter).returning()
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  const [deleted] = await db
    .delete(productColors)
    .where(and(eq(productColors.id, id), eq(productColors.tenantId, tenant.id)))
    .returning()

  if (!deleted) return NextResponse.json({ error: 'Color not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}

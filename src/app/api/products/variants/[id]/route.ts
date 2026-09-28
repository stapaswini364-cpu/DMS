export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { productVariants } from '@/db/schema/inventory'
import { requireTenant } from '@/lib/api-auth'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params
  const filter = and(eq(productVariants.id, id), eq(productVariants.tenantId, tenant.id))

  const existing = await db.select({ id: productVariants.id }).from(productVariants).where(filter).limit(1)
  if (!existing.length) return NextResponse.json({ error: 'Variant not found' }, { status: 404 })

  const body = await req.json()
  const { name, exShowroomPrice, isActive } = body as Record<string, unknown>

  if (name !== undefined && !String(name).trim()) {
    return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
  }
  if (exShowroomPrice !== undefined) {
    const price = Number(exShowroomPrice)
    if (isNaN(price) || price <= 0) {
      return NextResponse.json({ error: 'exShowroomPrice must be a positive number' }, { status: 400 })
    }
  }

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = String(name).trim()
  if (exShowroomPrice !== undefined) updates.exShowroomPrice = String(Number(exShowroomPrice))
  if (isActive !== undefined) updates.isActive = Boolean(isActive)

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const [updated] = await db.update(productVariants).set(updates).where(filter).returning()
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  const [deleted] = await db
    .delete(productVariants)
    .where(and(eq(productVariants.id, id), eq(productVariants.tenantId, tenant.id)))
    .returning()

  if (!deleted) return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}

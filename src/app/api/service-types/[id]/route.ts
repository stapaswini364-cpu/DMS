export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { serviceTypes } from '@/db/schema/services'
import { requireTenant } from '@/lib/api-auth'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params
  const body = await req.json()

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
    updates.name = name
  }
  if (body.basePrice !== undefined) updates.basePrice = String(body.basePrice)
  if (body.isActive  !== undefined) updates.isActive  = Boolean(body.isActive)

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  const [updated] = await db
    .update(serviceTypes)
    .set(updates)
    .where(and(eq(serviceTypes.id, id), eq(serviceTypes.tenantId, tenant.id)))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Service type not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  const [deleted] = await db
    .delete(serviceTypes)
    .where(and(eq(serviceTypes.id, id), eq(serviceTypes.tenantId, tenant.id)))
    .returning()

  if (!deleted) return NextResponse.json({ error: 'Service type not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}

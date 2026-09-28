export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { technicians } from '@/db/schema/services'
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
  if (body.phone          !== undefined) updates.phone          = String(body.phone).trim()          || null
  if (body.specialization !== undefined) updates.specialization = String(body.specialization).trim() || null
  if (body.locationId     !== undefined) updates.locationId     = body.locationId || null
  if (body.isActive       !== undefined) updates.isActive       = Boolean(body.isActive)

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  const [updated] = await db
    .update(technicians)
    .set(updates)
    .where(and(eq(technicians.id, id), eq(technicians.tenantId, tenant.id)))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Technician not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  const [deleted] = await db
    .delete(technicians)
    .where(and(eq(technicians.id, id), eq(technicians.tenantId, tenant.id)))
    .returning()

  if (!deleted) return NextResponse.json({ error: 'Technician not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}

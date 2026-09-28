export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { technicians } from '@/db/schema/services'
import { requireTenant } from '@/lib/api-auth'

export async function GET() {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const rows = await db
    .select()
    .from(technicians)
    .where(eq(technicians.tenantId, tenant.id))
    .orderBy(technicians.name)

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const body = await req.json()
  const name           = String(body.name ?? '').trim()
  const phone          = String(body.phone ?? '').trim() || null
  const specialization = String(body.specialization ?? '').trim() || null
  const locationId     = body.locationId ? String(body.locationId) : null

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const [row] = await db
    .insert(technicians)
    .values({ tenantId: tenant.id, name, phone, specialization, locationId })
    .returning()

  return NextResponse.json(row, { status: 201 })
}

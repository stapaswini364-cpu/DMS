export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { serviceTypes } from '@/db/schema/services'
import { requireTenant } from '@/lib/api-auth'

export async function GET() {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const rows = await db
    .select()
    .from(serviceTypes)
    .where(eq(serviceTypes.tenantId, tenant.id))
    .orderBy(serviceTypes.name)

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const body = await req.json()
  const name      = String(body.name ?? '').trim()
  const basePrice = String(body.basePrice ?? '0')

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const [row] = await db
    .insert(serviceTypes)
    .values({ tenantId: tenant.id, name, basePrice })
    .returning()

  return NextResponse.json(row, { status: 201 })
}

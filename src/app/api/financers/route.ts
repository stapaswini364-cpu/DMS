export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { financers } from '@/db/schema/inventory'
import { requireTenant } from '@/lib/api-auth'

export async function GET() {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const rows = await db
    .select()
    .from(financers)
    .where(eq(financers.tenantId, tenant.id))
    .orderBy(financers.name)

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const body          = await req.json()
  const name          = String(body.name          ?? '').trim()
  const contactPerson = String(body.contactPerson ?? '').trim() || null
  const phone         = String(body.phone         ?? '').trim() || null
  const email         = String(body.email         ?? '').trim() || null
  const address       = String(body.address       ?? '').trim() || null

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const [row] = await db
    .insert(financers)
    .values({ tenantId: tenant.id, name, contactPerson, phone, email, address })
    .returning()

  return NextResponse.json(row, { status: 201 })
}

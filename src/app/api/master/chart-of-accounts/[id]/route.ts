export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { coaLedgers } from '@/db/schema'
import { requireTenant } from '@/lib/api-auth'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params
  const body = await req.json()
  const { ledgerName, isActive } = body as { ledgerName?: string; isActive?: boolean }

  // Verify ledger belongs to this tenant
  const [existing] = await db
    .select({ id: coaLedgers.id })
    .from(coaLedgers)
    .where(and(
      eq(coaLedgers.id, id),
      eq(coaLedgers.tenantId, tenant.id),
    ))

  if (!existing) {
    return NextResponse.json({ error: 'Ledger not found' }, { status: 404 })
  }

  const updates: Partial<typeof coaLedgers.$inferInsert> = {}
  if (ledgerName !== undefined) updates.ledgerName = ledgerName.trim()
  if (isActive !== undefined) updates.isActive = isActive

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const [updated] = await db
    .update(coaLedgers)
    .set(updates)
    .where(and(
      eq(coaLedgers.id, id),
      eq(coaLedgers.tenantId, tenant.id),
    ))
    .returning()

  return NextResponse.json(updated)
}

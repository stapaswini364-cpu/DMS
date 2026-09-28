export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/db'
import { tenants } from '@/db/schema/auth'
import { seedChartOfAccounts } from '@/lib/accounting/seed-coa'

type Ctx = { params: Promise<{ tenantId: string }> }

async function guardSuperAdmin(): Promise<boolean> {
  const user = await currentUser()
  return user?.publicMetadata?.role === 'super_admin'
}

// POST /api/super-admin/tenants/[tenantId]/seed-coa
// Runs the default Chart of Accounts seed for a specific tenant. Idempotent:
// if COA is already seeded, returns { alreadySeeded: true } with the current
// ledger count instead of re-running.
export async function POST(_req: NextRequest, { params }: Ctx) {
  if (!await guardSuperAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { tenantId } = await params

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  try {
    const result = await seedChartOfAccounts(tenant.id)
    return NextResponse.json({
      tenantId:      tenant.id,
      tenantName:    tenant.name,
      seeded:        result.seeded,
      alreadySeeded: result.alreadySeeded,
      ledgerCount:   result.ledgerCount,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[super-admin/seed-coa] failed for', tenant.id, e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

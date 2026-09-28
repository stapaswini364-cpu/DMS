export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { and, count, eq, gte, lt } from 'drizzle-orm'
import { db } from '@/db'
import { invoices } from '@/db/schema/invoices'
import { requireTenant } from '@/lib/api-auth'
import { getCompanySettings, financialYearBounds } from '@/lib/tenant-settings'

// Returns a non-binding suggested invoice number for the current tenant.
// Format: INV-{YYYYMMDD}-{3-digit seq}
// The suggestion is a hint only — the user can type any value they want.
export async function GET() {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const settings = await getCompanySettings(tenant.id)
  const fy = financialYearBounds(
    new Date(),
    settings?.fyStartMonth ?? 4,
    settings?.fyStartDay   ?? 1,
  )

  const [{ total }] = await db
    .select({ total: count() })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, tenant.id),
        gte(invoices.generatedAt, fy.start),
        lt(invoices.generatedAt,  fy.end),
      ),
    )

  const today = new Date()
  const yyyymmdd = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('')

  const seq = String(Number(total) + 1).padStart(3, '0')
  return NextResponse.json({ suggested: `INV-${yyyymmdd}-${seq}` })
}

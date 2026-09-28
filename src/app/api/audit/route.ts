export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { db } from '@/db'
import { auditLogs } from '@/db/schema/audit'
import { requireTenant } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const sp        = new URL(req.url).searchParams
  const module    = sp.get('module')
  const startDate = sp.get('startDate')
  const endDate   = sp.get('endDate')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [eq(auditLogs.tenantId, tenant.id)]
  if (module)    conditions.push(eq(auditLogs.module, module))
  if (startDate) conditions.push(gte(auditLogs.createdAt, new Date(startDate)))
  if (endDate)   conditions.push(lte(auditLogs.createdAt, new Date(endDate + 'T23:59:59')))

  const rows = await db
    .select()
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(500)

  return NextResponse.json(rows)
}

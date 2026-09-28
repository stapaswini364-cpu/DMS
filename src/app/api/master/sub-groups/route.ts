export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { coaSubGroups, coaGroups, coaMajorHeads, coaAccountTypes } from '@/db/schema'
import { requireTenant } from '@/lib/api-auth'

export async function GET() {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const rows = await db
    .select({
      id:              coaSubGroups.id,
      code:            coaSubGroups.code,
      name:            coaSubGroups.name,
      groupName:       coaGroups.name,
      majorHeadName:   coaMajorHeads.name,
      accountTypeCode: coaAccountTypes.code,
      accountTypeName: coaAccountTypes.name,
    })
    .from(coaSubGroups)
    .innerJoin(coaGroups,       eq(coaSubGroups.groupId,        coaGroups.id))
    .innerJoin(coaMajorHeads,   eq(coaGroups.majorHeadId,       coaMajorHeads.id))
    .innerJoin(coaAccountTypes, eq(coaMajorHeads.accountTypeId, coaAccountTypes.id))
    .where(eq(coaSubGroups.tenantId, tenant.id))
    .orderBy(coaAccountTypes.code, coaSubGroups.name)

  return NextResponse.json(rows)
}

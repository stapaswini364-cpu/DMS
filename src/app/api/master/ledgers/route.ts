export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  coaLedgers,
  coaSubGroups,
  coaGroups,
  coaMajorHeads,
  coaAccountTypes,
} from '@/db/schema'
import { requireTenant } from '@/lib/api-auth'

export async function GET() {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const rows = await db
    .select({
      id:              coaLedgers.id,
      ledgerCode:      coaLedgers.ledgerCode,
      ledgerName:      coaLedgers.ledgerName,
      balanceType:     coaLedgers.balanceType,
      allowManualEntry: coaLedgers.allowManualEntry,
      subGroupName:    coaSubGroups.name,
      groupName:       coaGroups.name,
      majorHeadName:   coaMajorHeads.name,
      accountTypeName: coaAccountTypes.name,
      accountTypeCode: coaAccountTypes.code,
      normalBalance:   coaAccountTypes.normalBalance,
    })
    .from(coaLedgers)
    .innerJoin(coaSubGroups,    eq(coaLedgers.subGroupId,         coaSubGroups.id))
    .innerJoin(coaGroups,       eq(coaSubGroups.groupId,           coaGroups.id))
    .innerJoin(coaMajorHeads,   eq(coaGroups.majorHeadId,          coaMajorHeads.id))
    .innerJoin(coaAccountTypes, eq(coaMajorHeads.accountTypeId,    coaAccountTypes.id))
    .where(and(
      eq(coaLedgers.tenantId, tenant.id),
      eq(coaLedgers.isActive, true),
      eq(coaLedgers.allowManualEntry, true),
    ))
    .orderBy(coaLedgers.ledgerCode)

  return NextResponse.json(rows)
}

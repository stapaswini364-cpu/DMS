export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { and, eq, like, max, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  coaLedgers,
  coaSubGroups,
  coaGroups,
  coaMajorHeads,
  coaAccountTypes,
} from '@/db/schema'
import { requireTenant } from '@/lib/api-auth'
import { getFyBalancesForPeriodAccounts } from '@/lib/accounting/fy-balances'

export async function GET() {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const [rows, fyBalances] = await Promise.all([
    db
      .select({
        id:              coaLedgers.id,
        ledgerCode:      coaLedgers.ledgerCode,
        ledgerName:      coaLedgers.ledgerName,
        balanceType:     coaLedgers.balanceType,
        isActive:        coaLedgers.isActive,
        allowManualEntry: coaLedgers.allowManualEntry,
        gstApplicable:   coaLedgers.gstApplicable,
        tdsApplicable:   coaLedgers.tdsApplicable,
        runningBalance:  coaLedgers.runningBalance,
        openingBalance:  coaLedgers.openingBalance,
        subGroupId:      coaSubGroups.id,
        subGroupCode:    coaSubGroups.code,
        subGroupName:    coaSubGroups.name,
        groupId:         coaGroups.id,
        groupCode:       coaGroups.code,
        groupName:       coaGroups.name,
        majorHeadId:     coaMajorHeads.id,
        majorHeadCode:   coaMajorHeads.code,
        majorHeadName:   coaMajorHeads.name,
        accountTypeId:   coaAccountTypes.id,
        accountTypeCode: coaAccountTypes.code,
        accountTypeName: coaAccountTypes.name,
        normalBalance:   coaAccountTypes.normalBalance,
      })
      .from(coaLedgers)
      .innerJoin(coaSubGroups,    eq(coaLedgers.subGroupId,        coaSubGroups.id))
      .innerJoin(coaGroups,       eq(coaSubGroups.groupId,          coaGroups.id))
      .innerJoin(coaMajorHeads,   eq(coaGroups.majorHeadId,         coaMajorHeads.id))
      .innerJoin(coaAccountTypes, eq(coaMajorHeads.accountTypeId,   coaAccountTypes.id))
      .where(eq(coaLedgers.tenantId, tenant.id))
      .orderBy(coaLedgers.ledgerCode),
    getFyBalancesForPeriodAccounts(tenant.id),
  ])

  const response = rows.map(r => ({
    ...r,
    runningBalance: (r.accountTypeCode === 'I' || r.accountTypeCode === 'EX')
      ? (fyBalances.get(r.id) ?? '0.00')
      : r.runningBalance,
  }))

  return NextResponse.json(response)
}

export async function POST(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const body = await req.json()
  const {
    subGroupId,
    ledgerName,
    balanceType,
    allowManualEntry,
    gstApplicable,
    tdsApplicable,
    openingBalance,
  } = body as {
    subGroupId: string
    ledgerName: string
    balanceType?: 'debit' | 'credit'
    allowManualEntry?: boolean
    gstApplicable?: boolean
    tdsApplicable?: boolean
    openingBalance?: number
  }

  if (!subGroupId || !ledgerName) {
    return NextResponse.json({ error: 'subGroupId and ledgerName are required' }, { status: 400 })
  }

  // Verify subGroup belongs to this tenant and get accountTypeCode
  const [hierarchy] = await db
    .select({
      subGroupId:      coaSubGroups.id,
      accountTypeCode: coaAccountTypes.code,
      normalBalance:   coaAccountTypes.normalBalance,
    })
    .from(coaSubGroups)
    .innerJoin(coaGroups,       eq(coaSubGroups.groupId,         coaGroups.id))
    .innerJoin(coaMajorHeads,   eq(coaGroups.majorHeadId,        coaMajorHeads.id))
    .innerJoin(coaAccountTypes, eq(coaMajorHeads.accountTypeId,  coaAccountTypes.id))
    .where(and(
      eq(coaSubGroups.id, subGroupId),
      eq(coaSubGroups.tenantId, tenant.id),
    ))

  if (!hierarchy) {
    return NextResponse.json({ error: 'Sub-group not found' }, { status: 404 })
  }

  const typeCode = hierarchy.accountTypeCode

  // Find max ledger code for this type prefix for this tenant
  const [maxRow] = await db
    .select({ maxCode: max(coaLedgers.ledgerCode) })
    .from(coaLedgers)
    .where(and(
      eq(coaLedgers.tenantId, tenant.id),
      like(coaLedgers.ledgerCode, `${typeCode}%`),
    ))

  let nextNum = 1
  if (maxRow?.maxCode) {
    const suffix = maxRow.maxCode.slice(typeCode.length)
    const parsed = parseInt(suffix, 10)
    if (!isNaN(parsed)) {
      nextNum = parsed + 1
    }
  }

  const ledgerCode = `${typeCode}${String(nextNum).padStart(4, '0')}`
  const resolvedBalanceType: 'debit' | 'credit' = balanceType ?? hierarchy.normalBalance

  const [created] = await db
    .insert(coaLedgers)
    .values({
      tenantId:        tenant.id,
      subGroupId,
      ledgerCode,
      ledgerName:      ledgerName.trim(),
      balanceType:     resolvedBalanceType,
      isActive:        true,
      allowManualEntry: allowManualEntry ?? true,
      gstApplicable:   gstApplicable ?? false,
      tdsApplicable:   tdsApplicable ?? false,
      openingBalance:  String(openingBalance ?? 0),
      runningBalance:  '0',
    })
    .returning()

  return NextResponse.json(created, { status: 201 })
}

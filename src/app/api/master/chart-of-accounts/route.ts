export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  coaAccountTypes,
  coaMajorHeads,
  coaGroups,
  coaSubGroups,
  coaLedgers,
} from '@/db/schema'
import { requireTenant } from '@/lib/api-auth'
import { getFyBalancesForPeriodAccounts } from '@/lib/accounting/fy-balances'

export async function GET() {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const [accountTypes, majorHeads, groups, subGroups, ledgers, fyBalances] =
    await Promise.all([
      db.select().from(coaAccountTypes).where(eq(coaAccountTypes.tenantId, tenant.id)).orderBy(coaAccountTypes.code),
      db.select().from(coaMajorHeads).where(eq(coaMajorHeads.tenantId, tenant.id)).orderBy(coaMajorHeads.code),
      db.select().from(coaGroups).where(eq(coaGroups.tenantId, tenant.id)).orderBy(coaGroups.code),
      db.select().from(coaSubGroups).where(eq(coaSubGroups.tenantId, tenant.id)).orderBy(coaSubGroups.code),
      db.select().from(coaLedgers).where(eq(coaLedgers.tenantId, tenant.id)).orderBy(coaLedgers.ledgerCode),
      getFyBalancesForPeriodAccounts(tenant.id),
    ])

  // For I/EX account types, replace runningBalance with current-FY activity
  const periodTypeCodes = new Set(
    accountTypes.filter(at => at.code === 'I' || at.code === 'EX').map(at => at.id),
  )
  const majorHeadsByType = new Map(majorHeads.map(mh => [mh.id, mh.accountTypeId]))
  const groupsByMajorHead = new Map(groups.map(g => [g.id, g.majorHeadId]))
  const subGroupsByGroup = new Map(subGroups.map(sg => [sg.id, sg.groupId]))

  const isPeriodLedger = (l: typeof ledgers[number]) => {
    const groupId    = subGroupsByGroup.get(l.subGroupId)
    const mhId       = groupId ? groupsByMajorHead.get(groupId) : undefined
    const typeId     = mhId   ? majorHeadsByType.get(mhId)      : undefined
    return typeId !== undefined && periodTypeCodes.has(typeId)
  }

  const tree = accountTypes.map(at => ({
    ...at,
    majorHeads: majorHeads
      .filter(mh => mh.accountTypeId === at.id)
      .map(mh => ({
        ...mh,
        groups: groups
          .filter(g => g.majorHeadId === mh.id)
          .map(g => ({
            ...g,
            subGroups: subGroups
              .filter(sg => sg.groupId === g.id)
              .map(sg => ({
                ...sg,
                ledgers: ledgers
                  .filter(l => l.subGroupId === sg.id)
                  .map(l => ({
                    ...l,
                    runningBalance: isPeriodLedger(l)
                      ? (fyBalances.get(l.id) ?? '0.00')
                      : l.runningBalance,
                  })),
              })),
          })),
      })),
  }))

  return NextResponse.json(tree)
}

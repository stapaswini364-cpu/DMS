export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { sql, and, eq, gte, lte, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  journalEntries,
  journalEntryLines,
  coaLedgers,
  coaSubGroups,
  coaGroups,
  coaMajorHeads,
  coaAccountTypes,
} from '@/db/schema'
import { requireTenant } from '@/lib/api-auth'
import { getCompanySettings, fyStartForDate } from '@/lib/tenant-settings'

type StatutoryHead =
  | 'shareholders_funds'
  | 'non_current_liabilities'
  | 'current_liabilities'
  | 'non_current_assets'
  | 'current_assets'

type SectionKey = StatutoryHead | 'unclassified'

type BSLine = { ledgerCode: string; ledgerName: string; amount: string }
type BSSection = { key: SectionKey; title: string; lines: BSLine[]; subtotal: string }

// Schedule III presentation order. Unclassified appears last within its side
// so nothing silently drops from the totals when a manually created major
// head has no statutory_head set.
const EQUITY_LIAB_ORDER: { key: SectionKey; title: string }[] = [
  { key: 'shareholders_funds',      title: "Shareholders' Funds"      },
  { key: 'non_current_liabilities', title: 'Non-Current Liabilities'  },
  { key: 'current_liabilities',     title: 'Current Liabilities'      },
  { key: 'unclassified',            title: 'Unclassified (Liab/Eq)'   },
]

const ASSETS_ORDER: { key: SectionKey; title: string }[] = [
  { key: 'non_current_assets', title: 'Non-Current Assets' },
  { key: 'current_assets',     title: 'Current Assets'     },
  { key: 'unclassified',       title: 'Unclassified Assets' },
]

async function sumByType(
  tenantId: string,
  typeCodes: string[],
  asAtDate: Date,
  startDate?: Date,
) {
  return db
    .select({
      ledgerCode:      coaLedgers.ledgerCode,
      ledgerName:      coaLedgers.ledgerName,
      accountTypeCode: coaAccountTypes.code,
      statutoryHead:   coaMajorHeads.statutoryHead,
      totalDebit:      sql<string>`coalesce(sum(${journalEntryLines.debitAmount}),  0)::text`,
      totalCredit:     sql<string>`coalesce(sum(${journalEntryLines.creditAmount}), 0)::text`,
    })
    .from(journalEntryLines)
    .innerJoin(journalEntries,  eq(journalEntryLines.journalEntryId, journalEntries.id))
    .innerJoin(coaLedgers,      eq(journalEntryLines.ledgerId,        coaLedgers.id))
    .innerJoin(coaSubGroups,    eq(coaLedgers.subGroupId,             coaSubGroups.id))
    .innerJoin(coaGroups,       eq(coaSubGroups.groupId,              coaGroups.id))
    .innerJoin(coaMajorHeads,   eq(coaGroups.majorHeadId,             coaMajorHeads.id))
    .innerJoin(coaAccountTypes, eq(coaMajorHeads.accountTypeId,       coaAccountTypes.id))
    .where(and(
      eq(journalEntryLines.tenantId, tenantId),
      inArray(coaAccountTypes.code, typeCodes),
      lte(journalEntries.entryDate, asAtDate),
      ...(startDate ? [gte(journalEntries.entryDate, startDate)] : []),
    ))
    .groupBy(
      coaLedgers.ledgerCode,
      coaLedgers.ledgerName,
      coaAccountTypes.code,
      coaMajorHeads.statutoryHead,
    )
    .orderBy(coaLedgers.ledgerCode)
}

export async function GET(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const asAtParam = new URL(req.url).searchParams.get('asAt')

  if (asAtParam && isNaN(Date.parse(asAtParam))) {
    return NextResponse.json({ error: 'Invalid asAt date' }, { status: 400 })
  }

  const asAtDate  = asAtParam ? new Date(asAtParam + 'T23:59:59.999Z') : new Date()
  const settings  = await getCompanySettings(tenant.id)
  const fyStartDate = fyStartForDate(asAtDate, settings?.fyStartMonth ?? 4, settings?.fyStartDay ?? 1)

  const bsRows = await sumByType(tenant.id, ['A', 'L', 'EQ'], asAtDate)
  const plRows = await sumByType(tenant.id, ['I', 'EX'], asAtDate, fyStartDate)

  type Row = typeof bsRows[number]

  function toLine(r: Row, debitPositive: boolean): BSLine {
    return {
      ledgerCode: r.ledgerCode,
      ledgerName: r.ledgerName,
      amount: debitPositive
        ? (Number(r.totalDebit) - Number(r.totalCredit)).toFixed(2)
        : (Number(r.totalCredit) - Number(r.totalDebit)).toFixed(2),
    }
  }

  function buildSections(
    rows: Row[],
    typeCodes: string[],
    debitPositive: boolean,
    order: { key: SectionKey; title: string }[],
  ): BSSection[] {
    const filtered = rows.filter(r => typeCodes.includes(r.accountTypeCode))
    const buckets = new Map<SectionKey, BSLine[]>()
    for (const r of filtered) {
      const key: SectionKey = (r.statutoryHead as SectionKey | null) ?? 'unclassified'
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key)!.push(toLine(r, debitPositive))
    }
    const sections: BSSection[] = []
    for (const { key, title } of order) {
      const lines = buckets.get(key) ?? []
      // Drop unclassified section entirely when empty; keep the standard
      // Schedule III sections visible even when empty so the report shape
      // stays consistent across tenants.
      if (key === 'unclassified' && lines.length === 0) continue
      const subtotal = lines.reduce((s, l) => s + Number(l.amount), 0).toFixed(2)
      sections.push({ key, title, lines, subtotal })
    }
    return sections
  }

  const assetSections           = buildSections(bsRows, ['A'],      true,  ASSETS_ORDER)
  const equityLiabSections      = buildSections(bsRows, ['L', 'EQ'], false, EQUITY_LIAB_ORDER)

  // Flat legacy arrays kept for any lingering consumer of the old shape.
  const assets      = bsRows.filter(r => r.accountTypeCode === 'A' ).map(r => toLine(r, true))
  const liabilities = bsRows.filter(r => r.accountTypeCode === 'L' ).map(r => toLine(r, false))
  const equity      = bsRows.filter(r => r.accountTypeCode === 'EQ').map(r => toLine(r, false))

  const periodIncome  = plRows
    .filter(r => r.accountTypeCode === 'I')
    .reduce((s, r) => s + Number(r.totalCredit) - Number(r.totalDebit), 0)
  const periodExpense = plRows
    .filter(r => r.accountTypeCode === 'EX')
    .reduce((s, r) => s + Number(r.totalDebit) - Number(r.totalCredit), 0)
  const netProfit = periodIncome - periodExpense

  const totalAssets      = assets.reduce((s, r) => s + Number(r.amount), 0)
  const totalLiabilities = liabilities.reduce((s, r) => s + Number(r.amount), 0)
  const totalEquity      = equity.reduce((s, r) => s + Number(r.amount), 0)

  const equitySide = totalLiabilities + totalEquity + netProfit
  const balanced   = Math.abs(totalAssets - equitySide) < 0.01

  return NextResponse.json({
    asAt:                    asAtDate.toISOString().slice(0, 10),
    fyStart:                 fyStartDate.toISOString().slice(0, 10),

    sections: {
      assets:              assetSections,
      equityAndLiabilities: equityLiabSections,
    },

    assets,
    liabilities,
    equity,

    netProfit:               netProfit.toFixed(2),
    isProfitable:            netProfit >= 0,
    totalAssets:             totalAssets.toFixed(2),
    totalLiabilities:        totalLiabilities.toFixed(2),
    totalEquity:             totalEquity.toFixed(2),
    liabilitiesEquityProfit: equitySide.toFixed(2),
    balanced,
    _source:                 'journal_entries',
    ...(balanced ? {} : { _warning: 'Assets ≠ Liabilities + Equity + Profit — data integrity issue' }),
  })
}

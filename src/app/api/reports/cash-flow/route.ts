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
} from '@/db/schema'
import { requireTenant } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { searchParams } = new URL(req.url)
  const startDate  = searchParams.get('startDate')
  const endDate    = searchParams.get('endDate')
  const locationId = searchParams.get('locationId')

  if (startDate && isNaN(Date.parse(startDate))) {
    return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 })
  }
  if (endDate && isNaN(Date.parse(endDate))) {
    return NextResponse.json({ error: 'Invalid endDate' }, { status: 400 })
  }

  // Find cash & bank ledger IDs (same approach as cashbook route)
  const cashBankLedgers = await db
    .select({ id: coaLedgers.id })
    .from(coaLedgers)
    .innerJoin(coaSubGroups, eq(coaLedgers.subGroupId, coaSubGroups.id))
    .innerJoin(coaGroups,    eq(coaSubGroups.groupId,   coaGroups.id))
    .where(and(
      eq(coaLedgers.tenantId, tenant.id),
      eq(coaGroups.code, 'A-CA-CB'),
      eq(coaLedgers.isActive, true),
    ))

  if (cashBankLedgers.length === 0) {
    return NextResponse.json({
      period: { startDate, endDate, locationId },
      daily: [],
      totals: { cashIn: '0.00', cashOut: '0.00', netCashFlow: '0.00' },
      _note: 'No cash/bank ledgers found. Seed the Chart of Accounts first.',
    })
  }

  const cashLedgerIds = cashBankLedgers.map(l => l.id)

  // Aggregate by day
  const dayExpr = sql`(${journalEntries.entryDate} AT TIME ZONE 'UTC')::date`

  const daily = await db
    .select({
      day:     sql<string>`(${journalEntries.entryDate} AT TIME ZONE 'UTC')::date::text`,
      cashIn:  sql<string>`coalesce(sum(${journalEntryLines.debitAmount}),  0)::text`,
      cashOut: sql<string>`coalesce(sum(${journalEntryLines.creditAmount}), 0)::text`,
      txCount: sql<number>`count(distinct ${journalEntries.id})::int`,
    })
    .from(journalEntryLines)
    .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
    .where(and(
      eq(journalEntryLines.tenantId, tenant.id),
      inArray(journalEntryLines.ledgerId, cashLedgerIds),
      ...(locationId ? [eq(journalEntries.locationId, locationId)] : []),
      ...(startDate  ? [gte(journalEntries.entryDate, new Date(startDate))]                  : []),
      ...(endDate    ? [lte(journalEntries.entryDate, new Date(endDate + 'T23:59:59.999Z'))] : []),
    ))
    .groupBy(dayExpr)
    .orderBy(dayExpr)

  const rows = daily.map(r => ({
    day:         r.day,
    cashIn:      Number(r.cashIn).toFixed(2),
    cashOut:     Number(r.cashOut).toFixed(2),
    netCashFlow: (Number(r.cashIn) - Number(r.cashOut)).toFixed(2),
    txCount:     r.txCount,
  }))

  const totalCashIn  = rows.reduce((s, r) => s + Number(r.cashIn),  0)
  const totalCashOut = rows.reduce((s, r) => s + Number(r.cashOut), 0)

  return NextResponse.json({
    period: { startDate, endDate, locationId },
    daily:  rows,
    totals: {
      cashIn:      totalCashIn.toFixed(2),
      cashOut:     totalCashOut.toFixed(2),
      netCashFlow: (totalCashIn - totalCashOut).toFixed(2),
    },
    _source: 'journal_entries',
  })
}

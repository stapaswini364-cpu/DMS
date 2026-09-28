export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { sql, and, eq, lte } from 'drizzle-orm'
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

export async function GET(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const asAt = new URL(req.url).searchParams.get('asAt')

  if (asAt && isNaN(Date.parse(asAt))) {
    return NextResponse.json({ error: 'Invalid asAt date' }, { status: 400 })
  }

  const asAtDate = asAt ? new Date(asAt + 'T23:59:59.999Z') : new Date()

  const rows = await db
    .select({
      ledgerCode:      coaLedgers.ledgerCode,
      ledgerName:      coaLedgers.ledgerName,
      accountTypeCode: coaAccountTypes.code,
      accountTypeName: coaAccountTypes.name,
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
      eq(journalEntryLines.tenantId, tenant.id),
      lte(journalEntries.entryDate, asAtDate),
    ))
    .groupBy(
      coaLedgers.ledgerCode,
      coaLedgers.ledgerName,
      coaAccountTypes.code,
      coaAccountTypes.name,
    )
    .orderBy(coaAccountTypes.code, coaLedgers.ledgerCode)

  const tbRows = rows.map(r => ({
    ledgerCode:      r.ledgerCode,
    ledgerName:      r.ledgerName,
    accountTypeCode: r.accountTypeCode,
    accountTypeName: r.accountTypeName,
    totalDebit:      Number(r.totalDebit).toFixed(2),
    totalCredit:     Number(r.totalCredit).toFixed(2),
  }))

  const totalDebit  = tbRows.reduce((s, r) => s + Number(r.totalDebit),  0)
  const totalCredit = tbRows.reduce((s, r) => s + Number(r.totalCredit), 0)
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01

  return NextResponse.json({
    asAt:        asAtDate.toISOString().slice(0, 10),
    rows:        tbRows,
    totalDebit:  totalDebit.toFixed(2),
    totalCredit: totalCredit.toFixed(2),
    balanced,
    _source:     'journal_entries',
    ...(balanced ? {} : { _warning: 'DEBIT ≠ CREDIT — data integrity issue detected' }),
  })
}

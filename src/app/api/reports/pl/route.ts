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

export async function GET(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get('startDate')
  const endDate   = searchParams.get('endDate')

  if (startDate && isNaN(Date.parse(startDate))) {
    return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 })
  }
  if (endDate && isNaN(Date.parse(endDate))) {
    return NextResponse.json({ error: 'Invalid endDate' }, { status: 400 })
  }

  const rows = await db
    .select({
      ledgerId:       coaLedgers.id,
      ledgerCode:     coaLedgers.ledgerCode,
      ledgerName:     coaLedgers.ledgerName,
      accountTypeCode: coaAccountTypes.code,
      accountTypeName: coaAccountTypes.name,
      totalDebit:     sql<string>`coalesce(sum(${journalEntryLines.debitAmount}), 0)::text`,
      totalCredit:    sql<string>`coalesce(sum(${journalEntryLines.creditAmount}), 0)::text`,
    })
    .from(journalEntryLines)
    .innerJoin(journalEntries,   eq(journalEntryLines.journalEntryId, journalEntries.id))
    .innerJoin(coaLedgers,       eq(journalEntryLines.ledgerId,        coaLedgers.id))
    .innerJoin(coaSubGroups,     eq(coaLedgers.subGroupId,             coaSubGroups.id))
    .innerJoin(coaGroups,        eq(coaSubGroups.groupId,              coaGroups.id))
    .innerJoin(coaMajorHeads,    eq(coaGroups.majorHeadId,             coaMajorHeads.id))
    .innerJoin(coaAccountTypes,  eq(coaMajorHeads.accountTypeId,       coaAccountTypes.id))
    .where(and(
      eq(journalEntryLines.tenantId, tenant.id),
      inArray(coaAccountTypes.code, ['I', 'EX']),
      ...(startDate ? [gte(journalEntries.entryDate, new Date(startDate))]                  : []),
      ...(endDate   ? [lte(journalEntries.entryDate, new Date(endDate + 'T23:59:59.999Z'))] : []),
    ))
    .groupBy(
      coaLedgers.id,
      coaLedgers.ledgerCode,
      coaLedgers.ledgerName,
      coaAccountTypes.code,
      coaAccountTypes.name,
    )
    .orderBy(coaLedgers.ledgerCode)

  // Income is credit-normal: net = credit − debit
  // Expense is debit-normal: net = debit − credit
  const incomeLines = rows
    .filter(r => r.accountTypeCode === 'I')
    .map(r => ({
      ledgerId:   r.ledgerId,
      ledgerCode: r.ledgerCode,
      ledgerName: r.ledgerName,
      amount:     (Number(r.totalCredit) - Number(r.totalDebit)).toFixed(2),
    }))

  const expenseLines = rows
    .filter(r => r.accountTypeCode === 'EX')
    .map(r => ({
      ledgerId:   r.ledgerId,
      ledgerCode: r.ledgerCode,
      ledgerName: r.ledgerName,
      amount:     (Number(r.totalDebit) - Number(r.totalCredit)).toFixed(2),
    }))

  const totalIncome  = incomeLines.reduce((s, r)  => s + Number(r.amount), 0)
  const totalExpense = expenseLines.reduce((s, r) => s + Number(r.amount), 0)
  const netProfit    = totalIncome - totalExpense

  return NextResponse.json({
    period:      { startDate: startDate ?? null, endDate: endDate ?? null },
    income:      incomeLines,
    expenses:    expenseLines,
    totalIncome:  totalIncome.toFixed(2),
    totalExpense: totalExpense.toFixed(2),
    netProfit:    netProfit.toFixed(2),
    isProfit:     netProfit >= 0,
    _source:      'journal_entries',
  })
}

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq, gte, inArray, lt, lte } from 'drizzle-orm'
import { db } from '@/db'
import {
  coaLedgers,
  coaSubGroups,
  coaGroups,
  journalEntries,
  journalEntryLines,
} from '@/db/schema'
import { requireTenant } from '@/lib/api-auth'

function toNum(v: unknown): number {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

export async function GET(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { searchParams } = new URL(req.url)
  const locationId = searchParams.get('locationId')
  const startDate  = searchParams.get('startDate')
  const endDate    = searchParams.get('endDate')

  if (startDate && isNaN(Date.parse(startDate))) {
    return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 })
  }
  if (endDate && isNaN(Date.parse(endDate))) {
    return NextResponse.json({ error: 'Invalid endDate' }, { status: 400 })
  }

  // ── Find Cash & Bank ledgers for this tenant ──────────────────────────────
  // Identifies any ledger in the 'A-CA-CB' (Cash & Bank) group
  const cashBankLedgers = await db
    .select({ id: coaLedgers.id, ledgerName: coaLedgers.ledgerName })
    .from(coaLedgers)
    .innerJoin(coaSubGroups, eq(coaLedgers.subGroupId, coaSubGroups.id))
    .innerJoin(coaGroups,    eq(coaSubGroups.groupId,   coaGroups.id))
    .where(and(
      eq(coaLedgers.tenantId, tenant.id),
      eq(coaGroups.code, 'A-CA-CB'),
      eq(coaLedgers.isActive, true),
    ))

  if (cashBankLedgers.length === 0) {
    // COA not seeded yet — return empty response (legacy vouchers not surfaced here)
    return NextResponse.json({
      openingBalance: '0.00',
      transactions:   [],
      totalReceipts:  '0.00',
      totalPayments:  '0.00',
      closingBalance: '0.00',
      _source:        'journal_entries',
      _note:          'No cash/bank ledgers found. Seed the Chart of Accounts to use the new Cash Book.',
    })
  }

  const cashLedgerIds = cashBankLedgers.map(l => l.id)

  // Shared filter conditions for journal_entry_lines on cash ledgers
  const baseConditions = [
    eq(journalEntryLines.tenantId, tenant.id),
    inArray(journalEntryLines.ledgerId, cashLedgerIds),
    ...(locationId ? [eq(journalEntries.locationId, locationId)] : []),
  ]

  // ── Opening balance: sum of (debit - credit) on cash lines BEFORE startDate ─
  let openingBalance = 0

  if (startDate) {
    const priorLines = await db
      .select({
        debitAmount:  journalEntryLines.debitAmount,
        creditAmount: journalEntryLines.creditAmount,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(and(...baseConditions, lt(journalEntries.entryDate, new Date(startDate))))

    for (const row of priorLines) {
      // Cash in Hand is debit-normal: debit increases balance, credit decreases it
      openingBalance += toNum(row.debitAmount) - toNum(row.creditAmount)
    }
  }

  // ── In-range transactions ─────────────────────────────────────────────────
  const inPeriodLines = await db
    .select({
      entryId:      journalEntries.id,
      voucherNo:    journalEntries.voucherNo,
      voucherType:  journalEntries.voucherType,
      entryDate:    journalEntries.entryDate,
      narration:    journalEntries.narration,
      reference:    journalEntries.reference,
      debitAmount:  journalEntryLines.debitAmount,
      creditAmount: journalEntryLines.creditAmount,
      lineId:       journalEntryLines.id,
    })
    .from(journalEntryLines)
    .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
    .where(and(
      ...baseConditions,
      ...(startDate ? [gte(journalEntries.entryDate, new Date(startDate))]                  : []),
      ...(endDate   ? [lte(journalEntries.entryDate, new Date(endDate + 'T23:59:59.999Z'))] : []),
    ))
    .orderBy(asc(journalEntries.entryDate))

  // ── Build running balance ─────────────────────────────────────────────────
  let running       = openingBalance
  let totalReceipts = 0
  let totalPayments = 0

  const transactions = inPeriodLines.map(row => {
    const debit  = toNum(row.debitAmount)
    const credit = toNum(row.creditAmount)

    running       += debit - credit
    totalReceipts += debit
    totalPayments += credit

    return {
      id:            row.entryId,
      voucherNumber: row.voucherNo,    // UI expects `voucherNumber`
      voucherType:   row.voucherType,
      date:          row.entryDate.toISOString(),
      narration:     row.narration,
      reference:     row.reference,
      debit,
      credit,
      balance:       +running.toFixed(2),
    }
  })

  return NextResponse.json({
    openingBalance: openingBalance.toFixed(2),
    transactions,
    totalReceipts:  totalReceipts.toFixed(2),
    totalPayments:  totalPayments.toFixed(2),
    closingBalance: running.toFixed(2),
    _source:        'journal_entries',
  })
}

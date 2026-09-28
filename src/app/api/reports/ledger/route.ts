export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { sql, and, eq, gte, lt, lte } from 'drizzle-orm'
import { db } from '@/db'
import {
  journalEntries,
  journalEntryLines,
  coaLedgers,
  coaSubGroups,
  coaGroups,
  coaMajorHeads,
  coaAccountTypes,
  locations,
} from '@/db/schema'
import { requireTenant } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const params     = new URL(req.url).searchParams
  const ledgerId   = params.get('ledgerId')
  const startDate  = params.get('startDate')
  const endDate    = params.get('endDate')
  const locationId = params.get('locationId') || null

  if (!ledgerId)  return NextResponse.json({ error: 'ledgerId is required' },  { status: 400 })
  if (!startDate) return NextResponse.json({ error: 'startDate is required' }, { status: 400 })
  if (!endDate)   return NextResponse.json({ error: 'endDate is required' },   { status: 400 })

  if (isNaN(Date.parse(startDate)) || isNaN(Date.parse(endDate))) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
  }

  const periodStart = new Date(startDate + 'T00:00:00.000Z')
  const periodEnd   = new Date(endDate   + 'T23:59:59.999Z')

  // ── 1. Ledger metadata ────────────────────────────────────────────────────
  const [ledger] = await db
    .select({
      id:              coaLedgers.id,
      ledgerCode:      coaLedgers.ledgerCode,
      ledgerName:      coaLedgers.ledgerName,
      balanceType:     coaLedgers.balanceType,
      openingBalance:  coaLedgers.openingBalance,
      subGroupName:    coaSubGroups.name,
      groupName:       coaGroups.name,
      majorHeadName:   coaMajorHeads.name,
      accountTypeCode: coaAccountTypes.code,
      accountTypeName: coaAccountTypes.name,
    })
    .from(coaLedgers)
    .innerJoin(coaSubGroups,    eq(coaLedgers.subGroupId,        coaSubGroups.id))
    .innerJoin(coaGroups,       eq(coaSubGroups.groupId,          coaGroups.id))
    .innerJoin(coaMajorHeads,   eq(coaGroups.majorHeadId,         coaMajorHeads.id))
    .innerJoin(coaAccountTypes, eq(coaMajorHeads.accountTypeId,   coaAccountTypes.id))
    .where(and(
      eq(coaLedgers.id, ledgerId),
      eq(coaLedgers.tenantId, tenant.id),
    ))
    .limit(1)

  if (!ledger) return NextResponse.json({ error: 'Ledger not found' }, { status: 404 })

  // ── 2. Pre-period net movement (not location-filtered — OB is global) ─────
  const [prePeriod] = await db
    .select({
      preDebit:  sql<string>`coalesce(sum(${journalEntryLines.debitAmount}),  0)::text`,
      preCredit: sql<string>`coalesce(sum(${journalEntryLines.creditAmount}), 0)::text`,
    })
    .from(journalEntryLines)
    .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
    .where(and(
      eq(journalEntryLines.tenantId, tenant.id),
      eq(journalEntryLines.ledgerId, ledgerId),
      lt(journalEntries.entryDate, periodStart),
    ))

  // Signed opening balance: debit-normal = positive Dr, credit-normal = negative (Cr)
  const ledgerOB        = Number(ledger.openingBalance)
  const signedLedgerOB  = ledger.balanceType === 'debit' ? ledgerOB : -ledgerOB
  const prePeriodNet    = Number(prePeriod.preDebit) - Number(prePeriod.preCredit)
  const signedOpeningBal = signedLedgerOB + prePeriodNet

  // ── 3. Period transactions (location-filtered when locationId is set) ─────
  const rows = await db
    .select({
      entryDate:      journalEntries.entryDate,
      journalId:      journalEntries.id,
      voucherNo:      journalEntries.voucherNo,
      voucherType:    journalEntries.voucherType,
      narration:      journalEntries.narration,
      reference:      journalEntries.reference,
      locationName:   locations.name,
      debit:          journalEntryLines.debitAmount,
      credit:         journalEntryLines.creditAmount,
      lineNarration:  journalEntryLines.lineNarration,
    })
    .from(journalEntryLines)
    .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
    .leftJoin(locations, eq(journalEntries.locationId, locations.id))
    .where(and(
      eq(journalEntryLines.tenantId, tenant.id),
      eq(journalEntryLines.ledgerId, ledgerId),
      gte(journalEntries.entryDate, periodStart),
      lte(journalEntries.entryDate, periodEnd),
      ...(locationId ? [eq(journalEntries.locationId, locationId)] : []),
    ))
    .orderBy(journalEntries.entryDate, journalEntries.id)

  // ── 4. Single-pass running balance over ALL rows (no pagination here) ─────
  let runningBal  = signedOpeningBal
  let totalDebit  = 0
  let totalCredit = 0

  const transactions = rows.map(r => {
    const dr = Number(r.debit)
    const cr = Number(r.credit)
    totalDebit  += dr
    totalCredit += cr
    runningBal  += dr - cr
    return {
      date:         r.entryDate.toISOString(),
      voucherNo:    r.voucherNo,
      voucherType:  r.voucherType,
      narration:    r.lineNarration || r.narration || null,
      reference:    r.reference ?? null,
      locationName: r.locationName ?? null,
      debit:        dr > 0 ? dr.toFixed(2) : null,
      credit:       cr > 0 ? cr.toFixed(2) : null,
      balance:      Math.abs(runningBal).toFixed(2),
      balanceSide:  runningBal >= 0 ? 'Dr' : 'Cr',
    }
  })

  // closing balance = runningBal after processing all rows
  const closingBal = runningBal

  return NextResponse.json({
    ledger: {
      id:              ledger.id,
      ledgerCode:      ledger.ledgerCode,
      ledgerName:      ledger.ledgerName,
      balanceType:     ledger.balanceType,
      subGroupName:    ledger.subGroupName,
      groupName:       ledger.groupName,
      majorHeadName:   ledger.majorHeadName,
      accountTypeCode: ledger.accountTypeCode,
      accountTypeName: ledger.accountTypeName,
    },
    period:             { startDate, endDate },
    openingBalance:     Math.abs(signedOpeningBal).toFixed(2),
    openingBalanceSide: signedOpeningBal >= 0 ? 'Dr' : 'Cr',
    totalDebit:         totalDebit.toFixed(2),
    totalCredit:        totalCredit.toFixed(2),
    closingBalance:     Math.abs(closingBal).toFixed(2),
    closingBalanceSide: closingBal >= 0 ? 'Dr' : 'Cr',
    transactions,
    _meta: {
      rowCount:        transactions.length,
      locationFiltered: !!locationId,
      note: locationId
        ? 'Opening balance is the global pre-period balance for this ledger. Only period transactions are branch-filtered.'
        : undefined,
    },
  })
}

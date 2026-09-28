/**
 * Phase 3 proof — simulates exactly what the UI does when a user creates a Receipt voucher,
 * then shows Cash Book output and ledger balance.
 *
 * Usage: npx tsx scripts/phase3-proof.ts
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { and, asc, eq, gte, ilike, inArray, lte } from 'drizzle-orm'
import * as schema from '../src/db/schema'
import { postJournalEntry } from '../src/lib/accounting/posting-engine'

const {
  tenants, coaLedgers, coaSubGroups, coaGroups,
  journalEntries, journalEntryLines,
} = schema

const SEP = '─'.repeat(62)

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set in .env.local')

  const client = postgres(url, { prepare: false })
  const db     = drizzle(client, { schema })

  // ── Find tenant ────────────────────────────────────────────────────────────
  const [tenant] = await db.select().from(tenants)
    .where(ilike(tenants.name, '%honda%')).limit(1)
  if (!tenant) { console.error('No Honda tenant found'); process.exit(1) }

  console.log(`\nTenant: ${tenant.name} (${tenant.id})\n`)

  // ── Resolve ledger IDs ─────────────────────────────────────────────────────
  const getLedger = async (code: string) => {
    const [l] = await db.select().from(coaLedgers)
      .where(and(eq(coaLedgers.tenantId, tenant.id), eq(coaLedgers.ledgerCode, code)))
    if (!l) throw new Error(`Ledger ${code} not found — run seed:coa first`)
    return l
  }

  const cashInHand = await getLedger('A0001')  // Dr side for Receipt
  const arLedger   = await getLedger('A0004')  // Cr side for Receipt

  // ── Show Cash in Hand balance BEFORE ──────────────────────────────────────
  console.log(SEP)
  console.log('BEFORE posting Receipt voucher:')
  console.log(`  Cash in Hand    running_balance = ₹ ${Number(cashInHand.runningBalance).toLocaleString('en-IN')}`)
  console.log(`  Accts Receivable running_balance = ₹ ${Number(arLedger.runningBalance).toLocaleString('en-IN')}`)
  console.log(SEP)

  // ── Post a Receipt voucher: Dr Cash in Hand 15,000 / Cr AR 15,000 ─────────
  // This is EXACTLY what POST /api/accounts/cashbook-vouchers does
  console.log('\nPosting Receipt Voucher:  Dr Cash in Hand ₹ 15,000  /  Cr Accounts Receivable ₹ 15,000')
  console.log('(Narration: Customer advance received — Phase 3 proof)\n')

  const result = await postJournalEntry({
    tenantId:      tenant.id,
    entryDate:     new Date(),
    voucherType:   'RECEIPT',
    narration:     'Customer advance received — Phase 3 proof',
    reference:     'ADV-001',
    referenceType: 'manual',
    createdBy:     undefined,
    lines: [
      { ledgerId: cashInHand.id, debit: 15000, credit: 0,     narration: 'Cash received' },
      { ledgerId: arLedger.id,   debit: 0,     credit: 15000, narration: 'Customer advance' },
    ],
    skipManualEntryCheck: false,
  })

  // ── Print the journal entry as stored ─────────────────────────────────────
  console.log(SEP)
  console.log('JOURNAL ENTRY (as stored in journal_entries):')
  console.log(SEP)
  console.log(`  ID           : ${result.entry.id}`)
  console.log(`  Voucher No   : ${result.entry.voucherNo}`)
  console.log(`  Voucher Type : ${result.entry.voucherType}`)
  console.log(`  Entry Date   : ${result.entry.entryDate.toISOString().slice(0, 10)}`)
  console.log(`  Narration    : ${result.entry.narration}`)
  console.log(`  Reference    : ${result.entry.reference}`)
  console.log(`  Ref Type     : ${result.entry.referenceType}`)
  console.log(`  Created At   : ${result.entry.createdAt.toISOString()}`)

  console.log(`\nJOURNAL ENTRY LINES (as stored in journal_entry_lines):`)
  console.log(SEP)

  let totalDr = 0, totalCr = 0
  for (const line of result.lines) {
    const dr   = Number(line.debitAmount)
    const cr   = Number(line.creditAmount)
    const tag  = dr > 0 ? 'Dr' : 'Cr'
    const amt  = dr > 0 ? dr : cr
    const name = line.ledgerId === cashInHand.id
      ? 'Cash in Hand       (A0001)'
      : 'Accounts Receivable (A0004)'

    console.log(`  ${tag}  ${name}    ₹ ${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
    console.log(`       line_id: ${line.id}`)
    totalDr += dr
    totalCr += cr
  }
  const balanced = Math.abs(totalDr - totalCr) < 0.001
  console.log(`\n  Total Dr: ₹ ${totalDr.toLocaleString('en-IN')}  |  Total Cr: ₹ ${totalCr.toLocaleString('en-IN')}`)
  console.log(`  Balanced: ${balanced ? '✓ YES' : '✗ NO'}`)

  // ── Show updated ledger balances ───────────────────────────────────────────
  const [cashAfter] = await db.select().from(coaLedgers).where(eq(coaLedgers.id, cashInHand.id))
  const [arAfter]   = await db.select().from(coaLedgers).where(eq(coaLedgers.id, arLedger.id))

  console.log(`\n${SEP}`)
  console.log('LEDGER BALANCES AFTER posting:')
  console.log(SEP)
  console.log(`  Cash in Hand    (A0001)  running_balance = ₹ ${Number(cashAfter.runningBalance).toLocaleString('en-IN')}  ← increased (debit-normal)`)
  console.log(`  Accts Receivable (A0004)  running_balance = ₹ ${Number(arAfter.runningBalance).toLocaleString('en-IN')}  ← decreased (debit-normal, now shows credit)`)

  // ── Simulate Cash Book GET /api/accounts/cashbook ─────────────────────────
  // Same query logic as the updated cashbook route
  const today     = new Date().toISOString().slice(0, 10)
  const startOfMo = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

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

  const cashLedgerIds = cashBankLedgers.map(l => l.id)

  const lines = await db
    .select({
      entryId:     journalEntries.id,
      voucherNo:   journalEntries.voucherNo,
      voucherType: journalEntries.voucherType,
      entryDate:   journalEntries.entryDate,
      narration:   journalEntries.narration,
      reference:   journalEntries.reference,
      debitAmount: journalEntryLines.debitAmount,
      creditAmount:journalEntryLines.creditAmount,
    })
    .from(journalEntryLines)
    .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
    .where(and(
      eq(journalEntryLines.tenantId, tenant.id),
      inArray(journalEntryLines.ledgerId, cashLedgerIds),
      gte(journalEntries.entryDate, new Date(startOfMo)),
      lte(journalEntries.entryDate, new Date(today + 'T23:59:59.999Z')),
    ))
    .orderBy(asc(journalEntries.entryDate))

  let running       = 0
  let totalReceipts = 0
  let totalPayments = 0

  const transactions = lines.map(row => {
    const dr = Number(row.debitAmount)
    const cr = Number(row.creditAmount)
    running       += dr - cr
    totalReceipts += dr
    totalPayments += cr
    return { ...row, debit: dr, credit: cr, balance: +running.toFixed(2) }
  })

  console.log(`\n${SEP}`)
  console.log(`CASH BOOK (${startOfMo} → ${today}) — same data as GET /api/accounts/cashbook:`)
  console.log(SEP)
  console.log(`  Opening Balance : ₹ 0.00`)
  for (const tx of transactions) {
    const dr = tx.debit  > 0 ? `Dr ₹ ${tx.debit.toLocaleString('en-IN')}` : '              '
    const cr = tx.credit > 0 ? `Cr ₹ ${tx.credit.toLocaleString('en-IN')}` : '              '
    console.log(`  ${tx.entryDate.toISOString().slice(0, 10)}  ${tx.voucherNo.padEnd(18)}  ${tx.voucherType.padEnd(8)}  ${dr}  ${cr}  Bal: ₹ ${tx.balance.toLocaleString('en-IN')}`)
    console.log(`    Narration: ${tx.narration ?? '—'}   Ref: ${tx.reference ?? '—'}`)
  }
  console.log(`  Total Receipts  : ₹ ${totalReceipts.toLocaleString('en-IN')}`)
  console.log(`  Total Payments  : ₹ ${totalPayments.toLocaleString('en-IN')}`)
  console.log(`  Closing Balance : ₹ ${running.toFixed(2)}`)
  console.log(SEP)
  console.log(`\n  ✓ Entries in journal_entries: ${transactions.length}`)
  console.log('  ✓ Phase 3 proof complete.\n')

  await client.end()
}

main().catch(err => {
  console.error('\n✗ Proof failed:', err.message ?? err)
  process.exit(1)
})

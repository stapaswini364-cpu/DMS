/**
 * Posting engine smoke test — Phase 2 proof.
 *
 * Posts a ₹10,000 journal entry:
 *   Dr  Cash in Hand        10,000
 *   Cr  Accounts Receivable          10,000
 *
 * Usage: npx tsx scripts/test-posting-engine.ts [tenant-name-fragment]
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, ilike, and } from 'drizzle-orm'
import * as schema from '../src/db/schema'
import { postJournalEntry } from '../src/lib/accounting/posting-engine'

const { tenants, coaLedgers } = schema

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set in .env.local')

  const nameFilter = process.argv[2] ?? 'honda'

  const client = postgres(url, { prepare: false })
  const db = drizzle(client, { schema })

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(ilike(tenants.name, `%${nameFilter}%`))
    .limit(1)

  if (!tenant) {
    console.error(`No tenant matching "%${nameFilter}%" found.`)
    process.exit(1)
  }

  console.log(`\nTenant: ${tenant.name} (${tenant.id})\n`)

  // ── Look up the two ledgers ─────────────────────────────────────────────────

  const cashLedger = await db
    .select()
    .from(coaLedgers)
    .where(and(eq(coaLedgers.tenantId, tenant.id), eq(coaLedgers.ledgerCode, 'A0001')))
    .limit(1)
    .then(r => r[0])

  const arLedger = await db
    .select()
    .from(coaLedgers)
    .where(and(eq(coaLedgers.tenantId, tenant.id), eq(coaLedgers.ledgerCode, 'A0004')))
    .limit(1)
    .then(r => r[0])

  if (!cashLedger || !arLedger) {
    console.error('Required ledgers not found. Run `npm run seed:coa` first.')
    process.exit(1)
  }

  console.log(`Cash in Hand    (${cashLedger.id})  running_balance before: ₹${cashLedger.runningBalance}`)
  console.log(`Accounts Recv.  (${arLedger.id})  running_balance before: ₹${arLedger.runningBalance}`)

  // ── Post the journal entry ──────────────────────────────────────────────────

  console.log('\nPosting: Dr Cash in Hand ₹10,000 / Cr Accounts Receivable ₹10,000 …\n')

  const result = await postJournalEntry({
    tenantId:      tenant.id,
    entryDate:     new Date(),
    voucherType:   'RECEIPT',
    narration:     'Cash received from customer [Phase 2 smoke test]',
    referenceType: 'manual',
    lines: [
      { ledgerId: cashLedger.id, debit: 10000, credit: 0,     narration: 'Cash received' },
      { ledgerId: arLedger.id,   debit: 0,     credit: 10000, narration: 'Against A/R' },
    ],
  })

  // ── Print journal entry ────────────────────────────────────────────────────

  console.log('─── Journal Entry ───────────────────────────────────────────────')
  console.log(`Voucher No   : ${result.entry.voucherNo}`)
  console.log(`Type         : ${result.entry.voucherType}`)
  console.log(`Entry Date   : ${result.entry.entryDate.toISOString().slice(0, 10)}`)
  console.log(`Narration    : ${result.entry.narration}`)
  console.log(`Entry ID     : ${result.entry.id}`)

  console.log('\n─── Lines ───────────────────────────────────────────────────────')
  for (const line of result.lines) {
    const tag  = Number(line.debitAmount) > 0 ? 'Dr' : 'Cr'
    const amt  = Number(line.debitAmount) > 0 ? line.debitAmount : line.creditAmount
    const name = line.ledgerId === cashLedger.id ? 'Cash in Hand       ' : 'Accounts Receivable'
    console.log(`  ${tag}  ${name}  ₹${Number(amt).toLocaleString('en-IN')}`)
  }

  const debitTotal  = result.lines.reduce((s, l) => s + Number(l.debitAmount),  0)
  const creditTotal = result.lines.reduce((s, l) => s + Number(l.creditAmount), 0)
  console.log(`\n  Total Dr: ₹${debitTotal.toLocaleString('en-IN')}  |  Total Cr: ₹${creditTotal.toLocaleString('en-IN')}`)
  console.log(`  Balanced: ${Math.abs(debitTotal - creditTotal) < 0.001 ? '✓ YES' : '✗ NO'}`)

  // ── Print updated ledger balances ──────────────────────────────────────────

  const [cashAfter] = await db
    .select({ runningBalance: coaLedgers.runningBalance })
    .from(coaLedgers)
    .where(eq(coaLedgers.id, cashLedger.id))

  const [arAfter] = await db
    .select({ runningBalance: coaLedgers.runningBalance })
    .from(coaLedgers)
    .where(eq(coaLedgers.id, arLedger.id))

  console.log('\n─── Updated Ledger Balances ─────────────────────────────────────')
  console.log(`Cash in Hand        running_balance: ₹${Number(cashAfter.runningBalance).toLocaleString('en-IN')}  (was ₹${Number(cashLedger.runningBalance).toLocaleString('en-IN')})`)
  console.log(`Accounts Receivable running_balance: ₹${Number(arAfter.runningBalance).toLocaleString('en-IN')}  (was ₹${Number(arLedger.runningBalance).toLocaleString('en-IN')})`)
  console.log('\n✓ Phase 2 smoke test passed.\n')

  await client.end()
}

main().catch(err => {
  console.error('\n✗ Test failed:', err.message ?? err)
  process.exit(1)
})

/**
 * Phase 4 proof — creates a new test booking, records an MRN receipt, delivers it,
 * then shows the resulting journal entries and updated ledger balances.
 *
 * Usage: npx tsx scripts/phase4-proof.ts
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { and, count, desc, eq, gte, ilike, lt } from 'drizzle-orm'
import * as schema from '../src/db/schema'
import { postMrnEntry } from '../src/lib/accounting/booking-postings'
import { postDeliveryEntry } from '../src/lib/accounting/booking-postings'

const {
  tenants, coaLedgers, bookings, customers, locations,
  vehicleInventory, mrnReceipts,
  journalEntries, journalEntryLines,
} = schema

const SEP = '─'.repeat(62)

function dateStr(d: Date) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('')
}

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

  // ── Find any customer ──────────────────────────────────────────────────────
  const [customer] = await db.select({ id: customers.id, name: customers.name })
    .from(customers).where(eq(customers.tenantId, tenant.id)).limit(1)
  if (!customer) { console.error('No customer found'); process.exit(1) }

  // ── Find any location ──────────────────────────────────────────────────────
  const [location] = await db.select({ id: locations.id, name: locations.name })
    .from(locations).where(eq(locations.tenantId, tenant.id)).limit(1)
  if (!location) { console.error('No location found'); process.exit(1) }

  // ── Resolve key ledgers for BEFORE snapshot ───────────────────────────────
  const getLedger = async (code: string) => {
    const [l] = await db.select()
      .from(coaLedgers)
      .where(and(eq(coaLedgers.tenantId, tenant.id), eq(coaLedgers.ledgerCode, code)))
    if (!l) throw new Error(`Ledger ${code} not found — run seed:coa first`)
    return l
  }

  const cashLedger = await getLedger('A0001')   // Cash in Hand
  const arLedger   = await getLedger('A0004')   // Accounts Receivable
  const salesLedger = await getLedger('I0001')  // Sales-Vehicles

  console.log(SEP)
  console.log('BEFORE test:')
  console.log(`  Cash in Hand    (A0001)  ₹ ${Number(cashLedger.runningBalance).toLocaleString('en-IN')}`)
  console.log(`  Accts Receivable (A0004)  ₹ ${Number(arLedger.runningBalance).toLocaleString('en-IN')}`)
  console.log(`  Sales-Vehicles  (I0001)  ₹ ${Number(salesLedger.runningBalance).toLocaleString('en-IN')}`)
  console.log(SEP)

  // ── Create a test booking ─────────────────────────────────────────────────
  const now   = new Date()
  const today = dateStr(now)

  const [{ bookingSeq }] = await db
    .select({ bookingSeq: count() })
    .from(bookings)
    .where(eq(bookings.tenantId, tenant.id))

  const bookingNumber = `BOOK-${today}-${String(Number(bookingSeq) + 1).padStart(4, '0')}`
  const grandTotal    = 185000  // ₹ 1,85,000

  const [booking] = await db.insert(bookings).values({
    tenantId:        tenant.id,
    bookingNumber,
    customerId:      customer.id,
    locationId:      location.id,
    exShowroomPrice: '170000',
    rtoAmount:       '15000',
    onRoadPrice:     '185000',
    subTotal:        '185000',
    grandTotal:      String(grandTotal),
    pendingAmount:   String(grandTotal),
    bookingAmount:   '0',
    status:          'CONFIRMED',  // skip DRAFT→CONFIRMED for proof simplicity
    bookingDate:     now,
  }).returning()

  console.log(`\n✓ Created booking ${booking.bookingNumber} (grandTotal ₹ ${grandTotal.toLocaleString('en-IN')})`)

  // ── Simulate MRN receipt: ₹ 50,000 CASH ──────────────────────────────────
  const mrnAmount = 50000

  const todayStart    = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000)
  const [{ dailyCount }] = await db
    .select({ dailyCount: count() })
    .from(mrnReceipts)
    .where(and(
      eq(mrnReceipts.tenantId, tenant.id),
      gte(mrnReceipts.receivedAt, todayStart),
      lt(mrnReceipts.receivedAt, tomorrowStart),
    ))

  const mrnNumber = `MRN-${today}-${String(Number(dailyCount) + 1).padStart(4, '0')}`

  await db.insert(mrnReceipts).values({
    tenantId:    tenant.id,
    mrnNumber,
    bookingId:   booking.id,
    customerId:  customer.id,
    amount:      String(mrnAmount),
    paymentMode: 'CASH',
    receivedAt:  now,
  })

  console.log(`✓ MRN receipt ${mrnNumber} recorded (₹ ${mrnAmount.toLocaleString('en-IN')} CASH)`)
  console.log(`\nPosting MRN Journal Entry:  Dr Cash in Hand ₹ ${mrnAmount.toLocaleString('en-IN')}  /  Cr Accounts Receivable ₹ ${mrnAmount.toLocaleString('en-IN')}`)

  await postMrnEntry({
    tenantId:      tenant.id,
    bookingId:     booking.id,
    bookingNumber: booking.bookingNumber,
    mrnNumber,
    amount:        mrnAmount,
    paymentMode:   'CASH',
    locationId:    location.id,
    createdBy:     undefined,
  })
  console.log('✓ MRN journal entry posted')

  // ── Simulate Delivery: Dr A/R ₹ 1,85,000 / Cr Sales-Vehicles ₹ 1,85,000 ─
  console.log(`\nPosting Delivery Journal Entry:  Dr Accounts Receivable ₹ ${grandTotal.toLocaleString('en-IN')}  /  Cr Sales-Vehicles ₹ ${grandTotal.toLocaleString('en-IN')}`)

  await postDeliveryEntry({
    tenantId:      tenant.id,
    bookingId:     booking.id,
    bookingNumber: booking.bookingNumber,
    locationId:    location.id,
    createdBy:     undefined,
    components: {
      exShowroom:       170000,
      rto:              15000,
      insurance:        0,
      extendedWarranty: 0,
      amc:              0,
      handling:         0,
      etc:              0,
      hp:               0,
      accessories:      0,
      discount:         0,
      exchange:         0,
      subTotal:         185000,
      grandTotal,
    },
  })
  console.log('✓ Delivery journal entry posted')

  // ── Fetch all journal entries for this booking ─────────────────────────────
  const entries = await db
    .select()
    .from(journalEntries)
    .where(and(
      eq(journalEntries.tenantId, tenant.id),
      // match either MRN number or booking number as reference
    ))
    .orderBy(desc(journalEntries.createdAt))
    .limit(2)

  console.log(`\n${SEP}`)
  console.log('JOURNAL ENTRIES (last 2 for this tenant):')
  console.log(SEP)

  for (const je of entries.reverse()) {
    console.log(`  ${je.voucherNo}  |  ${je.voucherType}  |  ${je.entryDate.toISOString().slice(0, 10)}`)
    console.log(`  Ref: ${je.reference ?? '—'}  |  Narration: ${je.narration ?? '—'}`)

    const lines = await db
      .select({
        debitAmount:  journalEntryLines.debitAmount,
        creditAmount: journalEntryLines.creditAmount,
        ledgerCode:   coaLedgers.ledgerCode,
        ledgerName:   coaLedgers.ledgerName,
      })
      .from(journalEntryLines)
      .where(eq(journalEntryLines.journalEntryId, je.id))
      .leftJoin(coaLedgers, eq(journalEntryLines.ledgerId, coaLedgers.id))

    for (const line of lines) {
      const dr = Number(line.debitAmount)
      const cr = Number(line.creditAmount)
      const side = dr > 0 ? `Dr ₹ ${dr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : `Cr ₹ ${cr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      console.log(`    ${side}   ${line.ledgerName} (${line.ledgerCode})`)
    }
    console.log()
  }

  // ── Show updated ledger balances ───────────────────────────────────────────
  const [cashAfter]  = await db.select().from(coaLedgers).where(eq(coaLedgers.id, cashLedger.id))
  const [arAfter]    = await db.select().from(coaLedgers).where(eq(coaLedgers.id, arLedger.id))
  const [salesAfter] = await db.select().from(coaLedgers).where(eq(coaLedgers.id, salesLedger.id))

  console.log(SEP)
  console.log('LEDGER BALANCES AFTER:')
  console.log(SEP)
  const fmtDiff = (after: string, before: string) => {
    const diff = Number(after) - Number(before)
    return diff >= 0 ? `+₹ ${diff.toLocaleString('en-IN')}` : `-₹ ${Math.abs(diff).toLocaleString('en-IN')}`
  }
  console.log(`  Cash in Hand    (A0001)  ₹ ${Number(cashAfter.runningBalance).toLocaleString('en-IN')}  (${fmtDiff(cashAfter.runningBalance, cashLedger.runningBalance)})`)
  console.log(`  Accts Receivable (A0004)  ₹ ${Number(arAfter.runningBalance).toLocaleString('en-IN')}  (${fmtDiff(arAfter.runningBalance, arLedger.runningBalance)})`)
  console.log(`  Sales-Vehicles  (I0001)  ₹ ${Number(salesAfter.runningBalance).toLocaleString('en-IN')}  (${fmtDiff(salesAfter.runningBalance, salesLedger.runningBalance)})`)

  console.log(`\n  Expected changes:`)
  console.log(`    Cash in Hand    : +₹ ${mrnAmount.toLocaleString('en-IN')} (MRN CASH receipt Dr)`)
  console.log(`    Accts Receivable: net ${(grandTotal - mrnAmount).toLocaleString('en-IN')} (Dr ${grandTotal.toLocaleString('en-IN')} delivery − Cr ${mrnAmount.toLocaleString('en-IN')} MRN)`)
  console.log(`    Sales-Vehicles  : +₹ ${grandTotal.toLocaleString('en-IN')} (Cr on delivery, credit-normal → balance increases)`)

  console.log(SEP)
  console.log('\n  ✓ Phase 4 proof complete.\n')

  await client.end()
}

main().catch(err => {
  console.error('\n✗ Proof failed:', err.message ?? err)
  process.exit(1)
})

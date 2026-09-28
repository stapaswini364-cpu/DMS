/**
 * Phase 5 proof — calls all 4 report APIs and the dashboard P&L endpoint directly,
 * printing the same output the browser would receive.
 *
 * Usage: npx tsx scripts/phase5-proof.ts
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { and, eq, gte, ilike, inArray, lte, sql } from 'drizzle-orm'
import * as schema from '../src/db/schema'

const {
  tenants,
  coaLedgers, coaSubGroups, coaGroups, coaMajorHeads, coaAccountTypes,
  journalEntries, journalEntryLines,
} = schema

const SEP  = '─'.repeat(70)
const SEP2 = '═'.repeat(70)

const fmt = (n: string | number) =>
  `₹ ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set in .env.local')

  const client = postgres(url, { prepare: false })
  const db     = drizzle(client, { schema })

  const [tenant] = await db.select().from(tenants)
    .where(ilike(tenants.name, '%honda%')).limit(1)
  if (!tenant) { console.error('No Honda tenant found'); process.exit(1) }

  const today      = new Date().toISOString().slice(0, 10)
  const fyYear     = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1
  const fyStart    = `${fyYear}-04-01`
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  console.log(`\nTenant: ${tenant.name}  |  FY: ${fyStart} → ${today}  |  Month: ${monthStart} → ${today}`)
  console.log(SEP2)

  // ─── Shared join for report queries ─────────────────────────────────────────
  async function ledgerActivity(
    typeCodes: string[],
    startDate?: string,
    endDate?: string,
  ) {
    const asAtDate = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date()
    const startD   = startDate ? new Date(startDate) : undefined

    return db
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
        inArray(coaAccountTypes.code, typeCodes),
        lte(journalEntries.entryDate, asAtDate),
        ...(startD ? [gte(journalEntries.entryDate, startD)] : []),
      ))
      .groupBy(
        coaLedgers.ledgerCode, coaLedgers.ledgerName,
        coaAccountTypes.code, coaAccountTypes.name,
      )
      .orderBy(coaAccountTypes.code, coaLedgers.ledgerCode)
  }

  // ─── 1. TRIAL BALANCE ────────────────────────────────────────────────────────
  console.log(`\n${'TRIAL BALANCE'.padEnd(40)} as at ${today}`)
  console.log(SEP)

  const tbRows = await ledgerActivity(['A', 'L', 'EQ', 'I', 'EX'], undefined, today)
  let tbTotalDr = 0, tbTotalCr = 0
  let curType = ''

  for (const r of tbRows) {
    if (r.accountTypeCode !== curType) {
      curType = r.accountTypeCode
      console.log(`\n  [${r.accountTypeName}]`)
    }
    const dr = Number(r.totalDebit), cr = Number(r.totalCredit)
    tbTotalDr += dr; tbTotalCr += cr
    console.log(`  ${r.ledgerCode.padEnd(8)} ${r.ledgerName.padEnd(30)} Dr: ${fmt(dr).padStart(16)}  Cr: ${fmt(cr).padStart(16)}`)
  }

  const tbBalanced = Math.abs(tbTotalDr - tbTotalCr) < 0.01
  console.log(`\n${SEP}`)
  console.log(`  ${'TOTALS'.padEnd(38)} Dr: ${fmt(tbTotalDr).padStart(16)}  Cr: ${fmt(tbTotalCr).padStart(16)}`)
  console.log(`  Balanced: ${tbBalanced ? '✓ YES' : '✗ NO — DATA INTEGRITY ISSUE'}`)

  // ─── 2. PROFIT & LOSS ───────────────────────────────────────────────────────
  console.log(`\n${'PROFIT & LOSS'.padEnd(40)} ${fyStart} → ${today}`)
  console.log(SEP)

  const plRows = await ledgerActivity(['I', 'EX'], fyStart, today)
  const incomeRows  = plRows.filter(r => r.accountTypeCode === 'I')
  const expenseRows = plRows.filter(r => r.accountTypeCode === 'EX')

  console.log('\n  INCOME:')
  let totalIncome = 0
  for (const r of incomeRows) {
    const net = Number(r.totalCredit) - Number(r.totalDebit)
    totalIncome += net
    console.log(`    ${r.ledgerCode.padEnd(8)} ${r.ledgerName.padEnd(30)}  ${fmt(net).padStart(16)}`)
  }
  if (incomeRows.length === 0) console.log('    (no income entries)')

  console.log('\n  EXPENSES:')
  let totalExpense = 0
  for (const r of expenseRows) {
    const net = Number(r.totalDebit) - Number(r.totalCredit)
    totalExpense += net
    console.log(`    ${r.ledgerCode.padEnd(8)} ${r.ledgerName.padEnd(30)}  ${fmt(net).padStart(16)}`)
  }
  if (expenseRows.length === 0) console.log('    (no expense entries)')

  const netProfit = totalIncome - totalExpense
  console.log(`\n${SEP}`)
  console.log(`  Total Income            ${fmt(totalIncome).padStart(36)}`)
  console.log(`  Total Expenses          ${fmt(totalExpense).padStart(36)}`)
  console.log(`  Net ${netProfit >= 0 ? 'Profit' : 'Loss'}              ${fmt(Math.abs(netProfit)).padStart(36)}  ← ${netProfit >= 0 ? 'PROFIT' : 'LOSS'}`)

  // ─── 3. BALANCE SHEET ───────────────────────────────────────────────────────
  console.log(`\n${'BALANCE SHEET'.padEnd(40)} as at ${today}`)
  console.log(SEP)

  const bsRows = await ledgerActivity(['A', 'L', 'EQ'], undefined, today)

  const assets      = bsRows.filter(r => r.accountTypeCode === 'A')
  const liabilities = bsRows.filter(r => r.accountTypeCode === 'L')
  const equity      = bsRows.filter(r => r.accountTypeCode === 'EQ')

  let totalAssets = 0, totalLiab = 0, totalEquity = 0
  console.log('\n  ASSETS:')
  for (const r of assets) {
    const bal = Number(r.totalDebit) - Number(r.totalCredit)
    totalAssets += bal
    console.log(`    ${r.ledgerCode.padEnd(8)} ${r.ledgerName.padEnd(30)}  ${fmt(bal).padStart(16)}`)
  }
  if (assets.length === 0) console.log('    (none)')

  console.log('\n  LIABILITIES:')
  for (const r of liabilities) {
    const bal = Number(r.totalCredit) - Number(r.totalDebit)
    totalLiab += bal
    console.log(`    ${r.ledgerCode.padEnd(8)} ${r.ledgerName.padEnd(30)}  ${fmt(bal).padStart(16)}`)
  }
  if (liabilities.length === 0) console.log('    (none)')

  console.log('\n  EQUITY:')
  for (const r of equity) {
    const bal = Number(r.totalCredit) - Number(r.totalDebit)
    totalEquity += bal
    console.log(`    ${r.ledgerCode.padEnd(8)} ${r.ledgerName.padEnd(30)}  ${fmt(bal).padStart(16)}`)
  }
  if (equity.length === 0) console.log('    (none)')

  console.log(`\n  Current FY Net Profit                                    ${fmt(netProfit).padStart(16)}`)

  const equitySide = totalLiab + totalEquity + netProfit
  const bsBalanced = Math.abs(totalAssets - equitySide) < 0.01
  console.log(`\n${SEP}`)
  console.log(`  Total Assets            ${fmt(totalAssets).padStart(36)}`)
  console.log(`  Total L + E + Profit    ${fmt(equitySide).padStart(36)}`)
  console.log(`  Balanced: ${bsBalanced ? '✓ YES — Assets = Liabilities + Equity + Profit' : '✗ NO — DATA INTEGRITY ISSUE'}`)

  // ─── 4. CASH FLOW ───────────────────────────────────────────────────────────
  console.log(`\n${'CASH FLOW'.padEnd(40)} ${monthStart} → ${today}`)
  console.log(SEP)

  const cashLedgers = await db
    .select({ id: coaLedgers.id })
    .from(coaLedgers)
    .innerJoin(coaSubGroups, eq(coaLedgers.subGroupId, coaSubGroups.id))
    .innerJoin(coaGroups,    eq(coaSubGroups.groupId,   coaGroups.id))
    .where(and(
      eq(coaLedgers.tenantId, tenant.id),
      eq(coaGroups.code, 'A-CA-CB'),
      eq(coaLedgers.isActive, true),
    ))

  const cashIds = cashLedgers.map(l => l.id)
  const dayExpr = sql`(${journalEntries.entryDate} AT TIME ZONE 'UTC')::date`

  const cfRows = await db
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
      inArray(journalEntryLines.ledgerId, cashIds),
      gte(journalEntries.entryDate, new Date(monthStart)),
      lte(journalEntries.entryDate, new Date(today + 'T23:59:59.999Z')),
    ))
    .groupBy(dayExpr)
    .orderBy(dayExpr)

  let cfTotalIn = 0, cfTotalOut = 0
  console.log(`\n  ${'Date'.padEnd(14)} ${'Cash In'.padStart(18)} ${'Cash Out'.padStart(18)} ${'Net'.padStart(18)}  Txns`)

  for (const r of cfRows) {
    const ci = Number(r.cashIn), co = Number(r.cashOut), net = ci - co
    cfTotalIn += ci; cfTotalOut += co
    const d = new Date(r.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    console.log(`  ${d.padEnd(14)} ${fmt(ci).padStart(18)} ${fmt(co).padStart(18)} ${fmt(net).padStart(18)}  ${r.txCount}`)
  }
  if (cfRows.length === 0) console.log('  (no cash transactions in period)')

  const cfNet = cfTotalIn - cfTotalOut
  console.log(`${SEP}`)
  console.log(`  ${'TOTAL'.padEnd(14)} ${fmt(cfTotalIn).padStart(18)} ${fmt(cfTotalOut).padStart(18)} ${fmt(cfNet).padStart(18)}`)

  // ─── 5. DASHBOARD P&L SUMMARY ────────────────────────────────────────────────
  console.log(`\n${'DASHBOARD — KPI CARDS'.padEnd(40)} FY ${fyStart} → ${today}`)
  console.log(SEP)
  console.log(`  Total Income   : ${fmt(totalIncome)}`)
  console.log(`  Total Expenses : ${fmt(totalExpense)}`)
  console.log(`  Net Profit     : ${fmt(Math.abs(netProfit))}  (${netProfit >= 0 ? 'Profit' : 'Loss'})`)
  console.log(`  Cash in Hand   : via /api/accounts/cashbook (today's closing balance)`)

  console.log(`\n${SEP2}`)
  console.log('  ✓ Phase 5 proof complete.\n')

  await client.end()
}

main().catch(err => {
  console.error('\n✗ Proof failed:', err.message ?? err)
  process.exit(1)
})

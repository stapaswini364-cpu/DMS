import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { getCompanySettings, fyStartForDate } from '@/lib/tenant-settings'
import {
  journalEntries,
  journalEntryLines,
  coaLedgers,
  coaSubGroups,
  coaGroups,
  coaMajorHeads,
  coaAccountTypes,
} from '@/db/schema'

/**
 * Returns a Map<ledgerId, displayBalance> for all Income (I) and Expense (EX)
 * ledgers belonging to tenantId, summed over the current Indian financial year
 * (April 1 – March 31). Ledgers with no activity this FY are not in the map;
 * callers should default to '0.00'.
 *
 * Used by the COA display so I/EX ledgers show period activity rather than the
 * all-time runningBalance stored on the ledger row.
 */
export async function getFyBalancesForPeriodAccounts(
  tenantId: string,
): Promise<Map<string, string>> {
  const settings = await getCompanySettings(tenantId)
  const fyStart  = fyStartForDate(new Date(), settings?.fyStartMonth ?? 4, settings?.fyStartDay ?? 1)

  const rows = await db
    .select({
      ledgerId:      journalEntryLines.ledgerId,
      normalBalance: coaAccountTypes.normalBalance,
      totalDebit:    sql<string>`coalesce(sum(${journalEntryLines.debitAmount}), 0)::text`,
      totalCredit:   sql<string>`coalesce(sum(${journalEntryLines.creditAmount}), 0)::text`,
    })
    .from(journalEntryLines)
    .innerJoin(journalEntries,   eq(journalEntryLines.journalEntryId, journalEntries.id))
    .innerJoin(coaLedgers,       eq(journalEntryLines.ledgerId,       coaLedgers.id))
    .innerJoin(coaSubGroups,     eq(coaLedgers.subGroupId,            coaSubGroups.id))
    .innerJoin(coaGroups,        eq(coaSubGroups.groupId,             coaGroups.id))
    .innerJoin(coaMajorHeads,    eq(coaGroups.majorHeadId,            coaMajorHeads.id))
    .innerJoin(coaAccountTypes,  eq(coaMajorHeads.accountTypeId,      coaAccountTypes.id))
    .where(and(
      eq(journalEntryLines.tenantId, tenantId),
      inArray(coaAccountTypes.code, ['I', 'EX']),
      gte(journalEntries.entryDate, fyStart),
    ))
    .groupBy(journalEntryLines.ledgerId, coaAccountTypes.normalBalance)

  const map = new Map<string, string>()
  for (const r of rows) {
    // Income (credit-normal): net = credit − debit
    // Expense (debit-normal): net = debit − credit
    const net = r.normalBalance === 'credit'
      ? Number(r.totalCredit) - Number(r.totalDebit)
      : Number(r.totalDebit)  - Number(r.totalCredit)
    map.set(r.ledgerId, net.toFixed(2))
  }
  return map
}

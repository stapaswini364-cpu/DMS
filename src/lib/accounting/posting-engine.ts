/**
 * Posting Engine — the single point of truth for writing double-entry journal entries.
 *
 * Nothing else in the app should update ledger balances or write journal_entry_lines directly.
 * Every financial transaction must flow through postJournalEntry().
 */

import { and, count, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  coaLedgers,
  coaSubGroups,
  coaGroups,
  coaMajorHeads,
  coaAccountTypes,
  journalEntries,
  journalEntryLines,
  jeVoucherTypeEnum,
  type JournalEntry,
  type JournalEntryLine,
} from '@/db/schema'

// ─── Public types ─────────────────────────────────────────────────────────────

export type JeVoucherType = typeof jeVoucherTypeEnum.enumValues[number]

export interface PostingLine {
  ledgerId:    string
  debit:       number | string
  credit:      number | string
  narration?:  string
}

export interface PostJournalEntryInput {
  tenantId:       string
  entryDate:      Date
  voucherType:    JeVoucherType
  narration?:     string
  reference?:     string
  referenceType?: string
  referenceId?:   string
  locationId?:    string
  createdBy?:     string
  lines:          PostingLine[]
  /** Set true for system-generated postings (sales, etc.) to bypass allow_manual_entry check */
  skipManualEntryCheck?: boolean
}

export interface PostJournalEntryResult {
  entry: JournalEntry
  lines: JournalEntryLine[]
}

// ─── Voucher number helpers ───────────────────────────────────────────────────

const JE_PREFIX: Record<JeVoucherType, string> = {
  RECEIPT:  'RV',
  PAYMENT:  'PV',
  SALES:    'SV',
  PURCHASE: 'PUV',
  CONTRA:   'CV',
  JOURNAL:  'JV',
  MANUAL:   'JE',
}

function dateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('')
}

// ─── Validation error ─────────────────────────────────────────────────────────

export class PostingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PostingError'
  }
}

// ─── Core engine ─────────────────────────────────────────────────────────────

export async function postJournalEntry(
  input: PostJournalEntryInput,
): Promise<PostJournalEntryResult> {
  const { tenantId, entryDate, voucherType, narration, reference, referenceType, referenceId, locationId, createdBy, lines, skipManualEntryCheck = false } = input

  // ── Validate line count ─────────────────────────────────────────────────────
  if (!lines || lines.length < 2) {
    throw new PostingError('A journal entry must have at least 2 lines.')
  }

  // ── Normalise amounts and validate individual lines ─────────────────────────
  const normLines = lines.map((l, i) => {
    const debit  = Number(l.debit  ?? 0)
    const credit = Number(l.credit ?? 0)
    if (isNaN(debit)  || debit  < 0) throw new PostingError(`Line ${i + 1}: debit must be a non-negative number.`)
    if (isNaN(credit) || credit < 0) throw new PostingError(`Line ${i + 1}: credit must be a non-negative number.`)
    if (debit === 0 && credit === 0) throw new PostingError(`Line ${i + 1}: both debit and credit are zero.`)
    if (debit > 0 && credit > 0)     throw new PostingError(`Line ${i + 1}: a line cannot have both debit and credit amounts.`)
    if (!l.ledgerId)                 throw new PostingError(`Line ${i + 1}: ledgerId is required.`)
    return { ...l, debit, credit }
  })

  // ── Validate balance ────────────────────────────────────────────────────────
  const totalDebit  = normLines.reduce((s, l) => s + l.debit,  0)
  const totalCredit = normLines.reduce((s, l) => s + l.credit, 0)
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new PostingError(
      `Journal entry does not balance: total debits ${totalDebit.toFixed(2)} ≠ total credits ${totalCredit.toFixed(2)}.`,
    )
  }

  // ── Validate ledgers ────────────────────────────────────────────────────────
  const ledgerIds = [...new Set(normLines.map(l => l.ledgerId))]

  const ledgerData = await db
    .select({
      id:              coaLedgers.id,
      isActive:        coaLedgers.isActive,
      allowManualEntry: coaLedgers.allowManualEntry,
      runningBalance:  coaLedgers.runningBalance,
      normalBalance:   coaAccountTypes.normalBalance,
    })
    .from(coaLedgers)
    .innerJoin(coaSubGroups,  eq(coaLedgers.subGroupId,       coaSubGroups.id))
    .innerJoin(coaGroups,     eq(coaSubGroups.groupId,         coaGroups.id))
    .innerJoin(coaMajorHeads, eq(coaGroups.majorHeadId,        coaMajorHeads.id))
    .innerJoin(coaAccountTypes, eq(coaMajorHeads.accountTypeId, coaAccountTypes.id))
    .where(and(
      inArray(coaLedgers.id, ledgerIds),
      eq(coaLedgers.tenantId, tenantId),
    ))

  if (ledgerData.length !== ledgerIds.length) {
    const found = new Set(ledgerData.map(l => l.id))
    const missing = ledgerIds.filter(id => !found.has(id))
    throw new PostingError(`Ledger(s) not found or do not belong to this tenant: ${missing.join(', ')}`)
  }

  const ledgerMap = new Map(ledgerData.map(l => [l.id, l]))

  for (const l of ledgerData) {
    if (!l.isActive) {
      throw new PostingError(`Ledger ${l.id} is inactive and cannot be posted to.`)
    }
    if (!skipManualEntryCheck && !l.allowManualEntry) {
      throw new PostingError(
        `Ledger ${l.id} does not allow manual entry. Use a system posting (skipManualEntryCheck: true) for automated flows.`,
      )
    }
  }

  // ── Write in a single DB transaction ────────────────────────────────────────
  return db.transaction(async (tx) => {
    // Auto-generate voucher_no: PREFIX-YYYYMMDD-NNNN (count-based, same as existing vouchers)
    const now = new Date()
    const [{ existingCount }] = await tx
      .select({ existingCount: count() })
      .from(journalEntries)
      .where(and(
        eq(journalEntries.tenantId, tenantId),
        eq(journalEntries.voucherType, voucherType),
      ))

    const voucherNo = `${JE_PREFIX[voucherType]}-${dateStr(now)}-${String(Number(existingCount) + 1).padStart(4, '0')}`

    // Insert header
    const [entry] = await tx
      .insert(journalEntries)
      .values({
        tenantId,
        entryDate,
        voucherNo,
        voucherType,
        narration:     narration     ?? null,
        reference:     reference     ?? null,
        referenceType: referenceType ?? null,
        referenceId:   referenceId   ?? null,
        locationId:    locationId    ?? null,
        createdBy:     createdBy     ?? null,
      })
      .returning()

    // Insert lines
    const insertedLines = await tx
      .insert(journalEntryLines)
      .values(
        normLines.map(l => ({
          tenantId,
          journalEntryId: entry.id,
          ledgerId:       l.ledgerId,
          debitAmount:    l.debit.toFixed(2),
          creditAmount:   l.credit.toFixed(2),
          lineNarration:  l.narration ?? null,
        })),
      )
      .returning()

    // Update each ledger's running_balance.
    // For debit-normal ledgers:  runningBalance += debit - credit
    // For credit-normal ledgers: runningBalance += credit - debit
    for (const line of normLines) {
      const info = ledgerMap.get(line.ledgerId)!
      const delta = info.normalBalance === 'debit'
        ? (line.debit - line.credit).toFixed(2)
        : (line.credit - line.debit).toFixed(2)

      await tx
        .update(coaLedgers)
        .set({ runningBalance: sql`running_balance + ${delta}::numeric` })
        .where(eq(coaLedgers.id, line.ledgerId))
    }

    return { entry, lines: insertedLines }
  })
}

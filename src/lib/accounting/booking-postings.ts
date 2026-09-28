import { postJournalEntry, PostingError, type PostingLine, type PostJournalEntryResult } from './posting-engine'
import { getSystemLedgers, cashLedgerForMode, type SystemLedgers } from './system-ledgers'

export async function postMrnEntry(params: {
  tenantId:      string
  bookingId?:    string
  bookingNumber?: string
  mrnNumber:     string
  amount:        number
  paymentMode:   string
  locationId?:   string
  createdBy?:    string
}): Promise<void> {
  const { tenantId, bookingNumber, mrnNumber, amount, paymentMode, locationId, createdBy } = params

  const ledgers = await getSystemLedgers(tenantId)
  const drLedger = cashLedgerForMode(paymentMode, ledgers)
  const crLedger = ledgers.accountsReceivable

  if (!drLedger) throw new Error(`No cash/bank ledger for paymentMode=${paymentMode} — seed COA first`)
  if (!crLedger) throw new Error('Accounts Receivable ledger (A0004) not found — seed COA first')

  await postJournalEntry({
    tenantId,
    entryDate:     new Date(),
    voucherType:   'RECEIPT',
    narration:     bookingNumber ? `Payment received for booking ${bookingNumber}` : `Standalone advance — ${mrnNumber}`,
    reference:     mrnNumber,
    referenceType: 'mrn',
    locationId,
    createdBy,
    lines: [
      { ledgerId: drLedger, debit: amount,  credit: 0 },
      { ledgerId: crLedger, debit: 0,       credit: amount },
    ],
    skipManualEntryCheck: false,
  })
}

export async function postServiceCompletionEntry(params: {
  tenantId:         string
  serviceBookingId: string
  jobCardNumber:    string
  finalNetAmount:   number
  locationId?:      string
  createdBy?:       string
}): Promise<void> {
  const { tenantId, serviceBookingId, jobCardNumber, finalNetAmount, locationId, createdBy } = params

  const ledgers = await getSystemLedgers(tenantId)
  const drLedger = ledgers.accountsReceivable
  const crLedger = ledgers.serviceIncome

  if (!drLedger) throw new Error('Accounts Receivable ledger (A0004) not found — seed COA first')
  if (!crLedger) throw new Error('Service Income ledger (I0002) not found — seed COA first')

  await postJournalEntry({
    tenantId,
    entryDate:     new Date(),
    voucherType:   'SALES',
    narration:     `Service completed — ${jobCardNumber}`,
    reference:     jobCardNumber,
    referenceType: 'service',
    referenceId:   serviceBookingId,
    locationId,
    createdBy,
    lines: [
      { ledgerId: drLedger, debit: finalNetAmount, credit: 0 },
      { ledgerId: crLedger, debit: 0,              credit: finalNetAmount },
    ],
    skipManualEntryCheck: true,
  })
}

// ── Vehicle delivery posting (multi-line) ─────────────────────────────────────

export interface DeliveryComponents {
  exShowroom:       number
  rto:              number
  insurance:        number
  extendedWarranty: number
  amc:              number
  handling:         number
  etc:              number
  hp:              number
  accessories:      number   // maps from bookings.addon_price
  discount:         number   // bookings.discount_amount
  exchange:         number   // bookings.exchange_value
  subTotal:         number
  grandTotal:       number
}

interface RevenueMapEntry { key: keyof DeliveryComponents; ledgerCode: string; ledgerId: string | null; label: string }

function revenueMap(ledgers: SystemLedgers): RevenueMapEntry[] {
  return [
    { key: 'exShowroom',       ledgerCode: 'I0003', ledgerId: ledgers.salesExShowroom,       label: 'Ex-Showroom Price' },
    { key: 'rto',              ledgerCode: 'I0004', ledgerId: ledgers.salesRto,              label: 'RTO Charges' },
    { key: 'insurance',        ledgerCode: 'I0005', ledgerId: ledgers.salesInsurance,        label: 'Insurance' },
    { key: 'extendedWarranty', ledgerCode: 'I0006', ledgerId: ledgers.salesExtendedWarranty, label: 'Extended Warranty' },
    { key: 'amc',              ledgerCode: 'I0007', ledgerId: ledgers.salesAmc,              label: 'AMC' },
    { key: 'handling',         ledgerCode: 'I0008', ledgerId: ledgers.salesHandling,         label: 'Handling Charges' },
    { key: 'etc',              ledgerCode: 'I0009', ledgerId: ledgers.salesEtc,              label: 'ETC Charges' },
    { key: 'hp',               ledgerCode: 'I0010', ledgerId: ledgers.salesHp,               label: 'HP/Hypothecation' },
    { key: 'accessories',      ledgerCode: 'I0011', ledgerId: ledgers.salesAccessories,      label: 'Accessories' },
  ]
}

export interface BuiltDeliveryEntry {
  lines: PostingLine[]
  totalDebit: number
  totalCredit: number
  componentSum: number
}

/**
 * Pure builder — no DB writes. Returns the exact PostingLines that
 * `postDeliveryEntry` would submit, plus reconciliation totals. Exposed so
 * dry-run scripts can inspect what would post before it does.
 *
 * Enforced invariants (throws PostingError on violation):
 *   1. All required system ledger IDs must be resolved (fail-fast if COA
 *      hasn't been re-seeded / migration hasn't run).
 *   2. subTotal must equal sum of the 9 revenue components (± 0.001).
 *   3. grandTotal + discount + exchange must equal subTotal (± 0.001) —
 *      matches the form's own arithmetic (BookingForm.tsx:127).
 *   4. sum(DR) must equal sum(CR) — posting-engine re-checks this too, but
 *      catching it here gives a clearer error attributing to delivery.
 */
export function buildDeliveryEntryLines(
  ledgers: SystemLedgers,
  c: DeliveryComponents,
): BuiltDeliveryEntry {
  // ── Guard: required ledgers ────────────────────────────────────────────
  const missing: string[] = []
  if (!ledgers.accountsReceivable) missing.push('A0004 Accounts Receivable')
  const revs = revenueMap(ledgers)
  for (const r of revs) {
    // Only fail on ledgers we'd actually credit (component > 0)
    if (Number(c[r.key]) > 0 && !r.ledgerId) missing.push(`${r.ledgerCode} ${r.label}`)
  }
  if (c.discount > 0 && !ledgers.discountGiven)         missing.push('EX0007 Discount Given')
  if (c.exchange > 0 && !ledgers.usedVehicleInventory) missing.push('A0006 Used Vehicle Inventory')
  if (missing.length > 0) {
    throw new PostingError(`Delivery posting blocked — missing system ledgers: ${missing.join(', ')}. Run migration 0019 or re-seed COA.`)
  }

  // ── Build CR lines (skip zero components) ──────────────────────────────
  const lines: PostingLine[] = []
  let componentSum = 0
  for (const r of revs) {
    const amt = Number(c[r.key])
    if (amt > 0) {
      lines.push({ ledgerId: r.ledgerId!, debit: 0, credit: amt, narration: r.label })
      componentSum += amt
    }
  }

  // ── Invariant 2: subTotal == sum(components) ───────────────────────────
  if (Math.abs(componentSum - c.subTotal) > 0.001) {
    throw new PostingError(
      `Booking data integrity error: sum of 9 revenue components (${componentSum.toFixed(2)}) ≠ sub_total (${c.subTotal.toFixed(2)}). Check the source booking row.`,
    )
  }

  // ── Invariant 3: grandTotal + discount + exchange == subTotal ──────────
  const arithmeticCheck = c.grandTotal + c.discount + c.exchange
  if (Math.abs(arithmeticCheck - c.subTotal) > 0.001) {
    throw new PostingError(
      `Booking data integrity error: grand_total (${c.grandTotal.toFixed(2)}) + discount (${c.discount.toFixed(2)}) + exchange (${c.exchange.toFixed(2)}) = ${arithmeticCheck.toFixed(2)}, expected sub_total (${c.subTotal.toFixed(2)}).`,
    )
  }

  // ── Build DR lines ─────────────────────────────────────────────────────
  lines.push({ ledgerId: ledgers.accountsReceivable!, debit: c.grandTotal, credit: 0, narration: 'Accounts Receivable' })
  if (c.discount > 0) {
    lines.push({ ledgerId: ledgers.discountGiven!, debit: c.discount, credit: 0, narration: 'Discount Given' })
  }
  if (c.exchange > 0) {
    lines.push({ ledgerId: ledgers.usedVehicleInventory!, debit: c.exchange, credit: 0, narration: 'Trade-in vehicle' })
  }

  const totalDebit  = lines.reduce((s, l) => s + Number(l.debit),  0)
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0)

  // ── Invariant 4: DR == CR (belt-and-braces before hitting posting-engine)
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new PostingError(
      `Delivery JE imbalance: DR ${totalDebit.toFixed(2)} ≠ CR ${totalCredit.toFixed(2)}.`,
    )
  }

  return { lines, totalDebit, totalCredit, componentSum }
}

export async function postDeliveryEntry(params: {
  tenantId:      string
  bookingId:     string
  bookingNumber: string
  components:    DeliveryComponents
  locationId?:   string
  createdBy?:    string
}): Promise<PostJournalEntryResult> {
  const { tenantId, bookingId, bookingNumber, components, locationId, createdBy } = params

  const ledgers = await getSystemLedgers(tenantId)
  const built = buildDeliveryEntryLines(ledgers, components)

  return postJournalEntry({
    tenantId,
    entryDate:     new Date(),
    voucherType:   'SALES',
    narration:     `Vehicle sale — booking ${bookingNumber}`,
    reference:     bookingNumber,
    referenceType: 'booking',
    referenceId:   bookingId,
    locationId,
    createdBy,
    lines:         built.lines,
    skipManualEntryCheck: true,
  })
}

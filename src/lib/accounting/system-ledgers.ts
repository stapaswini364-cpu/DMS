import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { coaLedgers } from '@/db/schema'

export interface SystemLedgers {
  cashInHand: string | null        // A0001
  mainBankAccount: string | null   // A0003
  accountsReceivable: string | null // A0004
  usedVehicleInventory: string | null // A0006 — trade-in asset from exchange
  salesVehicles: string | null     // I0001 — legacy, kept for historical postings; new deliveries do NOT post here
  serviceIncome: string | null     // I0002
  // Vehicle-sale revenue components — one credit line per non-zero field
  salesExShowroom: string | null       // I0003
  salesRto: string | null              // I0004
  salesInsurance: string | null        // I0005
  salesExtendedWarranty: string | null // I0006
  salesAmc: string | null              // I0007
  salesHandling: string | null         // I0008
  salesEtc: string | null              // I0009
  salesHp: string | null               // I0010
  salesAccessories: string | null      // I0011 — maps from bookings.addon_price
  discountGiven: string | null         // EX0007 — contra-revenue booked as expense
}

const CODES = [
  'A0001', 'A0003', 'A0004', 'A0006',
  'I0001', 'I0002',
  'I0003', 'I0004', 'I0005', 'I0006', 'I0007', 'I0008', 'I0009', 'I0010', 'I0011',
  'EX0007',
] as const

export async function getSystemLedgers(tenantId: string): Promise<SystemLedgers> {
  const rows = await db
    .select({ id: coaLedgers.id, ledgerCode: coaLedgers.ledgerCode })
    .from(coaLedgers)
    .where(and(
      eq(coaLedgers.tenantId, tenantId),
      eq(coaLedgers.isActive, true),
    ))

  const map: Record<string, string> = {}
  for (const row of rows) {
    if ((CODES as readonly string[]).includes(row.ledgerCode)) map[row.ledgerCode] = row.id
  }

  return {
    cashInHand:            map['A0001'] ?? null,
    mainBankAccount:       map['A0003'] ?? null,
    accountsReceivable:    map['A0004'] ?? null,
    usedVehicleInventory:  map['A0006'] ?? null,
    salesVehicles:         map['I0001'] ?? null,
    serviceIncome:         map['I0002'] ?? null,
    salesExShowroom:       map['I0003'] ?? null,
    salesRto:              map['I0004'] ?? null,
    salesInsurance:        map['I0005'] ?? null,
    salesExtendedWarranty: map['I0006'] ?? null,
    salesAmc:              map['I0007'] ?? null,
    salesHandling:         map['I0008'] ?? null,
    salesEtc:              map['I0009'] ?? null,
    salesHp:               map['I0010'] ?? null,
    salesAccessories:      map['I0011'] ?? null,
    discountGiven:         map['EX0007'] ?? null,
  }
}

// CASH payment mode → Cash in Hand; everything else → Main Bank Account
export function cashLedgerForMode(paymentMode: string, ledgers: SystemLedgers): string | null {
  return paymentMode === 'CASH' ? ledgers.cashInHand : ledgers.mainBankAccount
}

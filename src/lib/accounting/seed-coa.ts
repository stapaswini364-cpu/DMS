/**
 * Default Chart of Accounts seed — single source of truth.
 *
 * Callable from an API route (uses the shared Drizzle DB) or from the CLI
 * script `scripts/seed-coa.ts` (which passes in its own script-scoped DB).
 *
 * Idempotent: if `coa_account_types` already has any row for the tenant,
 * the seed is skipped and `{ seeded: false, alreadySeeded: true }` is returned.
 * The check is not a full-transaction guard — concurrent invocations on the
 * same tenant could still race, so callers must serialise (in practice
 * the flows here — tenant creation, super-admin button — are one-off).
 *
 * Produces: 5 account types, 6 major heads, 10 groups, 13 sub-groups, 27 ledgers.
 */

import { eq } from 'drizzle-orm'
import { db as sharedDb, schema } from '@/db'

// Structural type — accepts both the app's shared `db` (drizzle over
// postgres-js) and the CLI script's script-scoped instance.
type DrizzleLike = typeof sharedDb

export type SeedCoaResult =
  | { seeded: true;  alreadySeeded: false; ledgerCount: 27 }
  | { seeded: false; alreadySeeded: true;  ledgerCount: number }

export async function seedChartOfAccounts(
  tenantId: string,
  database: DrizzleLike = sharedDb,
): Promise<SeedCoaResult> {
  const { coaAccountTypes, coaMajorHeads, coaGroups, coaSubGroups, coaLedgers } = schema

  // ── Idempotency guard ────────────────────────────────────────────────────
  const existingTypes = await database
    .select({ id: coaAccountTypes.id })
    .from(coaAccountTypes)
    .where(eq(coaAccountTypes.tenantId, tenantId))
    .limit(1)

  if (existingTypes.length > 0) {
    const existingLedgers = await database
      .select({ id: coaLedgers.id })
      .from(coaLedgers)
      .where(eq(coaLedgers.tenantId, tenantId))
    return { seeded: false, alreadySeeded: true, ledgerCount: existingLedgers.length }
  }

  const tid = tenantId

  // ── Account Types ────────────────────────────────────────────────────────
  const [assets] = await database.insert(coaAccountTypes).values({
    tenantId: tid, name: 'Assets', code: 'A',
    normalBalance: 'debit', description: 'Economic resources owned by the dealership',
  }).returning()
  const [liabilities] = await database.insert(coaAccountTypes).values({
    tenantId: tid, name: 'Liabilities', code: 'L',
    normalBalance: 'credit', description: 'Obligations owed to outside parties',
  }).returning()
  const [equity] = await database.insert(coaAccountTypes).values({
    tenantId: tid, name: 'Equity', code: 'EQ',
    normalBalance: 'credit', description: "Owner's residual interest in assets",
  }).returning()
  const [income] = await database.insert(coaAccountTypes).values({
    tenantId: tid, name: 'Income', code: 'I',
    normalBalance: 'credit', description: 'Revenue earned from business operations',
  }).returning()
  const [expense] = await database.insert(coaAccountTypes).values({
    tenantId: tid, name: 'Expense', code: 'EX',
    normalBalance: 'debit', description: 'Costs incurred in running the business',
  }).returning()

  // ── Major Heads ──────────────────────────────────────────────────────────
  const [currentAssets] = await database.insert(coaMajorHeads).values({
    tenantId: tid, accountTypeId: assets.id, name: 'Current Assets', code: 'A-CA',
    statutoryHead: 'current_assets',
  }).returning()
  const [currentLiabilities] = await database.insert(coaMajorHeads).values({
    tenantId: tid, accountTypeId: liabilities.id, name: 'Current Liabilities', code: 'L-CL',
    statutoryHead: 'current_liabilities',
  }).returning()
  const [ownersEquity] = await database.insert(coaMajorHeads).values({
    tenantId: tid, accountTypeId: equity.id, name: "Owner's Equity", code: 'EQ-OE',
    statutoryHead: 'shareholders_funds',
  }).returning()
  const [revenue] = await database.insert(coaMajorHeads).values({
    tenantId: tid, accountTypeId: income.id, name: 'Revenue', code: 'I-REV',
  }).returning()
  const [operatingExpenses] = await database.insert(coaMajorHeads).values({
    tenantId: tid, accountTypeId: expense.id, name: 'Operating Expenses', code: 'EX-OP',
  }).returning()
  const [others] = await database.insert(coaMajorHeads).values({
    tenantId: tid, accountTypeId: expense.id, name: 'Others', code: 'EX-OTH',
  }).returning()

  // ── Groups ───────────────────────────────────────────────────────────────
  const [cashAndBank] = await database.insert(coaGroups).values({
    tenantId: tid, majorHeadId: currentAssets.id, name: 'Cash & Bank', code: 'A-CA-CB',
  }).returning()
  const [tradeReceivables] = await database.insert(coaGroups).values({
    tenantId: tid, majorHeadId: currentAssets.id, name: 'Trade Receivables', code: 'A-CA-TR',
  }).returning()
  const [inventory] = await database.insert(coaGroups).values({
    tenantId: tid, majorHeadId: currentAssets.id, name: 'Inventory', code: 'A-CA-INV',
  }).returning()
  const [tradePayables] = await database.insert(coaGroups).values({
    tenantId: tid, majorHeadId: currentLiabilities.id, name: 'Trade Payables', code: 'L-CL-TP',
  }).returning()
  const [dutiesAndTaxes] = await database.insert(coaGroups).values({
    tenantId: tid, majorHeadId: currentLiabilities.id, name: 'Duties & Taxes', code: 'L-CL-DT',
  }).returning()
  const [capital] = await database.insert(coaGroups).values({
    tenantId: tid, majorHeadId: ownersEquity.id, name: 'Capital', code: 'EQ-OE-CAP',
  }).returning()
  const [retainedEarnings] = await database.insert(coaGroups).values({
    tenantId: tid, majorHeadId: ownersEquity.id, name: 'Retained Earnings', code: 'EQ-OE-RE',
  }).returning()
  const [operatingRevenue] = await database.insert(coaGroups).values({
    tenantId: tid, majorHeadId: revenue.id, name: 'Operating Revenue', code: 'I-REV-OR',
  }).returning()
  const [administration] = await database.insert(coaGroups).values({
    tenantId: tid, majorHeadId: operatingExpenses.id, name: 'Administration', code: 'EX-OP-ADM',
  }).returning()
  const [marketing] = await database.insert(coaGroups).values({
    tenantId: tid, majorHeadId: operatingExpenses.id, name: 'Marketing', code: 'EX-OP-MKT',
  }).returning()
  const [vehicleOperations] = await database.insert(coaGroups).values({
    tenantId: tid, majorHeadId: operatingExpenses.id, name: 'Vehicle Operations', code: 'EX-OP-VO',
  }).returning()
  const [discountAllowed] = await database.insert(coaGroups).values({
    tenantId: tid, majorHeadId: others.id, name: 'Discount Allowed', code: 'EX-OTH-DA',
  }).returning()

  // ── Sub Groups ───────────────────────────────────────────────────────────
  const [cash] = await database.insert(coaSubGroups).values({
    tenantId: tid, groupId: cashAndBank.id, name: 'Cash', code: 'A-CA-CB-C',
  }).returning()
  const [bank] = await database.insert(coaSubGroups).values({
    tenantId: tid, groupId: cashAndBank.id, name: 'Bank', code: 'A-CA-CB-B',
  }).returning()
  const [accountsReceivableSG] = await database.insert(coaSubGroups).values({
    tenantId: tid, groupId: tradeReceivables.id, name: 'Accounts Receivable', code: 'A-CA-TR-AR',
  }).returning()
  const [vehicleInventorySG] = await database.insert(coaSubGroups).values({
    tenantId: tid, groupId: inventory.id, name: 'Vehicle Inventory', code: 'A-CA-INV-VI',
  }).returning()
  const [accountsPayableSG] = await database.insert(coaSubGroups).values({
    tenantId: tid, groupId: tradePayables.id, name: 'Accounts Payable', code: 'L-CL-TP-AP',
  }).returning()
  const [gstSG] = await database.insert(coaSubGroups).values({
    tenantId: tid, groupId: dutiesAndTaxes.id, name: 'GST', code: 'L-CL-DT-GST',
  }).returning()
  const [ownerCapitalSG] = await database.insert(coaSubGroups).values({
    tenantId: tid, groupId: capital.id, name: "Owner's Capital", code: 'EQ-OE-CAP-OC',
  }).returning()
  const [retainedEarningsSG] = await database.insert(coaSubGroups).values({
    tenantId: tid, groupId: retainedEarnings.id, name: 'Retained Earnings', code: 'EQ-OE-RE-RE',
  }).returning()
  const [salesSG] = await database.insert(coaSubGroups).values({
    tenantId: tid, groupId: operatingRevenue.id, name: 'Sales', code: 'I-REV-OR-SAL',
  }).returning()
  const [serviceIncomeSG] = await database.insert(coaSubGroups).values({
    tenantId: tid, groupId: operatingRevenue.id, name: 'Service Income', code: 'I-REV-OR-SVC',
  }).returning()
  const [rentAndUtilities] = await database.insert(coaSubGroups).values({
    tenantId: tid, groupId: administration.id, name: 'Rent & Utilities', code: 'EX-OP-ADM-RU',
  }).returning()
  const [staffCosts] = await database.insert(coaSubGroups).values({
    tenantId: tid, groupId: administration.id, name: 'Staff Costs', code: 'EX-OP-ADM-SC',
  }).returning()
  const [officeExpenses] = await database.insert(coaSubGroups).values({
    tenantId: tid, groupId: administration.id, name: 'Office Expenses', code: 'EX-OP-ADM-OE',
  }).returning()
  const [marketingExpenses] = await database.insert(coaSubGroups).values({
    tenantId: tid, groupId: marketing.id, name: 'Marketing Expenses', code: 'EX-OP-MKT-ME',
  }).returning()
  const [fuelAndTravel] = await database.insert(coaSubGroups).values({
    tenantId: tid, groupId: vehicleOperations.id, name: 'Fuel & Travel', code: 'EX-OP-VO-FT',
  }).returning()
  const [discountSG] = await database.insert(coaSubGroups).values({
    tenantId: tid, groupId: discountAllowed.id, name: 'Discount', code: 'EX-OTH-DA-DISC',
  }).returning()

  // ── Ledgers ──────────────────────────────────────────────────────────────
  await database.insert(coaLedgers).values([
    // Assets - Cash
    { tenantId: tid, subGroupId: cash.id,                 ledgerCode: 'A0001',  ledgerName: 'Cash in Hand',        balanceType: 'debit'  },
    { tenantId: tid, subGroupId: cash.id,                 ledgerCode: 'A0002',  ledgerName: 'Petty Cash',          balanceType: 'debit'  },
    // Assets - Bank
    { tenantId: tid, subGroupId: bank.id,                 ledgerCode: 'A0003',  ledgerName: 'Main Bank Account',   balanceType: 'debit'  },
    // Assets - Trade Receivables
    { tenantId: tid, subGroupId: accountsReceivableSG.id, ledgerCode: 'A0004',  ledgerName: 'Accounts Receivable', balanceType: 'debit'  },
    // Assets - Inventory
    { tenantId: tid, subGroupId: vehicleInventorySG.id,   ledgerCode: 'A0005',  ledgerName: 'Vehicle Stock',           balanceType: 'debit'  },
    { tenantId: tid, subGroupId: vehicleInventorySG.id,   ledgerCode: 'A0006',  ledgerName: 'Used Vehicle Inventory',  balanceType: 'debit'  },
    // Liabilities
    { tenantId: tid, subGroupId: accountsPayableSG.id,    ledgerCode: 'L0001',  ledgerName: 'Accounts Payable',    balanceType: 'credit' },
    { tenantId: tid, subGroupId: gstSG.id,                ledgerCode: 'L0002',  ledgerName: 'GST Payable',         balanceType: 'credit', gstApplicable: true },
    // Equity
    { tenantId: tid, subGroupId: ownerCapitalSG.id,       ledgerCode: 'EQ0001', ledgerName: 'Capital',             balanceType: 'credit', allowManualEntry: false },
    { tenantId: tid, subGroupId: retainedEarningsSG.id,   ledgerCode: 'EQ0002', ledgerName: 'Retained Earnings',   balanceType: 'credit', allowManualEntry: false },
    // Income
    { tenantId: tid, subGroupId: salesSG.id,              ledgerCode: 'I0001',  ledgerName: 'Sales - Vehicles',        balanceType: 'credit' },
    { tenantId: tid, subGroupId: serviceIncomeSG.id,      ledgerCode: 'I0002',  ledgerName: 'Service Income',          balanceType: 'credit' },
    // Income - Vehicle sale components (posted by postDeliveryEntry)
    { tenantId: tid, subGroupId: salesSG.id,              ledgerCode: 'I0003',  ledgerName: 'Sales - Ex-Showroom',       balanceType: 'credit' },
    { tenantId: tid, subGroupId: salesSG.id,              ledgerCode: 'I0004',  ledgerName: 'Sales - RTO',               balanceType: 'credit' },
    { tenantId: tid, subGroupId: salesSG.id,              ledgerCode: 'I0005',  ledgerName: 'Sales - Insurance',         balanceType: 'credit' },
    { tenantId: tid, subGroupId: salesSG.id,              ledgerCode: 'I0006',  ledgerName: 'Sales - Extended Warranty', balanceType: 'credit' },
    { tenantId: tid, subGroupId: salesSG.id,              ledgerCode: 'I0007',  ledgerName: 'Sales - AMC',               balanceType: 'credit' },
    { tenantId: tid, subGroupId: salesSG.id,              ledgerCode: 'I0008',  ledgerName: 'Sales - Handling Charges',  balanceType: 'credit' },
    { tenantId: tid, subGroupId: salesSG.id,              ledgerCode: 'I0009',  ledgerName: 'Sales - ETC Charges',       balanceType: 'credit' },
    { tenantId: tid, subGroupId: salesSG.id,              ledgerCode: 'I0010',  ledgerName: 'Sales - HP/Hypothecation',  balanceType: 'credit' },
    { tenantId: tid, subGroupId: salesSG.id,              ledgerCode: 'I0011',  ledgerName: 'Sales - Accessories',       balanceType: 'credit' },
    // Expenses
    { tenantId: tid, subGroupId: rentAndUtilities.id,     ledgerCode: 'EX0001', ledgerName: 'Rent',                balanceType: 'debit'  },
    { tenantId: tid, subGroupId: rentAndUtilities.id,     ledgerCode: 'EX0002', ledgerName: 'Electricity',         balanceType: 'debit'  },
    { tenantId: tid, subGroupId: staffCosts.id,           ledgerCode: 'EX0003', ledgerName: 'Salary',              balanceType: 'debit'  },
    { tenantId: tid, subGroupId: officeExpenses.id,       ledgerCode: 'EX0004', ledgerName: 'Office Expense',      balanceType: 'debit'  },
    { tenantId: tid, subGroupId: marketingExpenses.id,    ledgerCode: 'EX0005', ledgerName: 'Marketing',           balanceType: 'debit'  },
    { tenantId: tid, subGroupId: fuelAndTravel.id,        ledgerCode: 'EX0006', ledgerName: 'Fuel',                    balanceType: 'debit'  },
    // Expenses - Others (contra-revenue for vehicle-sale discounts)
    { tenantId: tid, subGroupId: discountSG.id,           ledgerCode: 'EX0007', ledgerName: 'Discount Given',          balanceType: 'debit'  },
  ])

  return { seeded: true, alreadySeeded: false, ledgerCount: 27 }
}

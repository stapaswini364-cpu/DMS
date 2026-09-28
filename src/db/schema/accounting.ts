import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { tenants, locations, users } from './auth'


// ─── COA Hierarchy Enums ──────────────────────────────────────────────────────

export const balanceTypeEnum = pgEnum('balance_type', ['debit', 'credit'])

export const accountTypeEnum = pgEnum('account_type', [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'INCOME',
  'EXPENSE',
])

export const voucherTypeEnum = pgEnum('voucher_type', [
  'RECEIPT',
  'PAYMENT',
  'CONTRA',
  'JOURNAL',
  'SALES',
  'PURCHASE',
  'DEBIT_NOTE',
  'CREDIT_NOTE',
])

export const partyTypeEnum = pgEnum('party_type', ['CUSTOMER', 'VENDOR'])

export const statutoryHeadEnum = pgEnum('statutory_head', [
  'shareholders_funds',
  'non_current_liabilities',
  'current_liabilities',
  'non_current_assets',
  'current_assets',
])

export const chartOfAccounts = pgTable(
  'chart_of_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    accountCode: text('account_code').notNull(),
    accountName: text('account_name').notNull(),
    accountType: accountTypeEnum('account_type').notNull(),
    // Self-referential for parent hierarchy
    parentId: uuid('parent_id'),
    majorHead: text('major_head'),
    subHead: text('sub_head'),
    // System accounts cannot be deleted or renamed
    isSystem: boolean('is_system').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    index('coa_tenant_idx').on(table.tenantId),
    index('coa_account_type_idx').on(table.accountType),
    index('coa_parent_idx').on(table.parentId),
    uniqueIndex('coa_account_code_idx').on(table.tenantId, table.accountCode),
  ],
)

export const bankAccounts = pgTable(
  'bank_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    bankName: text('bank_name').notNull(),
    accountNumber: text('account_number').notNull(),
    ifscCode: text('ifsc_code').notNull(),
    currentBalance: numeric('current_balance', { precision: 15, scale: 2 }).notNull().default('0'),
    locationId: uuid('location_id').references(() => locations.id, { onDelete: 'set null' }),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    index('bank_accounts_tenant_idx').on(table.tenantId),
    index('bank_accounts_location_idx').on(table.locationId),
    uniqueIndex('bank_accounts_number_idx').on(table.tenantId, table.accountNumber),
  ],
)

export const vouchers = pgTable(
  'vouchers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    voucherNumber: text('voucher_number').notNull(),
    voucherType: voucherTypeEnum('voucher_type').notNull(),
    date: timestamp('date', { withTimezone: true }).notNull(),
    // Polymorphic party — use party_type to know which table to join
    partyId: uuid('party_id'),
    partyType: partyTypeEnum('party_type'),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    narration: text('narration'),
    reference: text('reference'),
    locationId: uuid('location_id').references(() => locations.id),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('vouchers_tenant_idx').on(table.tenantId),
    index('vouchers_type_idx').on(table.voucherType),
    index('vouchers_date_idx').on(table.date),
    index('vouchers_party_idx').on(table.partyId),
    index('vouchers_location_idx').on(table.locationId),
    uniqueIndex('vouchers_number_idx').on(table.tenantId, table.voucherNumber),
  ],
)

export const voucherEntries = pgTable(
  'voucher_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    voucherId: uuid('voucher_id')
      .notNull()
      .references(() => vouchers.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => chartOfAccounts.id),
    debitAmount: numeric('debit_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    creditAmount: numeric('credit_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    narration: text('narration'),
  },
  (table) => [
    index('voucher_entries_tenant_idx').on(table.tenantId),
    index('voucher_entries_voucher_idx').on(table.voucherId),
    index('voucher_entries_account_idx').on(table.accountId),
  ],
)

export type ChartOfAccount = typeof chartOfAccounts.$inferSelect
export type NewChartOfAccount = typeof chartOfAccounts.$inferInsert
export type BankAccount = typeof bankAccounts.$inferSelect
export type NewBankAccount = typeof bankAccounts.$inferInsert
export type Voucher = typeof vouchers.$inferSelect
export type NewVoucher = typeof vouchers.$inferInsert
export type VoucherEntry = typeof voucherEntries.$inferSelect
export type NewVoucherEntry = typeof voucherEntries.$inferInsert

// ─── COA Hierarchy Tables ────────────────────────────────────────────────────

export const coaAccountTypes = pgTable(
  'coa_account_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    normalBalance: balanceTypeEnum('normal_balance').notNull(),
    description: text('description'),
  },
  (table) => [
    index('coa_account_types_tenant_idx').on(table.tenantId),
    uniqueIndex('coa_account_types_code_idx').on(table.tenantId, table.code),
  ],
)

export const coaMajorHeads = pgTable(
  'coa_major_heads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    accountTypeId: uuid('account_type_id')
      .notNull()
      .references(() => coaAccountTypes.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    // Nullable — only Assets/Liabilities/Equity major heads carry a statutory
    // section. Income/Expense stay NULL. Rows without a value render under
    // "Unclassified" so nothing silently disappears from the Balance Sheet.
    statutoryHead: statutoryHeadEnum('statutory_head'),
  },
  (table) => [
    index('coa_major_heads_tenant_idx').on(table.tenantId),
    index('coa_major_heads_type_idx').on(table.accountTypeId),
    uniqueIndex('coa_major_heads_code_idx').on(table.tenantId, table.code),
  ],
)

export const coaGroups = pgTable(
  'coa_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    majorHeadId: uuid('major_head_id')
      .notNull()
      .references(() => coaMajorHeads.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code').notNull(),
  },
  (table) => [
    index('coa_groups_tenant_idx').on(table.tenantId),
    index('coa_groups_major_head_idx').on(table.majorHeadId),
    uniqueIndex('coa_groups_code_idx').on(table.tenantId, table.code),
  ],
)

export const coaSubGroups = pgTable(
  'coa_sub_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => coaGroups.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code').notNull(),
  },
  (table) => [
    index('coa_sub_groups_tenant_idx').on(table.tenantId),
    index('coa_sub_groups_group_idx').on(table.groupId),
    uniqueIndex('coa_sub_groups_code_idx').on(table.tenantId, table.code),
  ],
)

export const coaLedgers = pgTable(
  'coa_ledgers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    subGroupId: uuid('sub_group_id')
      .notNull()
      .references(() => coaSubGroups.id, { onDelete: 'cascade' }),
    ledgerCode: text('ledger_code').notNull(),
    ledgerName: text('ledger_name').notNull(),
    openingBalance: numeric('opening_balance', { precision: 15, scale: 2 }).notNull().default('0'),
    // running_balance tracks cumulative net movement in the normal direction of this ledger.
    // debit-normal ledgers: runningBalance += debit - credit
    // credit-normal ledgers: runningBalance += credit - debit
    // Updated atomically inside every postJournalEntry() transaction.
    runningBalance: numeric('running_balance', { precision: 15, scale: 2 }).notNull().default('0'),
    balanceType: balanceTypeEnum('balance_type').notNull().default('debit'),
    isActive: boolean('is_active').notNull().default(true),
    allowManualEntry: boolean('allow_manual_entry').notNull().default(true),
    gstApplicable: boolean('gst_applicable').notNull().default(false),
    tdsApplicable: boolean('tds_applicable').notNull().default(false),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('coa_ledgers_tenant_idx').on(table.tenantId),
    index('coa_ledgers_sub_group_idx').on(table.subGroupId),
    uniqueIndex('coa_ledgers_code_idx').on(table.tenantId, table.ledgerCode),
  ],
)

export type CoaAccountType = typeof coaAccountTypes.$inferSelect
export type NewCoaAccountType = typeof coaAccountTypes.$inferInsert
export type CoaMajorHead = typeof coaMajorHeads.$inferSelect
export type NewCoaMajorHead = typeof coaMajorHeads.$inferInsert
export type CoaGroup = typeof coaGroups.$inferSelect
export type NewCoaGroup = typeof coaGroups.$inferInsert
export type CoaSubGroup = typeof coaSubGroups.$inferSelect
export type NewCoaSubGroup = typeof coaSubGroups.$inferInsert
export type CoaLedger = typeof coaLedgers.$inferSelect
export type NewCoaLedger = typeof coaLedgers.$inferInsert

// ─── Journal Entry Tables ────────────────────────────────────────────────────

export const jeVoucherTypeEnum = pgEnum('je_voucher_type', [
  'RECEIPT',
  'PAYMENT',
  'SALES',
  'PURCHASE',
  'CONTRA',
  'JOURNAL',
  'MANUAL',
])

export const journalEntries = pgTable(
  'journal_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    entryDate: timestamp('entry_date', { withTimezone: true }).notNull(),
    voucherNo: text('voucher_no').notNull(),
    voucherType: jeVoucherTypeEnum('voucher_type').notNull(),
    narration: text('narration'),
    reference: text('reference'),
    referenceType: text('reference_type'),
    referenceId: uuid('reference_id'),
    locationId: uuid('location_id').references(() => locations.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('je_tenant_idx').on(table.tenantId),
    index('je_entry_date_idx').on(table.entryDate),
    index('je_reference_idx').on(table.referenceId),
    index('je_location_idx').on(table.locationId),
    uniqueIndex('je_voucher_no_idx').on(table.tenantId, table.voucherNo),
  ],
)

export const journalEntryLines = pgTable(
  'journal_entry_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    journalEntryId: uuid('journal_entry_id')
      .notNull()
      .references(() => journalEntries.id, { onDelete: 'cascade' }),
    ledgerId: uuid('ledger_id')
      .notNull()
      .references(() => coaLedgers.id),
    debitAmount: numeric('debit_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    creditAmount: numeric('credit_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    lineNarration: text('line_narration'),
  },
  (table) => [
    index('jel_tenant_idx').on(table.tenantId),
    index('jel_entry_idx').on(table.journalEntryId),
    index('jel_ledger_idx').on(table.ledgerId),
  ],
)

export type JournalEntry = typeof journalEntries.$inferSelect
export type NewJournalEntry = typeof journalEntries.$inferInsert
export type JournalEntryLine = typeof journalEntryLines.$inferSelect
export type NewJournalEntryLine = typeof journalEntryLines.$inferInsert

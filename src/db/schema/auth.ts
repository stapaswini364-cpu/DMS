import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
  integer,
  date,
} from 'drizzle-orm/pg-core'

export const planEnum = pgEnum('plan', ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'])
export const tenantStatusEnum = pgEnum('tenant_status', ['ACTIVE', 'SUSPENDED', 'TRIAL'])
export const locationTypeEnum = pgEnum('location_type', ['HO', 'BRANCH'])
export const branchTypeEnum   = pgEnum('branch_type',   ['BRANCH', 'SHOWROOM', 'WORKSHOP', 'WAREHOUSE'])
export const userRoleEnum = pgEnum('user_role', [
  'SUPER_ADMIN',
  'ADMIN',
  'SUB_ADMIN',
  'SALES',
  'ACCOUNTS',
  'SERVICES',
  'BILLING',
  'AUDITOR',
])

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  clerkOrgId: text('clerk_org_id').notNull().unique(),
  plan: planEnum('plan').notNull().default('STARTER'),
  status: tenantStatusEnum('status').notNull().default('TRIAL'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const locations = pgTable(
  'locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name:           text('name').notNull(),
    type:           locationTypeEnum('type').notNull(),
    branchType:     branchTypeEnum('branch_type'),
    inchargeName:   text('incharge_name'),
    phone:          text('phone'),
    email:          text('email'),
    address:        text('address').notNull(),
    city:           text('city').notNull(),
    state:          text('state').notNull(),
    pincode:        text('pincode'),
    bankName:       text('bank_name'),
    accountNumber:  text('account_number'),
    ifscCode:       text('ifsc_code'),
    accountType:    text('account_type'),
    bankBranchName: text('bank_branch_name'),
    isActive:       boolean('is_active').notNull().default(true),
  },
  (table) => [index('locations_tenant_idx').on(table.tenantId)],
)

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    clerkUserId: text('clerk_user_id').notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    role: userRoleEnum('role').notNull(),
    locationId: uuid('location_id').references(() => locations.id, { onDelete: 'set null' }),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    index('users_tenant_idx').on(table.tenantId),
    uniqueIndex('users_clerk_user_idx').on(table.clerkUserId),
    index('users_location_idx').on(table.locationId),
  ],
)

export const companySettings = pgTable('company_settings', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  tenantId:           uuid('tenant_id').notNull().unique().references(() => tenants.id, { onDelete: 'cascade' }),
  companyName:        text('company_name'),
  companyCategory:    text('company_category'),
  email:              text('email'),
  phone:              text('phone'),
  website:            text('website'),
  address:            text('address'),
  state:              text('state'),
  country:            text('country').default('India'),
  pincode:            text('pincode'),
  mailingName:        text('mailing_name'),
  fyStartMonth:       integer('fy_start_month').notNull().default(4),
  fyStartDay:         integer('fy_start_day').notNull().default(1),
  booksBeginningFrom: date('books_beginning_from'),
  gstin:              text('gstin'),
  pan:                text('pan'),
  msme:               text('msme'),
  tan:                text('tan'),
  cin:                text('cin'),
  bankName:           text('bank_name'),
  accountNumber:      text('account_number'),
  ifscCode:           text('ifsc_code'),
  accountType:        text('account_type'),
  currencySymbol:     text('currency_symbol').default('₹'),
  currencyFormalName: text('currency_formal_name').default('INR - Indian Rupee'),
  logoUrl:            text('logo_url'),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Tenant = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert
export type Location = typeof locations.$inferSelect
export type NewLocation = typeof locations.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type CompanySettings = typeof companySettings.$inferSelect
export type NewCompanySettings = typeof companySettings.$inferInsert

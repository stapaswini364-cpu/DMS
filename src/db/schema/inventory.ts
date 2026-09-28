import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  timestamp,
  date,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { tenants, locations } from './auth'

export const fuelTypeEnum = pgEnum('fuel_type', [
  'PETROL',
  'DIESEL',
  'ELECTRIC',
  'CNG',
  'HYBRID',
])

export const vehicleStatusEnum = pgEnum('vehicle_status', [
  'AVAILABLE',
  'BOOKED',
  'SOLD',
  'IN_TRANSIT',
])

export const productModels = pgTable(
  'product_models',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    brand: text('brand').notNull(),
    fuelType: fuelTypeEnum('fuel_type').notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [index('product_models_tenant_idx').on(table.tenantId)],
)

export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    modelId: uuid('model_id')
      .notNull()
      .references(() => productModels.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    exShowroomPrice: numeric('ex_showroom_price', { precision: 12, scale: 2 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    index('product_variants_tenant_idx').on(table.tenantId),
    index('product_variants_model_idx').on(table.modelId),
  ],
)

export const productColors = pgTable(
  'product_colors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    colorName: text('color_name').notNull(),
    colorCode: text('color_code'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    index('product_colors_tenant_idx').on(table.tenantId),
    index('product_colors_variant_idx').on(table.variantId),
  ],
)

export const customerTypeEnum = pgEnum('customer_type', [
  'INDIVIDUAL', 'PROPRIETORSHIP', 'PARTNERSHIP', 'LLP',
  'COMPANY', 'TRUST', 'GOVT', 'OTHER',
])

export const customerCategoryEnum = pgEnum('customer_category', [
  'CUSTOMER', 'DEALER', 'INSURANCE', 'FINANCER', 'OTHER',
])

export const customers = pgTable(
  'customers',
  {
    id:                    uuid('id').primaryKey().defaultRandom(),
    tenantId:              uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    customerCode:          text('customer_code').notNull(),
    customerType:          customerTypeEnum('customer_type'),
    customerCategory:      customerCategoryEnum('customer_category'),
    name:                  text('name').notNull(),
    tradeName:             text('trade_name'),
    contactPerson:         text('contact_person'),
    phone:                 text('phone').notNull(),
    email:                 text('email'),
    website:               text('website'),
    aadhar:                text('aadhar'),
    pan:                   text('pan'),
    gstin:                 text('gstin'),
    msmeStatus:            text('msme_status'),
    udyamNo:               text('udyam_no'),
    address:               text('address'),
    addressLine2:          text('address_line2'),
    city:                  text('city'),
    state:                 text('state'),
    pincode:               text('pincode'),
    country:               text('country').default('India'),
    stateCode:             text('state_code'),
    bankName:              text('bank_name'),
    bankAccountName:       text('bank_account_name'),
    accountNumber:         text('account_number'),
    ifscCode:              text('ifsc_code'),
    bankBranch:            text('bank_branch'),
    openingBalance:        numeric('opening_balance', { precision: 12, scale: 2 }),
    openingBalanceType:    text('opening_balance_type'),
    openingBalanceRemarks: text('opening_balance_remarks'),
    createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('customers_tenant_idx').on(table.tenantId),
    index('customers_phone_idx').on(table.phone),
    index('customers_tenant_phone_idx').on(table.tenantId, table.phone),
    uniqueIndex('customers_code_tenant_idx').on(table.tenantId, table.customerCode),
  ],
)

export const financers = pgTable(
  'financers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    contactPerson: text('contact_person'),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [index('financers_tenant_idx').on(table.tenantId)],
)

export const vehicleInventory = pgTable(
  'vehicle_inventory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id),
    colorId: uuid('color_id')
      .notNull()
      .references(() => productColors.id),
    frameNumber:          text('frame_number').notNull(),
    engineNumber:         text('engine_number').notNull(),
    status:               vehicleStatusEnum('status').notNull().default('AVAILABLE'),
    locationId:           uuid('location_id').notNull().references(() => locations.id),
    purchaseDate:         date('purchase_date'),
    expectedDeliveryDate: date('expected_delivery_date'),
  },
  (table) => [
    index('vehicle_inventory_tenant_idx').on(table.tenantId),
    index('vehicle_inventory_variant_idx').on(table.variantId),
    index('vehicle_inventory_status_idx').on(table.status),
    index('vehicle_inventory_location_idx').on(table.locationId),
    uniqueIndex('vehicle_inventory_frame_number_idx').on(table.tenantId, table.frameNumber),
    uniqueIndex('vehicle_inventory_engine_number_idx').on(table.tenantId, table.engineNumber),
  ],
)

export type ProductModel = typeof productModels.$inferSelect
export type NewProductModel = typeof productModels.$inferInsert
export type ProductVariant = typeof productVariants.$inferSelect
export type NewProductVariant = typeof productVariants.$inferInsert
export type ProductColor = typeof productColors.$inferSelect
export type NewProductColor = typeof productColors.$inferInsert
export const vendorTypeEnum = pgEnum('vendor_type', [
  'INDIVIDUAL', 'PROPRIETORSHIP', 'PARTNERSHIP', 'LLP',
  'COMPANY', 'TRUST', 'GOVT', 'OTHER',
])

export const vendorCategoryEnum = pgEnum('vendor_category', [
  'VEHICLE', 'PARTS', 'SERVICES', 'CAPITAL_GOODS',
  'TRANSPORT', 'PROFESSIONAL', 'UTILITY', 'OTHER',
])

export const vendors = pgTable(
  'vendors',
  {
    id:                     uuid('id').primaryKey().defaultRandom(),
    tenantId:               uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    vendorCode:             text('vendor_code').notNull(),
    vendorType:             vendorTypeEnum('vendor_type').notNull(),
    vendorCategory:         vendorCategoryEnum('vendor_category').notNull(),
    name:                   text('name').notNull(),
    tradeName:              text('trade_name'),
    contactPerson:          text('contact_person'),
    phone:                  text('phone').notNull(),
    email:                  text('email'),
    website:                text('website'),
    pan:                    text('pan'),
    gstin:                  text('gstin'),
    msmeStatus:             text('msme_status'),
    udyamNo:                text('udyam_no'),
    addressLine1:           text('address_line1').notNull(),
    addressLine2:           text('address_line2'),
    city:                   text('city').notNull(),
    state:                  text('state').notNull(),
    pincode:                text('pincode').notNull(),
    country:                text('country').notNull().default('India'),
    bankName:               text('bank_name'),
    bankAccountName:        text('bank_account_name'),
    accountNumber:          text('account_number'),
    ifscCode:               text('ifsc_code'),
    bankBranch:             text('bank_branch'),
    openingBalance:         numeric('opening_balance', { precision: 12, scale: 2 }),
    openingBalanceType:     text('opening_balance_type'),
    openingBalanceRemarks:  text('opening_balance_remarks'),
    createdAt:              timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('vendors_tenant_idx').on(table.tenantId),
    index('vendors_phone_idx').on(table.phone),
    uniqueIndex('vendors_code_tenant_idx').on(table.tenantId, table.vendorCode),
  ],
)

export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert
export type Financer = typeof financers.$inferSelect
export type NewFinancer = typeof financers.$inferInsert
export type VehicleInventory = typeof vehicleInventory.$inferSelect
export type NewVehicleInventory = typeof vehicleInventory.$inferInsert
export type Vendor = typeof vendors.$inferSelect
export type NewVendor = typeof vendors.$inferInsert

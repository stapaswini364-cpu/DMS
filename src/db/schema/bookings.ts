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
  jsonb,
} from 'drizzle-orm/pg-core'
import { tenants, locations, users } from './auth'
import { customers, financers, vehicleInventory } from './inventory'

export const salesTypeEnum = pgEnum('sales_type', ['CASH', 'FINANCE'])
export const bookingStatusEnum = pgEnum('booking_status', [
  'DRAFT',
  'CONFIRMED',
  'PAID',
  'DELIVERED',
  'CANCELLED',
])
export const discountTypeEnum = pgEnum('discount_type', ['FLAT', 'PERCENTAGE'])
export const financeTypeEnum = pgEnum('finance_type', ['BANK', 'NBFC', 'DSA', 'OTHER'])
export const referredByTypeEnum = pgEnum('referred_by_type', [
  'EMPLOYEE',
  'CUSTOMER',
  'DEALER',
  'OTHER',
])
export const paymentModeEnum = pgEnum('payment_mode', [
  'CASH',
  'UPI',
  'BANK_TRANSFER',
  'DD',
  'CHEQUE',
  'NEFT',
  'RTGS',
])

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    bookingNumber: text('booking_number').notNull(),
    mrnNumber: text('mrn_number'),

    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    vehicleId: uuid('vehicle_id').references(() => vehicleInventory.id),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),

    // Pricing
    exShowroomPrice: numeric('ex_showroom_price', { precision: 12, scale: 2 }).notNull(),
    rtoAmount: numeric('rto_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    insuranceAmount: numeric('insurance_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    onRoadPrice: numeric('on_road_price', { precision: 12, scale: 2 }).notNull(),

    // Add-ons
    addonPrice: numeric('addon_price', { precision: 12, scale: 2 }).notNull().default('0'),
    accessories: jsonb('accessories').$type<Array<{ name: string; amount: number }>>(),
    extendedWarranty: numeric('extended_warranty', { precision: 12, scale: 2 }).notNull().default('0'),
    amc: numeric('amc', { precision: 12, scale: 2 }).notNull().default('0'),
    handlingCharges: numeric('handling_charges', { precision: 12, scale: 2 }).notNull().default('0'),
    etcCharges: numeric('etc_charges', { precision: 12, scale: 2 }).notNull().default('0'),
    subTotal: numeric('sub_total', { precision: 12, scale: 2 }).notNull(),

    // Discount
    discountEnabled: boolean('discount_enabled').notNull().default(false),
    discountCategory: text('discount_category'),
    discountType: discountTypeEnum('discount_type'),
    discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    discountApprovedBy: uuid('discount_approved_by').references(() => users.id),
    discountRemarks: text('discount_remarks'),

    // Exchange
    exchangeEnabled: boolean('exchange_enabled').notNull().default(false),
    exchangeBrand: text('exchange_brand'),
    exchangeVehicleNumber: text('exchange_vehicle_number'),
    exchangeValue: numeric('exchange_value', { precision: 12, scale: 2 }).notNull().default('0'),

    // Grand Total
    grandTotal: numeric('grand_total', { precision: 12, scale: 2 }).notNull(),

    // Sales Type
    salesType: salesTypeEnum('sales_type').notNull().default('CASH'),

    // Finance Details
    financeType: financeTypeEnum('finance_type'),
    financerId: uuid('financer_id').references(() => financers.id),
    financePersonName: text('finance_person_name'),
    financePersonPhone: text('finance_person_phone'),
    financeAmount: numeric('finance_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    deliveryOrderNumber: text('delivery_order_number'),

    // Booking Advance
    bookingAmount: numeric('booking_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    pendingAmount: numeric('pending_amount', { precision: 12, scale: 2 }).notNull().default('0'),

    // Hypothecation
    
    hpEnabled: boolean('hp_enabled').notNull().default(false),
    hpAmount: numeric('hp_amount', { precision: 12, scale: 2 }).notNull().default('0'),

    // Referral
    referredByType: referredByTypeEnum('referred_by_type'),
    referredByEmployeeId: uuid('referred_by_employee_id').references(() => users.id),
    ownerName: text('owner_name'),
    remarks: text('remarks'),

    // Status
    status: bookingStatusEnum('status').notNull().default('DRAFT'),

    // Meta
    bookingDate: timestamp('booking_date', { withTimezone: true }).notNull().defaultNow(),
    salesExecutiveId: uuid('sales_executive_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('bookings_tenant_idx').on(table.tenantId),
    index('bookings_customer_idx').on(table.customerId),
    index('bookings_vehicle_idx').on(table.vehicleId),
    index('bookings_location_idx').on(table.locationId),
    index('bookings_status_idx').on(table.status),
    index('bookings_date_idx').on(table.bookingDate),
    uniqueIndex('bookings_booking_number_idx').on(table.tenantId, table.bookingNumber),
  ],
)

export const mrnReceipts = pgTable(
  'mrn_receipts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    mrnNumber: text('mrn_number').notNull(),
    bookingId: uuid('booking_id')
      .references(() => bookings.id, { onDelete: 'set null' }),
    // FK to service_bookings declared only in SQL (not Drizzle) to avoid circular import with services.ts
    serviceBookingId: uuid('service_booking_id'),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    paymentMode: paymentModeEnum('payment_mode').notNull(),
    referenceNumber: text('reference_number'),
    receivedBy: uuid('received_by').references(() => users.id),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('mrn_receipts_tenant_idx').on(table.tenantId),
    index('mrn_receipts_booking_idx').on(table.bookingId),
    index('mrn_receipts_service_booking_idx').on(table.serviceBookingId),
    index('mrn_receipts_customer_idx').on(table.customerId),
    uniqueIndex('mrn_receipts_mrn_number_idx').on(table.tenantId, table.mrnNumber),
  ],
)

export type Booking = typeof bookings.$inferSelect
export type NewBooking = typeof bookings.$inferInsert
export type MrnReceipt = typeof mrnReceipts.$inferSelect
export type NewMrnReceipt = typeof mrnReceipts.$inferInsert

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
  integer,
} from 'drizzle-orm/pg-core'
import { tenants, locations, users } from './auth'
import { customers } from './inventory'
import { discountTypeEnum } from './bookings'

export const serviceStatusEnum = pgEnum('service_status', [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'WAITING_FOR_PARTS',
  'DELIVERED',
])

export const servicePaymentTypeEnum = pgEnum('service_payment_type', ['CASH', 'INSURANCE'])

export const serviceTypes = pgTable(
  'service_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    basePrice: numeric('base_price', { precision: 12, scale: 2 }).notNull().default('0'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [index('service_types_tenant_idx').on(table.tenantId)],
)

export const technicians = pgTable(
  'technicians',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone'),
    specialization: text('specialization'),
    locationId: uuid('location_id').references(() => locations.id, { onDelete: 'set null' }),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    index('technicians_tenant_idx').on(table.tenantId),
    index('technicians_location_idx').on(table.locationId),
  ],
)

export const serviceBookings = pgTable(
  'service_bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    jobCardNumber: text('job_card_number').notNull(),

    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),

    // Vehicle details (denormalised — reg number may not exist in inventory yet)
    vehicleFrameNumber:  text('vehicle_frame_number'),
    vehicleRegNumber:    text('vehicle_reg_number'),
    vehicleModel:        text('vehicle_model').notNull(),
    vehicleVariant:      text('vehicle_variant'),
    vehicleColor:        text('vehicle_color'),
    vehicleEngineNumber: text('vehicle_engine_number'),

    serviceTypeId: uuid('service_type_id').references(() => serviceTypes.id),
    technicianId: uuid('technician_id').references(() => technicians.id),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),

    scheduledDate: timestamp('scheduled_date', { withTimezone: true }).notNull(),
    status: serviceStatusEnum('status').notNull().default('PENDING'),

    // Backdating & MRN
    bookingDate: timestamp('booking_date', { withTimezone: true }),
    mrnNumber: text('mrn_number'),

    // Discount
    discountCategory: text('discount_category'),
    discountType: discountTypeEnum('discount_type'),
    discountValue: numeric('discount_value', { precision: 12, scale: 2 }),
    discountRemarks: text('discount_remarks'),

    // Pricing
    subTotal: numeric('sub_total', { precision: 12, scale: 2 }).notNull().default('0'),
    discount: numeric('discount', { precision: 12, scale: 2 }).notNull().default('0'),
    advanceAmount: numeric('advance_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    mrnAmount: numeric('mrn_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    finalNetAmount: numeric('final_net_amount', { precision: 12, scale: 2 }).notNull().default('0'),

    // Payment type & insurance
    paymentType:          servicePaymentTypeEnum('payment_type').notNull().default('CASH'),
    insuranceCompany:     text('insurance_company'),
    insurancePersonName:  text('insurance_person_name'),
    insurancePersonPhone: text('insurance_person_phone'),
    insuranceAmount:      numeric('insurance_amount', { precision: 12, scale: 2 }),
    deliveryOrderNo:      text('delivery_order_no'),

    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('service_bookings_tenant_idx').on(table.tenantId),
    index('service_bookings_customer_idx').on(table.customerId),
    index('service_bookings_location_idx').on(table.locationId),
    index('service_bookings_status_idx').on(table.status),
    index('service_bookings_scheduled_date_idx').on(table.scheduledDate),
    uniqueIndex('service_bookings_job_card_idx').on(table.tenantId, table.jobCardNumber),
  ],
)

export type ServiceType = typeof serviceTypes.$inferSelect
export type NewServiceType = typeof serviceTypes.$inferInsert
export type Technician = typeof technicians.$inferSelect
export type NewTechnician = typeof technicians.$inferInsert
export type ServiceBooking = typeof serviceBookings.$inferSelect
export type NewServiceBooking = typeof serviceBookings.$inferInsert

export const serviceBookingItems = pgTable(
  'service_booking_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    serviceBookingId: uuid('service_booking_id').notNull().references(() => serviceBookings.id, { onDelete: 'cascade' }),
    itemName: text('item_name').notNull(),
    isGstApplicable: boolean('is_gst_applicable').notNull().default(true),
    gstPercent: numeric('gst_percent', { precision: 5, scale: 2 }).notNull().default('18'),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull().default('0'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    index('svc_booking_items_booking_idx').on(table.serviceBookingId),
    index('svc_booking_items_tenant_idx').on(table.tenantId),
  ],
)
export type ServiceBookingItem = typeof serviceBookingItems.$inferSelect
export type NewServiceBookingItem = typeof serviceBookingItems.$inferInsert

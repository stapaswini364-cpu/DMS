import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { tenants, users } from './auth'
import { bookings } from './bookings'

export const invoices = pgTable(
  'invoices',
  {
    id:              uuid('id').primaryKey().defaultRandom(),
    tenantId:        uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    invoiceNumber:   text('invoice_number').notNull(),
    bookingId:       uuid('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
    // service_booking_id FK declared in SQL only (avoids circular import with services.ts)
    serviceBookingId: uuid('service_booking_id'),
    generatedAt:     timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    generatedBy:     uuid('generated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    uniqueIndex('invoices_number_tenant_idx').on(table.tenantId, table.invoiceNumber),
    index('invoices_tenant_idx').on(table.tenantId),
    index('invoices_booking_idx').on(table.bookingId),
    index('invoices_service_booking_idx').on(table.serviceBookingId),
  ],
)

export type Invoice    = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert

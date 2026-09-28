import { relations } from 'drizzle-orm'
import { tenants, locations, users } from './auth'
import {
  productModels,
  productVariants,
  productColors,
  customers,
  financers,
  vehicleInventory,
} from './inventory'
import { bookings, mrnReceipts } from './bookings'
import { serviceTypes, technicians, serviceBookings, serviceBookingItems } from './services'
import { invoices } from './invoices'
import {
  chartOfAccounts,
  bankAccounts,
  vouchers,
  voucherEntries,
  coaAccountTypes,
  coaMajorHeads,
  coaGroups,
  coaSubGroups,
  coaLedgers,
  journalEntries,
  journalEntryLines,
} from './accounting'

// ─── Auth ────────────────────────────────────────────────────────────────────

export const tenantsRelations = relations(tenants, ({ many }) => ({
  locations: many(locations),
  users: many(users),
  productModels: many(productModels),
  customers: many(customers),
  financers: many(financers),
  vehicleInventory: many(vehicleInventory),
  bookings: many(bookings),
  serviceTypes: many(serviceTypes),
  technicians: many(technicians),
  serviceBookings: many(serviceBookings),
  chartOfAccounts: many(chartOfAccounts),
  bankAccounts: many(bankAccounts),
  vouchers: many(vouchers),
}))

export const locationsRelations = relations(locations, ({ one, many }) => ({
  tenant: one(tenants, { fields: [locations.tenantId], references: [tenants.id] }),
  users: many(users),
  vehicleInventory: many(vehicleInventory),
  bookings: many(bookings),
  technicians: many(technicians),
  serviceBookings: many(serviceBookings),
  bankAccounts: many(bankAccounts),
  vouchers: many(vouchers),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  location: one(locations, { fields: [users.locationId], references: [locations.id] }),
  bookingsAsSalesExecutive: many(bookings, { relationName: 'salesExecutive' }),
  bookingsDiscountApprovedBy: many(bookings, { relationName: 'discountApprover' }),
  bookingsReferredByEmployee: many(bookings, { relationName: 'referralEmployee' }),
  mrnReceiptsReceived: many(mrnReceipts),
  serviceBookingsCreated: many(serviceBookings),
  vouchersCreated: many(vouchers),
}))

// ─── Inventory ───────────────────────────────────────────────────────────────

export const productModelsRelations = relations(productModels, ({ one, many }) => ({
  tenant: one(tenants, { fields: [productModels.tenantId], references: [tenants.id] }),
  variants: many(productVariants),
}))

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  tenant: one(tenants, { fields: [productVariants.tenantId], references: [tenants.id] }),
  model: one(productModels, { fields: [productVariants.modelId], references: [productModels.id] }),
  colors: many(productColors),
  vehicleInventory: many(vehicleInventory),
}))

export const productColorsRelations = relations(productColors, ({ one, many }) => ({
  tenant: one(tenants, { fields: [productColors.tenantId], references: [tenants.id] }),
  variant: one(productVariants, { fields: [productColors.variantId], references: [productVariants.id] }),
  vehicleInventory: many(vehicleInventory),
}))

export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, { fields: [customers.tenantId], references: [tenants.id] }),
  bookings: many(bookings),
  mrnReceipts: many(mrnReceipts),
  serviceBookings: many(serviceBookings),
}))

export const financersRelations = relations(financers, ({ one, many }) => ({
  tenant: one(tenants, { fields: [financers.tenantId], references: [tenants.id] }),
  bookings: many(bookings),
}))

export const vehicleInventoryRelations = relations(vehicleInventory, ({ one, many }) => ({
  tenant: one(tenants, { fields: [vehicleInventory.tenantId], references: [tenants.id] }),
  variant: one(productVariants, { fields: [vehicleInventory.variantId], references: [productVariants.id] }),
  color: one(productColors, { fields: [vehicleInventory.colorId], references: [productColors.id] }),
  location: one(locations, { fields: [vehicleInventory.locationId], references: [locations.id] }),
  bookings: many(bookings),
}))

// ─── Bookings ────────────────────────────────────────────────────────────────

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  tenant: one(tenants, { fields: [bookings.tenantId], references: [tenants.id] }),
  customer: one(customers, { fields: [bookings.customerId], references: [customers.id] }),
  vehicle: one(vehicleInventory, { fields: [bookings.vehicleId], references: [vehicleInventory.id] }),
  location: one(locations, { fields: [bookings.locationId], references: [locations.id] }),
  financer: one(financers, { fields: [bookings.financerId], references: [financers.id] }),
  salesExecutive: one(users, {
    fields: [bookings.salesExecutiveId],
    references: [users.id],
    relationName: 'salesExecutive',
  }),
  discountApprovedBy: one(users, {
    fields: [bookings.discountApprovedBy],
    references: [users.id],
    relationName: 'discountApprover',
  }),
  referredByEmployee: one(users, {
    fields: [bookings.referredByEmployeeId],
    references: [users.id],
    relationName: 'referralEmployee',
  }),
  mrnReceipts: many(mrnReceipts),
  invoice: one(invoices, { fields: [bookings.id], references: [invoices.bookingId] }),
}))

export const invoicesRelations = relations(invoices, ({ one }) => ({
  tenant:      one(tenants,   { fields: [invoices.tenantId],   references: [tenants.id] }),
  booking:     one(bookings,  { fields: [invoices.bookingId],  references: [bookings.id] }),
  generatedBy: one(users,     { fields: [invoices.generatedBy], references: [users.id] }),
}))

export const mrnReceiptsRelations = relations(mrnReceipts, ({ one }) => ({
  tenant: one(tenants, { fields: [mrnReceipts.tenantId], references: [tenants.id] }),
  booking: one(bookings, { fields: [mrnReceipts.bookingId], references: [bookings.id] }),
  serviceBooking: one(serviceBookings, { fields: [mrnReceipts.serviceBookingId], references: [serviceBookings.id] }),
  customer: one(customers, { fields: [mrnReceipts.customerId], references: [customers.id] }),
  receivedBy: one(users, { fields: [mrnReceipts.receivedBy], references: [users.id] }),
}))

// ─── Services ────────────────────────────────────────────────────────────────

export const serviceTypesRelations = relations(serviceTypes, ({ one, many }) => ({
  tenant: one(tenants, { fields: [serviceTypes.tenantId], references: [tenants.id] }),
  serviceBookings: many(serviceBookings),
}))

export const techniciansRelations = relations(technicians, ({ one, many }) => ({
  tenant: one(tenants, { fields: [technicians.tenantId], references: [tenants.id] }),
  location: one(locations, { fields: [technicians.locationId], references: [locations.id] }),
  serviceBookings: many(serviceBookings),
}))

export const serviceBookingsRelations = relations(serviceBookings, ({ one, many }) => ({
  tenant: one(tenants, { fields: [serviceBookings.tenantId], references: [tenants.id] }),
  customer: one(customers, { fields: [serviceBookings.customerId], references: [customers.id] }),
  serviceType: one(serviceTypes, { fields: [serviceBookings.serviceTypeId], references: [serviceTypes.id] }),
  technician: one(technicians, { fields: [serviceBookings.technicianId], references: [technicians.id] }),
  location: one(locations, { fields: [serviceBookings.locationId], references: [locations.id] }),
  createdBy: one(users, { fields: [serviceBookings.createdBy], references: [users.id] }),
  items: many(serviceBookingItems),
}))

export const serviceBookingItemsRelations = relations(serviceBookingItems, ({ one }) => ({
  tenant: one(tenants, { fields: [serviceBookingItems.tenantId], references: [tenants.id] }),
  serviceBooking: one(serviceBookings, { fields: [serviceBookingItems.serviceBookingId], references: [serviceBookings.id] }),
}))

// ─── Accounting ───────────────────────────────────────────────────────────────

export const chartOfAccountsRelations = relations(chartOfAccounts, ({ one, many }) => ({
  tenant: one(tenants, { fields: [chartOfAccounts.tenantId], references: [tenants.id] }),
  parent: one(chartOfAccounts, {
    fields: [chartOfAccounts.parentId],
    references: [chartOfAccounts.id],
    relationName: 'parentAccount',
  }),
  children: many(chartOfAccounts, { relationName: 'parentAccount' }),
  voucherEntries: many(voucherEntries),
}))

export const bankAccountsRelations = relations(bankAccounts, ({ one }) => ({
  tenant: one(tenants, { fields: [bankAccounts.tenantId], references: [tenants.id] }),
  location: one(locations, { fields: [bankAccounts.locationId], references: [locations.id] }),
}))

export const vouchersRelations = relations(vouchers, ({ one, many }) => ({
  tenant: one(tenants, { fields: [vouchers.tenantId], references: [tenants.id] }),
  location: one(locations, { fields: [vouchers.locationId], references: [locations.id] }),
  createdBy: one(users, { fields: [vouchers.createdBy], references: [users.id] }),
  entries: many(voucherEntries),
}))

export const voucherEntriesRelations = relations(voucherEntries, ({ one }) => ({
  tenant: one(tenants, { fields: [voucherEntries.tenantId], references: [tenants.id] }),
  voucher: one(vouchers, { fields: [voucherEntries.voucherId], references: [vouchers.id] }),
  account: one(chartOfAccounts, { fields: [voucherEntries.accountId], references: [chartOfAccounts.id] }),
}))

// ─── COA Hierarchy ────────────────────────────────────────────────────────────

export const coaAccountTypesRelations = relations(coaAccountTypes, ({ one, many }) => ({
  tenant: one(tenants, { fields: [coaAccountTypes.tenantId], references: [tenants.id] }),
  majorHeads: many(coaMajorHeads),
}))

export const coaMajorHeadsRelations = relations(coaMajorHeads, ({ one, many }) => ({
  tenant: one(tenants, { fields: [coaMajorHeads.tenantId], references: [tenants.id] }),
  accountType: one(coaAccountTypes, { fields: [coaMajorHeads.accountTypeId], references: [coaAccountTypes.id] }),
  groups: many(coaGroups),
}))

export const coaGroupsRelations = relations(coaGroups, ({ one, many }) => ({
  tenant: one(tenants, { fields: [coaGroups.tenantId], references: [tenants.id] }),
  majorHead: one(coaMajorHeads, { fields: [coaGroups.majorHeadId], references: [coaMajorHeads.id] }),
  subGroups: many(coaSubGroups),
}))

export const coaSubGroupsRelations = relations(coaSubGroups, ({ one, many }) => ({
  tenant: one(tenants, { fields: [coaSubGroups.tenantId], references: [tenants.id] }),
  group: one(coaGroups, { fields: [coaSubGroups.groupId], references: [coaGroups.id] }),
  ledgers: many(coaLedgers),
}))

export const coaLedgersRelations = relations(coaLedgers, ({ one, many }) => ({
  tenant: one(tenants, { fields: [coaLedgers.tenantId], references: [tenants.id] }),
  subGroup: one(coaSubGroups, { fields: [coaLedgers.subGroupId], references: [coaSubGroups.id] }),
  createdByUser: one(users, { fields: [coaLedgers.createdBy], references: [users.id] }),
  journalEntryLines: many(journalEntryLines),
}))

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  tenant: one(tenants, { fields: [journalEntries.tenantId], references: [tenants.id] }),
  location: one(locations, { fields: [journalEntries.locationId], references: [locations.id] }),
  createdByUser: one(users, { fields: [journalEntries.createdBy], references: [users.id] }),
  lines: many(journalEntryLines),
}))

export const journalEntryLinesRelations = relations(journalEntryLines, ({ one }) => ({
  tenant: one(tenants, { fields: [journalEntryLines.tenantId], references: [tenants.id] }),
  journalEntry: one(journalEntries, { fields: [journalEntryLines.journalEntryId], references: [journalEntries.id] }),
  ledger: one(coaLedgers, { fields: [journalEntryLines.ledgerId], references: [coaLedgers.id] }),
}))

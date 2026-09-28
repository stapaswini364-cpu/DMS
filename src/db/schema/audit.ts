import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core'

export const auditLogs = pgTable('audit_logs', {
  id:        uuid().defaultRandom().primaryKey(),
  tenantId:  uuid('tenant_id').notNull(),
  userId:    text('user_id').notNull(),
  userEmail: text('user_email'),
  action:    text('action').notNull(),
  module:    text('module').notNull(),
  recordId:  text('record_id'),
  details:   jsonb('details'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow(),
})

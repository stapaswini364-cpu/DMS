import { db } from '@/db'
import { auditLogs } from '@/db/schema/audit'

type AuditParams = {
  tenantId:  string
  userId:    string
  userEmail?: string | null
  action:    string
  module:    string
  recordId?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?:  Record<string, any> | null
  ipAddress?: string | null
}

export function logAudit(params: AuditParams): void {
  db.insert(auditLogs).values({
    tenantId:  params.tenantId,
    userId:    params.userId,
    userEmail: params.userEmail ?? null,
    action:    params.action,
    module:    params.module,
    recordId:  params.recordId ?? null,
    details:   params.details ?? null,
    ipAddress: params.ipAddress ?? null,
  }).catch(() => {})
}

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api-auth'
import {
  validateImportRows,
  insertValidatedRows,
  type ImportRawRow,
  type ImportInvalidRow,
} from '@/lib/inventory-import'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const { tenant, userId, err } = await requireTenant()
  if (err) return err

  const body = await req.json().catch(() => null) as { rows?: ImportRawRow[] } | null
  const rows = Array.isArray(body?.rows) ? body!.rows : null

  if (!rows) return NextResponse.json({ error: 'rows array is required' }, { status: 400 })
  if (rows.length === 0) return NextResponse.json({ error: 'CSV is empty' }, { status: 400 })
  if (rows.length > 2000) return NextResponse.json({ error: 'Max 2000 rows per import' }, { status: 400 })

  const validation = await validateImportRows(tenant.id, rows)
  const { inserted, failed } = await insertValidatedRows(tenant.id, validation.valid)

  const skipped: ImportInvalidRow[] = [...validation.invalid, ...failed].sort(
    (a, b) => a.rowNumber - b.rowNumber,
  )

  if (inserted.length > 0) {
    logAudit({
      tenantId: tenant.id,
      userId,
      action: 'BULK_IMPORT',
      module: 'inventory',
      details: {
        imported: inserted.length,
        skipped: skipped.length,
        total: rows.length,
      },
    })
  }

  return NextResponse.json({
    imported: inserted.length,
    skipped,
    totalCount: rows.length,
  })
}

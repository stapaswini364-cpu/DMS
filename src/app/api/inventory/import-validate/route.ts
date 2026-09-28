export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api-auth'
import { validateImportRows, type ImportRawRow } from '@/lib/inventory-import'

export async function POST(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const body = await req.json().catch(() => null) as { rows?: ImportRawRow[] } | null
  const rows = Array.isArray(body?.rows) ? body!.rows : null

  if (!rows) return NextResponse.json({ error: 'rows array is required' }, { status: 400 })
  if (rows.length === 0) return NextResponse.json({ error: 'CSV is empty' }, { status: 400 })
  if (rows.length > 2000) return NextResponse.json({ error: 'Max 2000 rows per import' }, { status: 400 })

  const result = await validateImportRows(tenant.id, rows)
  return NextResponse.json(result)
}

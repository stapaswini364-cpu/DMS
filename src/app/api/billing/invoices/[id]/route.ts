export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { bookings } from '@/db/schema/bookings'
import { requireTenant } from '@/lib/api-auth'
import { buildInvoiceData } from '@/lib/invoice'

// [id] is the booking ID — invoices are derived from bookings, not stored separately
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  const [booking] = await db
    .select({ status: bookings.status })
    .from(bookings)
    .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenant.id)))
    .limit(1)

  if (!booking) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }
  if (booking.status !== 'CONFIRMED' && booking.status !== 'DELIVERED') {
    return NextResponse.json(
      { error: 'Invoice is only available for CONFIRMED or DELIVERED bookings' },
      { status: 400 },
    )
  }

  const invoice = await buildInvoiceData(id, tenant.id)
  if (!invoice) {
    return NextResponse.json({ error: 'Failed to build invoice' }, { status: 500 })
  }

  return NextResponse.json(invoice)
}

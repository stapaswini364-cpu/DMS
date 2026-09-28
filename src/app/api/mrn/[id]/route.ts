export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { mrnReceipts } from '@/db/schema/bookings'
import { requireTenant } from '@/lib/api-auth'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  const receipt = await db.query.mrnReceipts.findFirst({
    where: and(eq(mrnReceipts.id, id), eq(mrnReceipts.tenantId, tenant.id)),
    with: {
      booking: {
        columns: {
          id: true,
          bookingNumber: true,
          status: true,
          grandTotal: true,
          bookingAmount: true,
          pendingAmount: true,
          salesType: true,
        },
      },
      customer: true,
      receivedBy: { columns: { id: true, name: true, email: true } },
    },
  })

  if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
  return NextResponse.json(receipt)
}

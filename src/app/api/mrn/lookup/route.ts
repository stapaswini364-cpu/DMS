export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { mrnReceipts } from '@/db/schema/bookings'
import { requireTenant } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const mrnNumber = new URL(req.url).searchParams.get('mrnNumber')
  if (!mrnNumber?.trim()) {
    return NextResponse.json({ error: 'mrnNumber is required' }, { status: 400 })
  }

  const receipt = await db.query.mrnReceipts.findFirst({
    where: and(
      eq(mrnReceipts.tenantId, tenant.id),
      eq(mrnReceipts.mrnNumber, mrnNumber.trim()),
    ),
    columns: {
      mrnNumber:   true,
      amount:      true,
      paymentMode: true,
      receivedAt:  true,
    },
  })

  if (!receipt) {
    return NextResponse.json({ error: 'MRN not found' }, { status: 404 })
  }

  return NextResponse.json({
    mrnNumber:   receipt.mrnNumber,
    amount:      receipt.amount,
    paymentMode: receipt.paymentMode,
    receivedAt:  receipt.receivedAt,
  })
}

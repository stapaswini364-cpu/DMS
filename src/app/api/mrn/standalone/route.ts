export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { mrnReceipts, paymentModeEnum } from '@/db/schema/bookings'
import { requireTenant } from '@/lib/api-auth'
import { postMrnEntry } from '@/lib/accounting/booking-postings'

const PAYMENT_MODES = paymentModeEnum.enumValues

export async function POST(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const body = await req.json()
  const { mrnNumber, customerId, locationId, amount, paymentMode, referenceNumber, receivedBy } =
    body as Record<string, string | undefined>

  if (!mrnNumber?.trim())  return NextResponse.json({ error: 'MRN number is required' }, { status: 400 })
  if (!customerId)         return NextResponse.json({ error: 'customerId is required' }, { status: 400 })
  if (!locationId)         return NextResponse.json({ error: 'locationId is required' }, { status: 400 })
  if (!amount)             return NextResponse.json({ error: 'amount is required' }, { status: 400 })
  if (!paymentMode)        return NextResponse.json({ error: 'paymentMode is required' }, { status: 400 })

  const parsedAmount = Number(amount)
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  if (!PAYMENT_MODES.includes(paymentMode as typeof PAYMENT_MODES[number])) {
    return NextResponse.json(
      { error: `paymentMode must be one of: ${PAYMENT_MODES.join(', ')}` },
      { status: 400 },
    )
  }

  const mrn = mrnNumber.trim().toUpperCase()

  // Check for duplicate MRN within this tenant
  const existing = await db.query.mrnReceipts.findFirst({
    where: and(eq(mrnReceipts.tenantId, tenant.id), eq(mrnReceipts.mrnNumber, mrn)),
    columns: { id: true },
  })
  if (existing) {
    return NextResponse.json(
      { error: `MRN number ${mrn} already exists — each MRN must be unique.` },
      { status: 409 },
    )
  }

  const now = new Date()

  const [newReceipt] = await db
    .insert(mrnReceipts)
    .values({
      tenantId:        tenant.id,
      mrnNumber:       mrn,
      bookingId:       null,
      customerId,
      amount:          String(parsedAmount),
      paymentMode:     paymentMode as typeof PAYMENT_MODES[number],
      referenceNumber: referenceNumber?.trim() || null,
      receivedBy:      receivedBy ?? null,
      receivedAt:      now,
    })
    .returning()

  postMrnEntry({
    tenantId:   tenant.id,
    mrnNumber:  newReceipt.mrnNumber,
    amount:     parsedAmount,
    paymentMode,
    locationId,
    createdBy:  undefined,
  }).catch(err => {
    console.error('[accounting] postMrnEntry (standalone) failed for', newReceipt.mrnNumber, err)
  })

  return NextResponse.json(newReceipt, { status: 201 })
}

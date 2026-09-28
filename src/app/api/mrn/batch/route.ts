export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { mrnReceipts, bookings, paymentModeEnum } from '@/db/schema/bookings'
import { requireTenant } from '@/lib/api-auth'
import { postMrnEntry } from '@/lib/accounting/booking-postings'

const PAYMENT_MODES = paymentModeEnum.enumValues

type PaymentRow = {
  paymentMode: string
  amount: number
  referenceNumber?: string
  remarks?: string
}

// POST /api/mrn/batch
// Body: {
//   mrnNumber: string                — single manual MRN covering the whole payment
//   bookingId: string
//   customerId: string
//   payments: Array<{ paymentMode: string; amount: number; referenceNumber?: string; remarks?: string }>
// }
export async function POST(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const body = await req.json()
  const { mrnNumber, bookingId, customerId, payments } = body as {
    mrnNumber?: string
    bookingId?: string
    customerId?: string
    payments?: PaymentRow[]
  }

  // ── Validate inputs ───────────────────────────────────────────────────────────
  if (!mrnNumber?.trim()) return NextResponse.json({ error: 'MRN number is required' }, { status: 400 })
  if (!bookingId)         return NextResponse.json({ error: 'bookingId is required' }, { status: 400 })
  if (!customerId)        return NextResponse.json({ error: 'customerId is required' }, { status: 400 })
  if (!Array.isArray(payments) || payments.length === 0) {
    return NextResponse.json({ error: 'payments must be a non-empty array' }, { status: 400 })
  }

  for (let i = 0; i < payments.length; i++) {
    const p = payments[i]
    if (!PAYMENT_MODES.includes(p.paymentMode as typeof PAYMENT_MODES[number])) {
      return NextResponse.json(
        { error: `payments[${i}].paymentMode must be one of: ${PAYMENT_MODES.join(', ')}` },
        { status: 400 },
      )
    }
    if (!p.amount || p.amount <= 0) {
      return NextResponse.json(
        { error: `payments[${i}].amount must be a positive number` },
        { status: 400 },
      )
    }
  }

  const mrn = mrnNumber.trim().toUpperCase()

  // ── Check for duplicate MRN ───────────────────────────────────────────────────
  const existingMrn = await db.query.mrnReceipts.findFirst({
    where: and(eq(mrnReceipts.tenantId, tenant.id), eq(mrnReceipts.mrnNumber, mrn)),
    columns: { id: true },
  })
  if (existingMrn) {
    return NextResponse.json(
      { error: `MRN number ${mrn} already exists — each MRN must be unique.` },
      { status: 409 },
    )
  }

  // ── Verify booking belongs to tenant ─────────────────────────────────────────
  const [booking] = await db
    .select({
      id:            bookings.id,
      bookingNumber: bookings.bookingNumber,
      bookingAmount: bookings.bookingAmount,
      pendingAmount: bookings.pendingAmount,
      locationId:    bookings.locationId,
    })
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.tenantId, tenant.id)))
    .limit(1)

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  const totalPayment = payments.reduce((s, p) => s + p.amount, 0)
  if (totalPayment > Number(booking.pendingAmount)) {
    return NextResponse.json(
      { error: `Total payment (${totalPayment}) exceeds pending amount (${booking.pendingAmount})` },
      { status: 400 },
    )
  }

  const now = new Date()

  // ── Transaction: one mrn_receipts row covering the total ──────────────────────
  // The payment breakdown across modes is preserved in the accounting entries below.
  const primaryMode = payments[0].paymentMode as typeof PAYMENT_MODES[number]

  const receipt = await db.transaction(async (tx) => {
    const [newReceipt] = await tx
      .insert(mrnReceipts)
      .values({
        tenantId:        tenant.id,
        mrnNumber:       mrn,
        bookingId,
        customerId,
        amount:          String(totalPayment),
        paymentMode:     primaryMode,
        referenceNumber: payments[0].referenceNumber?.trim() || null,
        receivedAt:      now,
      })
      .returning()

    // Update booking totals and mrnNumber
    const newBookingAmount = Number(booking.bookingAmount) + totalPayment
    const newPendingAmount = Math.max(0, Number(booking.pendingAmount) - totalPayment)

    await tx
      .update(bookings)
      .set({
        mrnNumber:     mrn,
        bookingAmount: String(newBookingAmount),
        pendingAmount: String(newPendingAmount),
        updatedAt:     now,
      })
      .where(and(eq(bookings.id, bookingId), eq(bookings.tenantId, tenant.id)))

    return newReceipt
  })

  // ── Post journal entries per payment mode (fire-and-forget) ───────────────────
  for (const p of payments) {
    postMrnEntry({
      tenantId:      tenant.id,
      bookingId,
      bookingNumber: booking.bookingNumber,
      mrnNumber:     mrn,
      amount:        p.amount,
      paymentMode:   p.paymentMode,
      locationId:    booking.locationId,
      createdBy:     undefined,
    }).catch(e => {
      console.error('[accounting] postMrnEntry failed for', mrn, e)
    })
  }

  return NextResponse.json(receipt, { status: 201 })
}

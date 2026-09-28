export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and, count, gte, lt } from 'drizzle-orm'
import { db } from '@/db'
import { mrnReceipts, bookings, paymentModeEnum } from '@/db/schema/bookings'
import { requireTenant } from '@/lib/api-auth'
import { postMrnEntry } from '@/lib/accounting/booking-postings'

const PAYMENT_MODES = paymentModeEnum.enumValues

function dateStr(d: Date) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('')
}

export async function GET() {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const rows = await db.query.mrnReceipts.findMany({
    where: eq(mrnReceipts.tenantId, tenant.id),
    with: {
      booking: { columns: { id: true, bookingNumber: true, status: true, grandTotal: true } },
      customer: { columns: { id: true, name: true, phone: true } },
      receivedBy: { columns: { id: true, name: true } },
    },
    orderBy: (r, { desc }) => [desc(r.receivedAt)],
  })

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const body = await req.json()
  const { bookingId, customerId, amount, paymentMode, referenceNumber, receivedBy } =
    body as Record<string, string | undefined>

  if (!bookingId)    return NextResponse.json({ error: 'bookingId is required' }, { status: 400 })
  if (!customerId)   return NextResponse.json({ error: 'customerId is required' }, { status: 400 })
  if (!amount)       return NextResponse.json({ error: 'amount is required' }, { status: 400 })
  if (!paymentMode)  return NextResponse.json({ error: 'paymentMode is required' }, { status: 400 })

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

  // Verify booking belongs to this tenant
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

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000)

  const receipt = await db.transaction(async (tx) => {
    // ── 1. Generate MRN number (daily sequence per tenant) ────────────────────
    const [{ dailyCount }] = await tx
      .select({ dailyCount: count() })
      .from(mrnReceipts)
      .where(
        and(
          eq(mrnReceipts.tenantId, tenant.id),
          gte(mrnReceipts.receivedAt, todayStart),
          lt(mrnReceipts.receivedAt, tomorrowStart),
        ),
      )

    const mrnNumber = `MRN-${dateStr(now)}-${String(Number(dailyCount) + 1).padStart(4, '0')}`

    // ── 2. Insert receipt ─────────────────────────────────────────────────────
    const [newReceipt] = await tx
      .insert(mrnReceipts)
      .values({
        tenantId:        tenant.id,
        mrnNumber,
        bookingId,
        customerId,
        amount:          String(parsedAmount),
        paymentMode:     paymentMode as typeof PAYMENT_MODES[number],
        referenceNumber: referenceNumber?.trim() || null,
        receivedBy:      receivedBy ?? null,
        receivedAt:      now,
      })
      .returning()

    // ── 3. Update booking totals and mrnNumber ────────────────────────────────
    const newBookingAmount = Number(booking.bookingAmount) + parsedAmount
    const newPendingAmount = Math.max(0, Number(booking.pendingAmount) - parsedAmount)

    await tx
      .update(bookings)
      .set({
        mrnNumber,
        bookingAmount: String(newBookingAmount),
        pendingAmount: String(newPendingAmount),
        updatedAt:     now,
      })
      .where(and(eq(bookings.id, bookingId), eq(bookings.tenantId, tenant.id)))

    return newReceipt
  })

  // Post journal entry after transaction (fire-and-forget; MRN is already committed)
  postMrnEntry({
    tenantId:      tenant.id,
    bookingId,
    bookingNumber: booking.bookingNumber,
    mrnNumber:     receipt.mrnNumber,
    amount:        parsedAmount,
    paymentMode,
    locationId:    booking.locationId,
    createdBy:     undefined,
  }).catch(err => {
    console.error('[accounting] postMrnEntry failed for', receipt.mrnNumber, err)
  })

  return NextResponse.json(receipt, { status: 201 })
}

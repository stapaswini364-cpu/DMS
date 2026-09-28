export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and, count, like } from 'drizzle-orm'
import { db } from '@/db'
import { bookings, bookingStatusEnum, mrnReceipts } from '@/db/schema/bookings'
import { vehicleInventory } from '@/db/schema/inventory'
import { requireTenant } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'

const STATUSES = bookingStatusEnum.enumValues

function dateStr(d: Date) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('')
}

function n(v: unknown): string {
  return v !== undefined && v !== null ? String(v) : '0'
}

export async function GET(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const statusParam = new URL(req.url).searchParams.get('status')

  if (statusParam && !STATUSES.includes(statusParam as typeof STATUSES[number])) {
    return NextResponse.json(
      { error: `status must be one of: ${STATUSES.join(', ')}` },
      { status: 400 },
    )
  }

  const rows = await db.query.bookings.findMany({
    where: statusParam
      ? and(
          eq(bookings.tenantId, tenant.id),
          eq(bookings.status, statusParam as typeof STATUSES[number]),
        )
      : eq(bookings.tenantId, tenant.id),
    columns: {
      id: true,
      bookingNumber: true,
      status: true,
      salesType: true,
      grandTotal: true,
      bookingAmount: true,
      pendingAmount: true,
      bookingDate: true,
      createdAt: true,
    },
    with: {
      customer: { columns: { id: true, name: true, phone: true, email: true } },
      vehicle: {
        columns: { id: true, frameNumber: true },
        with: {
          variant: {
            columns: { id: true, name: true },
            with: { model: { columns: { id: true, name: true, brand: true } } },
          },
          color: { columns: { colorName: true } },
        },
      },
    },
    orderBy: (b, { desc: d }) => [d(b.createdAt)],
  })

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { tenant, userId, err } = await requireTenant()
  if (err) return err

  const body = await req.json()
  const { customerId, locationId, exShowroomPrice, onRoadPrice, subTotal, grandTotal } = body

  if (!customerId)      return NextResponse.json({ error: 'customerId is required' }, { status: 400 })
  if (!locationId)      return NextResponse.json({ error: 'locationId is required' }, { status: 400 })
  if (!exShowroomPrice) return NextResponse.json({ error: 'exShowroomPrice is required' }, { status: 400 })
  if (!onRoadPrice)     return NextResponse.json({ error: 'onRoadPrice is required' }, { status: 400 })
  if (!subTotal)        return NextResponse.json({ error: 'subTotal is required' }, { status: 400 })
  if (!grandTotal)      return NextResponse.json({ error: 'grandTotal is required' }, { status: 400 })

  const now = new Date()

  let booking
  try {
  booking = await db.transaction(async (tx) => {
    // ── 1. Generate booking number (daily sequence per tenant) ─────────────────
    // Count by booking_number prefix (not bookingDate) so backdated bookings
    // don't cause duplicate key collisions on the unique index.
    const todayPrefix = `BOOK-${dateStr(now)}-%`
    const [{ dailyCount }] = await tx
      .select({ dailyCount: count() })
      .from(bookings)
      .where(
        and(
          eq(bookings.tenantId, tenant.id),
          like(bookings.bookingNumber, todayPrefix),
        ),
      )
    const bookingNumber = `BOOK-${dateStr(now)}-${String(Number(dailyCount) + 1).padStart(4, '0')}`

    // ── 2. Insert booking ─────────────────────────────────────────────────────
    const [newBooking] = await tx
      .insert(bookings)
      .values({
        tenantId: tenant.id,
        bookingNumber,
        customerId: body.customerId,
        vehicleId: body.vehicleId ?? null,
        locationId: body.locationId,

        exShowroomPrice: n(body.exShowroomPrice),
        rtoAmount:        n(body.rtoAmount),
        insuranceAmount:  n(body.insuranceAmount),
        onRoadPrice:      n(body.onRoadPrice),

        addonPrice:        n(body.addonPrice),
        accessories:       body.accessories ?? null,
        extendedWarranty:  n(body.extendedWarranty),
        amc:               n(body.amc),
        handlingCharges:   n(body.handlingCharges),
        etcCharges:        n(body.etcCharges),
        subTotal:          n(body.subTotal),

        discountEnabled:   body.discountEnabled   ?? false,
        discountCategory:  body.discountCategory  ?? null,
        discountType:      body.discountType       ?? null,
        discountAmount:    n(body.discountAmount),
        discountApprovedBy: body.discountApprovedBy ?? null,
        discountRemarks:   body.discountRemarks    ?? null,

        exchangeEnabled:       body.exchangeEnabled      ?? false,
        exchangeBrand:         body.exchangeBrand         ?? null,
        exchangeVehicleNumber: body.exchangeVehicleNumber ?? null,
        exchangeValue:         n(body.exchangeValue),

        grandTotal: n(body.grandTotal),
        salesType:  body.salesType ?? 'CASH',

        financeType:        body.financeType        ?? null,
        financerId:         body.financerId          ?? null,
        financePersonName:  body.financePersonName   ?? null,
        financePersonPhone: body.financePersonPhone  ?? null,
        financeAmount:      n(body.financeAmount),
        deliveryOrderNumber: body.deliveryOrderNumber ?? null,

        mrnNumber:     body.mrnNumber     ?? null,
        bookingAmount: n(body.bookingAmount),
        pendingAmount: n(body.pendingAmount),

        hpEnabled: body.hpEnabled ?? false,
        hpAmount:  n(body.hpAmount),

        referredByType:       body.referredByType       ?? null,
        referredByEmployeeId: body.referredByEmployeeId ?? null,
        ownerName:            body.ownerName             ?? null,
        remarks:              body.remarks               ?? null,

        status:           'DRAFT',
        bookingDate:      body.bookingDate ? new Date(body.bookingDate) : now,
        salesExecutiveId: body.salesExecutiveId ?? null,
      })
      .returning()

    // ── 3. Update vehicle status to BOOKED ────────────────────────────────────
    if (body.vehicleId) {
      await tx
        .update(vehicleInventory)
        .set({ status: 'BOOKED' })
        .where(
          and(
            eq(vehicleInventory.id, body.vehicleId),
            eq(vehicleInventory.tenantId, tenant.id),
          ),
        )
    }

    return newBooking
  })
  } catch (e) {
    console.error('bookings POST error:', e)
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Link the MRN receipt to this booking (if MRN was looked up on the form)
  const mrnToLink = body.mrnNumber?.trim()?.toUpperCase()
  if (mrnToLink) {
    await db
      .update(mrnReceipts)
      .set({ bookingId: booking.id })
      .where(and(eq(mrnReceipts.tenantId, tenant.id), eq(mrnReceipts.mrnNumber, mrnToLink)))
      .catch(e => console.error('[mrn-link] failed to link MRN to booking', mrnToLink, e))
  }

  logAudit({
    tenantId: tenant.id,
    userId,
    action:   'BOOKING_CREATED',
    module:   'Sales',
    recordId: booking.id,
    details:  { bookingNumber: booking.bookingNumber, grandTotal: booking.grandTotal, salesType: booking.salesType },
  })

  return NextResponse.json(booking, { status: 201 })
}

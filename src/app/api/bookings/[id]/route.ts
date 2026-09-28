export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { bookings, bookingStatusEnum } from '@/db/schema/bookings'
import { requireTenant } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'

type Ctx = { params: Promise<{ id: string }> }

const STATUSES = bookingStatusEnum.enumValues
const TERMINAL = new Set(['DELIVERED', 'CANCELLED'])

function n(v: unknown): string {
  return v !== undefined && v !== null ? String(v) : '0'
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, id), eq(bookings.tenantId, tenant.id)),
    with: {
      customer: { columns: { id: true, name: true, phone: true, email: true, city: true, state: true } },
      vehicle: {
        with: {
          variant: { with: { model: true } },
          color: true,
          location: true,
        },
      },
      location: true,
      financer: true,
      salesExecutive: true,
      discountApprovedBy: true,
      referredByEmployee: true,
      mrnReceipts: true,
    },
  })

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  return NextResponse.json(booking)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params
  const filter = and(eq(bookings.id, id), eq(bookings.tenantId, tenant.id))

  const [existing] = await db
    .select({ status: bookings.status })
    .from(bookings)
    .where(filter)
    .limit(1)

  if (!existing) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (TERMINAL.has(existing.status)) {
    return NextResponse.json(
      { error: `Cannot update a ${existing.status} booking` },
      { status: 400 },
    )
  }

  const body = await req.json()
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  const numericFields = [
    'exShowroomPrice', 'rtoAmount', 'insuranceAmount', 'onRoadPrice',
    'addonPrice', 'extendedWarranty', 'amc', 'handlingCharges', 'etcCharges', 'subTotal',
    'discountAmount', 'exchangeValue', 'grandTotal',
    'financeAmount', 'bookingAmount', 'pendingAmount', 'hpAmount',
  ] as const
  for (const f of numericFields) {
    if (body[f] !== undefined) updates[f] = n(body[f])
  }

  const textFields = [
    'customerId', 'vehicleId', 'locationId', 'mrnNumber',
    'discountCategory', 'discountRemarks', 'discountApprovedBy',
    'exchangeBrand', 'exchangeVehicleNumber',
    'financerId', 'financePersonName', 'financePersonPhone', 'deliveryOrderNumber',
    'bookingAmount', 'ownerName', 'remarks',
    'referredByEmployeeId', 'salesExecutiveId',
  ] as const
  for (const f of textFields) {
    if (body[f] !== undefined) updates[f] = body[f] ?? null
  }

  const enumFields = ['salesType', 'discountType', 'financeType', 'referredByType'] as const
  for (const f of enumFields) {
    if (body[f] !== undefined) updates[f] = body[f]
  }

  const boolFields = ['discountEnabled', 'exchangeEnabled', 'hpEnabled'] as const
  for (const f of boolFields) {
    if (body[f] !== undefined) updates[f] = Boolean(body[f])
  }

  if (body.accessories !== undefined) updates.accessories = body.accessories
  if (body.bookingDate !== undefined) updates.bookingDate = new Date(body.bookingDate)

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const [updated] = await db.update(bookings).set(updates).where(filter).returning()
  return NextResponse.json(updated)
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { tenant, userId, err } = await requireTenant()
  if (err) return err

  const { id } = await params
  const filter = and(eq(bookings.id, id), eq(bookings.tenantId, tenant.id))

  const [existing] = await db
    .select({ status: bookings.status })
    .from(bookings)
    .where(filter)
    .limit(1)

  if (!existing) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (TERMINAL.has(existing.status)) {
    return NextResponse.json(
      { error: `Cannot change status of a ${existing.status} booking` },
      { status: 400 },
    )
  }

  const { status } = await req.json() as { status?: string }

  if (!status) return NextResponse.json({ error: 'status is required' }, { status: 400 })
  if (!STATUSES.includes(status as typeof STATUSES[number])) {
    return NextResponse.json(
      { error: `status must be one of: ${STATUSES.join(', ')}` },
      { status: 400 },
    )
  }
  if (status === 'DELIVERED') {
    return NextResponse.json(
      { error: 'Use POST /bookings/:id/deliver to mark as delivered' },
      { status: 400 },
    )
  }

  const [updated] = await db
    .update(bookings)
    .set({ status: status as typeof STATUSES[number], updatedAt: new Date() })
    .where(filter)
    .returning()

  logAudit({
    tenantId: tenant.id,
    userId,
    action:   'BOOKING_STATUS_CHANGED',
    module:   'Sales',
    recordId: id,
    details:  { from: existing.status, to: status },
  })

  return NextResponse.json(updated)
}

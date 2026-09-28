export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { serviceBookings, serviceBookingItems, serviceStatusEnum } from '@/db/schema/services'
import { requireTenant } from '@/lib/api-auth'

type Ctx = { params: Promise<{ id: string }> }

const STATUSES = serviceStatusEnum.enumValues
const TERMINAL = new Set(['COMPLETED', 'CANCELLED', 'DELIVERED'])

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  const booking = await db.query.serviceBookings.findFirst({
    where: and(eq(serviceBookings.id, id), eq(serviceBookings.tenantId, tenant.id)),
    with: {
      customer:    true,
      serviceType: true,
      technician:  true,
      location:    true,
      createdBy:   true,
      items:       true,
    },
  })

  if (!booking) return NextResponse.json({ error: 'Service booking not found' }, { status: 404 })
  return NextResponse.json(booking)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params
  const filter = and(eq(serviceBookings.id, id), eq(serviceBookings.tenantId, tenant.id))

  const [existing] = await db
    .select({ status: serviceBookings.status })
    .from(serviceBookings)
    .where(filter)
    .limit(1)

  if (!existing) return NextResponse.json({ error: 'Service booking not found' }, { status: 404 })
  if (TERMINAL.has(existing.status)) {
    return NextResponse.json(
      { error: `Cannot update a ${existing.status} service booking` },
      { status: 400 },
    )
  }

  const body = await req.json() as Record<string, unknown>
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  const nullableText = [
    'customerId', 'serviceTypeId', 'technicianId', 'locationId',
    'vehicleFrameNumber', 'vehicleRegNumber', 'vehicleModel',
    'vehicleVariant', 'vehicleColor', 'vehicleEngineNumber',
    'mrnNumber', 'notes',
    'discountCategory', 'discountRemarks',
    'insuranceCompany', 'insurancePersonName', 'insurancePersonPhone', 'deliveryOrderNo',
  ]
  for (const f of nullableText) {
    if (body[f] !== undefined) updates[f] = body[f] ? String(body[f]).trim() || null : null
  }

  const numericFields = ['subTotal', 'discount', 'advanceAmount', 'discountValue', 'insuranceAmount']
  for (const f of numericFields) {
    if (body[f] !== undefined) updates[f] = body[f] != null ? String(Number(body[f])) : null
  }

  if (body.scheduledDate !== undefined) updates.scheduledDate = new Date(body.scheduledDate as string)
  if (body.bookingDate  !== undefined) updates.bookingDate  = body.bookingDate ? new Date(body.bookingDate as string) : null
  if (body.discountType !== undefined) updates.discountType = body.discountType || null
  if (body.paymentType  !== undefined) updates.paymentType  = body.paymentType === 'INSURANCE' ? 'INSURANCE' : 'CASH'

  const lineItems = body.lineItems as Array<{ itemName: string; amount: number; isGstApplicable?: boolean; gstPercent?: number }> | undefined

  if (Object.keys(updates).length === 1 && !lineItems) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const [updated] = await db.transaction(async (tx) => {
    const [row] = await tx.update(serviceBookings).set(updates).where(filter).returning()

    if (lineItems !== undefined) {
      await tx.delete(serviceBookingItems).where(
        and(eq(serviceBookingItems.serviceBookingId, id), eq(serviceBookingItems.tenantId, tenant.id))
      )
      const nonZero = lineItems.filter(item => Number(item.amount) > 0)
      if (nonZero.length > 0) {
        await tx.insert(serviceBookingItems).values(
          nonZero.map((item, idx) => ({
            tenantId:         tenant.id,
            serviceBookingId: id,
            itemName:         item.itemName,
            isGstApplicable:  item.isGstApplicable ?? true,
            gstPercent:       String(item.gstPercent ?? 18),
            amount:           String(Number(item.amount) || 0),
            sortOrder:        idx,
          }))
        )
      }
    }

    return [row]
  })

  return NextResponse.json(updated)
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params
  const filter = and(eq(serviceBookings.id, id), eq(serviceBookings.tenantId, tenant.id))

  const [existing] = await db
    .select({ status: serviceBookings.status })
    .from(serviceBookings)
    .where(filter)
    .limit(1)

  if (!existing) return NextResponse.json({ error: 'Service booking not found' }, { status: 404 })
  if (TERMINAL.has(existing.status)) {
    return NextResponse.json(
      { error: `Cannot change status of a ${existing.status} service booking` },
      { status: 400 },
    )
  }

  const { status } = (await req.json()) as { status?: string }

  if (!status) return NextResponse.json({ error: 'status is required' }, { status: 400 })
  if (!STATUSES.includes(status as typeof STATUSES[number])) {
    return NextResponse.json(
      { error: `status must be one of: ${STATUSES.join(', ')}` },
      { status: 400 },
    )
  }
  if (status === 'COMPLETED') {
    return NextResponse.json(
      { error: 'Use POST /services/:id/complete to mark as completed' },
      { status: 400 },
    )
  }
  if (status === 'DELIVERED') {
    return NextResponse.json(
      { error: 'Use POST /services/:id/deliver to mark as delivered' },
      { status: 400 },
    )
  }

  const [updated] = await db
    .update(serviceBookings)
    .set({ status: status as typeof STATUSES[number], updatedAt: new Date() })
    .where(filter)
    .returning()

  return NextResponse.json(updated)
}

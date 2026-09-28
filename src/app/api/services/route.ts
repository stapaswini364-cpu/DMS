export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and, count, gte, lt } from 'drizzle-orm'
import { db } from '@/db'
import { serviceBookings, serviceBookingItems, serviceStatusEnum } from '@/db/schema/services'
import { mrnReceipts } from '@/db/schema/bookings'
import { requireTenant } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'

const STATUSES = serviceStatusEnum.enumValues

function dateStr(d: Date) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('')
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

  const rows = await db.query.serviceBookings.findMany({
    where: statusParam
      ? and(
          eq(serviceBookings.tenantId, tenant.id),
          eq(serviceBookings.status, statusParam as typeof STATUSES[number]),
        )
      : eq(serviceBookings.tenantId, tenant.id),
    columns: {
      id: true,
      jobCardNumber: true,
      vehicleModel: true,
      vehicleFrameNumber: true,
      vehicleRegNumber: true,
      vehicleVariant: true,
      vehicleColor: true,
      vehicleEngineNumber: true,
      status: true,
      scheduledDate: true,
      subTotal: true,
      finalNetAmount: true,
      createdAt: true,
    },
    with: {
      customer:    { columns: { id: true, name: true, phone: true, email: true } },
      serviceType: { columns: { id: true, name: true } },
      technician:  { columns: { id: true, name: true, specialization: true } },
      location:    { columns: { id: true, name: true } },
    },
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  })

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { tenant, userId, err } = await requireTenant()
  if (err) return err

  const body = await req.json()
  const {
    jobCardNumber: providedJobCardNumber,
    bookingDate,
    customerId,
    vehicleModel,
    locationId,
    scheduledDate,
    vehicleFrameNumber,
    vehicleRegNumber,
    vehicleVariant,
    vehicleColor,
    vehicleEngineNumber,
    serviceTypeId,
    technicianId,
    notes,
    lineItems,
    discountCategory,
    discountType,
    discountValue,
    discountRemarks,
    mrnNumber,
    advanceAmount,
    paymentType,
    insuranceCompany,
    insurancePersonName,
    insurancePersonPhone,
    insuranceAmount,
    deliveryOrderNo,
  } = body as {
    jobCardNumber?: string
    bookingDate?: string
    customerId?: string
    vehicleModel?: string
    locationId?: string
    scheduledDate?: string
    vehicleFrameNumber?: string
    vehicleRegNumber?: string
    vehicleVariant?: string
    vehicleColor?: string
    vehicleEngineNumber?: string
    serviceTypeId?: string
    technicianId?: string
    notes?: string
    lineItems?: Array<{ itemName: string; amount: number; isGstApplicable?: boolean; gstPercent?: number }>
    discountCategory?: string
    discountType?: 'FLAT' | 'PERCENTAGE'
    discountValue?: number
    discountRemarks?: string
    mrnNumber?: string
    advanceAmount?: number
    paymentType?: 'CASH' | 'INSURANCE'
    insuranceCompany?: string
    insurancePersonName?: string
    insurancePersonPhone?: string
    insuranceAmount?: number
    deliveryOrderNo?: string
  }

  if (!customerId)    return NextResponse.json({ error: 'customerId is required' }, { status: 400 })
  if (!vehicleModel)  return NextResponse.json({ error: 'vehicleModel is required' }, { status: 400 })
  if (!locationId)    return NextResponse.json({ error: 'locationId is required' }, { status: 400 })
  if (!scheduledDate) return NextResponse.json({ error: 'scheduledDate is required' }, { status: 400 })

  // Auto-generate job card number if not provided
  let jobCardNumber = providedJobCardNumber?.trim() || ''
  if (!jobCardNumber) {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrowStart = new Date(todayStart.getTime() + 86_400_000)

    const [{ dailyCount }] = await db
      .select({ dailyCount: count() })
      .from(serviceBookings)
      .where(
        and(
          eq(serviceBookings.tenantId, tenant.id),
          gte(serviceBookings.createdAt, todayStart),
          lt(serviceBookings.createdAt, tomorrowStart),
        ),
      )

    jobCardNumber = `JOB-${dateStr(now)}-${String(Number(dailyCount) + 1).padStart(4, '0')}`
  }

  // Calculate totals server-side
  const items = Array.isArray(lineItems) ? lineItems : []
  const subTotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  let calculatedDiscount = 0
  if (discountType && discountValue && Number(discountValue) > 0) {
    calculatedDiscount = discountType === 'PERCENTAGE'
      ? (subTotal * Number(discountValue)) / 100
      : Number(discountValue)
  }

  const advance = Number(advanceAmount) || 0
  const finalNetAmount = Math.max(0, subTotal - calculatedDiscount - advance)

  try {
    const booking = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(serviceBookings)
        .values({
          tenantId:           tenant.id,
          jobCardNumber,
          customerId,
          vehicleFrameNumber:  vehicleFrameNumber?.trim()  || null,
          vehicleRegNumber:    vehicleRegNumber?.trim()    || null,
          vehicleModel:        vehicleModel.trim(),
          vehicleVariant:      vehicleVariant?.trim()      || null,
          vehicleColor:        vehicleColor?.trim()        || null,
          vehicleEngineNumber: vehicleEngineNumber?.trim() || null,
          serviceTypeId:      serviceTypeId  ?? null,
          technicianId:       technicianId   ?? null,
          locationId,
          scheduledDate:      new Date(scheduledDate),
          bookingDate:        bookingDate ? new Date(bookingDate) : null,
          status:             'PENDING',
          subTotal:           String(subTotal),
          discount:           String(calculatedDiscount),
          discountCategory:   discountCategory?.trim()  || null,
          discountType:       discountType               ?? null,
          discountValue:      discountValue != null ? String(Number(discountValue)) : null,
          discountRemarks:    discountRemarks?.trim()    || null,
          mrnNumber:          mrnNumber?.trim().toUpperCase() || null,
          advanceAmount:      String(advance),
          mrnAmount:          '0',
          finalNetAmount:     String(finalNetAmount),
          paymentType:          (paymentType === 'INSURANCE' ? 'INSURANCE' : 'CASH') as 'CASH' | 'INSURANCE',
          insuranceCompany:     paymentType === 'INSURANCE' ? insuranceCompany?.trim()     || null : null,
          insurancePersonName:  paymentType === 'INSURANCE' ? insurancePersonName?.trim()  || null : null,
          insurancePersonPhone: paymentType === 'INSURANCE' ? insurancePersonPhone?.trim() || null : null,
          insuranceAmount:      paymentType === 'INSURANCE' && insuranceAmount != null ? String(Number(insuranceAmount)) : null,
          deliveryOrderNo:      paymentType === 'INSURANCE' ? deliveryOrderNo?.trim()      || null : null,
          notes:              notes?.trim()  ?? null,
          createdBy:          null,
        })
        .returning()

      const nonZeroItems = items.filter(item => Number(item.amount) > 0)
      if (nonZeroItems.length > 0) {
        await tx.insert(serviceBookingItems).values(
          nonZeroItems.map((item, idx) => ({
            tenantId:         tenant.id,
            serviceBookingId: created.id,
            itemName:         item.itemName,
            isGstApplicable:  item.isGstApplicable ?? true,
            gstPercent:       String(item.gstPercent ?? 18),
            amount:           String(Number(item.amount) || 0),
            sortOrder:        idx,
          })),
        )
      }

      return created
    })

    // Link the MRN receipt to this service booking (if MRN was looked up on the form)
    const mrnToLink = mrnNumber?.trim()?.toUpperCase()
    if (mrnToLink) {
      await db
        .update(mrnReceipts)
        .set({ serviceBookingId: booking.id })
        .where(and(eq(mrnReceipts.tenantId, tenant.id), eq(mrnReceipts.mrnNumber, mrnToLink)))
        .catch(e => console.error('[mrn-link] failed to link MRN to service booking', mrnToLink, e))
    }

    logAudit({
      tenantId: tenant.id,
      userId,
      action:   'SERVICE_CREATED',
      module:   'Service',
      recordId: booking.id,
      details:  { jobCardNumber: booking.jobCardNumber, vehicleModel: booking.vehicleModel },
    })

    return NextResponse.json(booking, { status: 201 })
  } catch (e) {
    console.error('services POST error:', e)
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

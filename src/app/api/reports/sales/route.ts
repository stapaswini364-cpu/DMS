export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { db } from '@/db'
import { bookings } from '@/db/schema/bookings'
import { customers, vehicleInventory, productVariants, productModels, productColors, financers } from '@/db/schema/inventory'
import { locations } from '@/db/schema/auth'
import { requireTenant } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const fromDate = req.nextUrl.searchParams.get('fromDate')
  const toDate   = req.nextUrl.searchParams.get('toDate')

  if (!fromDate || !toDate) {
    return NextResponse.json({ error: 'fromDate and toDate are required' }, { status: 400 })
  }

  try {
    const rows = await db
      .select({
        bookingNumber:      bookings.bookingNumber,
        bookingDate:        bookings.bookingDate,
        status:             bookings.status,
        salesType:          bookings.salesType,
        locationName:       locations.name,
        customerName:       customers.name,
        customerPhone:      customers.phone,
        customerEmail:      customers.email,
        customerAddress:    customers.address,
        customerState:      customers.state,
        customerPincode:    customers.pincode,
        frameNumber:        vehicleInventory.frameNumber,
        engineNumber:       vehicleInventory.engineNumber,
        modelName:          productModels.name,
        variantName:        productVariants.name,
        colorName:          productColors.colorName,
        exShowroomPrice:    bookings.exShowroomPrice,
        rtoAmount:          bookings.rtoAmount,
        insuranceAmount:    bookings.insuranceAmount,
        onRoadPrice:        bookings.onRoadPrice,
        extendedWarranty:   bookings.extendedWarranty,
        amc:                bookings.amc,
        handlingCharges:    bookings.handlingCharges,
        etcCharges:         bookings.etcCharges,
        addonPrice:         bookings.addonPrice,
        subTotal:           bookings.subTotal,
        discountType:       bookings.discountType,
        discountAmount:     bookings.discountAmount,
        grandTotal:         bookings.grandTotal,
        exchangeVehicleNumber: bookings.exchangeVehicleNumber,
        exchangeBrand:      bookings.exchangeBrand,
        exchangeValue:      bookings.exchangeValue,
        financeType:        bookings.financeType,
        financerName:       financers.name,
        financePersonName:  bookings.financePersonName,
        financePersonPhone: bookings.financePersonPhone,
        financeAmount:      bookings.financeAmount,
        deliveryOrderNumber: bookings.deliveryOrderNumber,
        bookingAmount:      bookings.bookingAmount,
        hpAmount:           bookings.hpAmount,
        pendingAmount:      bookings.pendingAmount,
      })
      .from(bookings)
      .leftJoin(customers,         eq(bookings.customerId,         customers.id))
      .leftJoin(vehicleInventory,  eq(bookings.vehicleId,          vehicleInventory.id))
      .leftJoin(productVariants,   eq(vehicleInventory.variantId,  productVariants.id))
      .leftJoin(productModels,     eq(productVariants.modelId,     productModels.id))
      .leftJoin(productColors,     eq(vehicleInventory.colorId,    productColors.id))
      .leftJoin(financers,         eq(bookings.financerId,         financers.id))
      .leftJoin(locations,         eq(bookings.locationId,         locations.id))
      .where(and(
        eq(bookings.tenantId, tenant.id),
        gte(bookings.bookingDate, new Date(fromDate + 'T00:00:00.000Z')),
        lte(bookings.bookingDate, new Date(toDate   + 'T23:59:59.999Z')),
      ))
      .orderBy(desc(bookings.bookingDate))

    return NextResponse.json(rows)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[reports/sales] DB error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

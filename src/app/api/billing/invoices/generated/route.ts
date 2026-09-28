export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { invoices } from '@/db/schema/invoices'
import { bookings } from '@/db/schema/bookings'
import { serviceBookings } from '@/db/schema/services'
import { customers } from '@/db/schema/inventory'
import { requireTenant } from '@/lib/api-auth'

export async function GET() {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const [salesRows, serviceRows] = await Promise.all([
    db
      .select({
        id:            invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        generatedAt:   invoices.generatedAt,
        bookingId:     invoices.bookingId,
        bookingNumber: bookings.bookingNumber,
        grandTotal:    bookings.grandTotal,
        bookingDate:   bookings.bookingDate,
        customerName:  customers.name,
        customerPhone: customers.phone,
      })
      .from(invoices)
      .leftJoin(bookings,   eq(invoices.bookingId, bookings.id))
      .leftJoin(customers,  eq(bookings.customerId, customers.id))
      .where(and(eq(invoices.tenantId, tenant.id), isNotNull(invoices.bookingId)))
      .orderBy(desc(invoices.generatedAt)),

    db
      .select({
        id:               invoices.id,
        invoiceNumber:    invoices.invoiceNumber,
        generatedAt:      invoices.generatedAt,
        serviceBookingId: invoices.serviceBookingId,
        bookingNumber:    serviceBookings.jobCardNumber,
        grandTotal:       serviceBookings.finalNetAmount,
        bookingDate:      serviceBookings.bookingDate,
        customerName:     customers.name,
        customerPhone:    customers.phone,
      })
      .from(invoices)
      .leftJoin(serviceBookings, eq(invoices.serviceBookingId, serviceBookings.id))
      .leftJoin(customers,       eq(serviceBookings.customerId, customers.id))
      .where(and(eq(invoices.tenantId, tenant.id), isNotNull(invoices.serviceBookingId), isNull(invoices.bookingId)))
      .orderBy(desc(invoices.generatedAt)),
  ])

  const sales = salesRows.map(r => ({
    id:            r.id,
    bookingType:   'SALES' as const,
    invoiceNumber: r.invoiceNumber,
    generatedAt:   r.generatedAt.toISOString(),
    bookingId:     r.bookingId,
    bookingNumber: r.bookingNumber ?? '—',
    grandTotal:    r.grandTotal ?? '0',
    bookingDate:   r.bookingDate?.toISOString() ?? null,
    customer:      r.customerName ? { name: r.customerName, phone: r.customerPhone ?? '' } : null,
  }))

  const service = serviceRows.map(r => ({
    id:            r.id,
    bookingType:   'SERVICE' as const,
    invoiceNumber: r.invoiceNumber,
    generatedAt:   r.generatedAt.toISOString(),
    bookingId:     r.serviceBookingId,
    bookingNumber: r.bookingNumber ?? '—',
    grandTotal:    r.grandTotal ?? '0',
    bookingDate:   r.bookingDate?.toISOString() ?? null,
    customer:      r.customerName ? { name: r.customerName, phone: r.customerPhone ?? '' } : null,
  }))

  const all = [...sales, ...service].sort(
    (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime(),
  )

  return NextResponse.json(all)
}

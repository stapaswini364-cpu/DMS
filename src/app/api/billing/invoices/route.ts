export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, ilike, isNull, or } from 'drizzle-orm'
import { db } from '@/db'
import { bookings } from '@/db/schema/bookings'
import { serviceBookings } from '@/db/schema/services'
import { customers, vehicleInventory } from '@/db/schema/inventory'
import { invoices } from '@/db/schema/invoices'
import { requireTenant } from '@/lib/api-auth'

// GET: bookings (sales + service) that are invoiceable and NOT yet invoiced.
// Accepts optional ?search= for ILIKE filtering.
export async function GET(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const search = req.nextUrl.searchParams.get('search')?.trim() ?? ''
  const q      = search ? `%${search}%` : null

  try {
  // ── Sales bookings (CONFIRMED | DELIVERED, no invoice yet) ─────────────────
  const salesRows = await db
    .select({
      id:           bookings.id,
      bookingNumber: bookings.bookingNumber,
      status:       bookings.status,
      salesType:    bookings.salesType,
      grandTotal:   bookings.grandTotal,
      bookingDate:  bookings.bookingDate,
      createdAt:    bookings.createdAt,
      customerName:  customers.name,
      customerPhone: customers.phone,
      customerEmail: customers.email,
      frameNumber:  vehicleInventory.frameNumber,
    })
    .from(bookings)
    .leftJoin(customers,         eq(bookings.customerId,  customers.id))
    .leftJoin(vehicleInventory,  eq(bookings.vehicleId,   vehicleInventory.id))
    .leftJoin(invoices,          eq(invoices.bookingId,   bookings.id))
    .where(and(
      eq(bookings.tenantId, tenant.id),
      or(eq(bookings.status, 'CONFIRMED'), eq(bookings.status, 'DELIVERED')),
      isNull(invoices.id),
      q ? or(
        ilike(customers.name,              q),
        ilike(customers.phone,             q),
        ilike(customers.email,             q),
        ilike(vehicleInventory.frameNumber, q),
      ) : undefined,
    ))
    .orderBy(desc(bookings.createdAt))

  // ── Service bookings (COMPLETED | DELIVERED, no invoice yet) ──────────────
  const serviceRows = await db
    .select({
      id:           serviceBookings.id,
      bookingNumber: serviceBookings.jobCardNumber,
      status:       serviceBookings.status,
      grandTotal:   serviceBookings.finalNetAmount,
      bookingDate:  serviceBookings.bookingDate,
      createdAt:    serviceBookings.createdAt,
      customerName:  customers.name,
      customerPhone: customers.phone,
      customerEmail: customers.email,
      frameNumber:  serviceBookings.vehicleFrameNumber,
      vehicleModel: serviceBookings.vehicleModel,
    })
    .from(serviceBookings)
    .leftJoin(customers,  eq(serviceBookings.customerId, customers.id))
    .leftJoin(invoices,   eq(invoices.serviceBookingId,  serviceBookings.id))
    .where(and(
      eq(serviceBookings.tenantId, tenant.id),
      or(eq(serviceBookings.status, 'COMPLETED'), eq(serviceBookings.status, 'DELIVERED')),
      isNull(invoices.id),
      q ? or(
        ilike(customers.name,              q),
        ilike(customers.phone,             q),
        ilike(customers.email,             q),
        ilike(serviceBookings.vehicleFrameNumber, q),
        ilike(serviceBookings.jobCardNumber,      q),
      ) : undefined,
    ))
    .orderBy(desc(serviceBookings.createdAt))

  // ── Merge and sort by date desc ────────────────────────────────────────────
  const sales = salesRows.map(r => ({
    id:           r.id,
    bookingType:  'SALES' as const,
    bookingNumber: r.bookingNumber,
    status:       r.status,
    salesType:    r.salesType as string,
    grandTotal:   r.grandTotal,
    bookingDate:  r.bookingDate?.toISOString() ?? '',
    createdAt:    r.createdAt.toISOString(),
    customer:     r.customerName
      ? { name: r.customerName, phone: r.customerPhone ?? '', email: r.customerEmail ?? null }
      : null,
    frameNumber:  r.frameNumber ?? null,
    vehicleLabel: null as string | null,
  }))

  const service = serviceRows.map(r => ({
    id:           r.id,
    bookingType:  'SERVICE' as const,
    bookingNumber: r.bookingNumber,
    status:       r.status,
    salesType:    'SERVICE',
    grandTotal:   r.grandTotal ?? '0',
    bookingDate:  (r.bookingDate ?? r.createdAt)?.toISOString() ?? '',
    createdAt:    r.createdAt.toISOString(),
    customer:     r.customerName
      ? { name: r.customerName, phone: r.customerPhone ?? '', email: r.customerEmail ?? null }
      : null,
    frameNumber:  r.frameNumber ?? null,
    vehicleLabel: r.vehicleModel ?? null,
  }))

  const all = [...sales, ...service].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return NextResponse.json(all)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[billing/invoices] DB error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

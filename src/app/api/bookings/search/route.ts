export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and, or, ilike, ne } from 'drizzle-orm'
import { db } from '@/db'
import { bookings } from '@/db/schema/bookings'
import { serviceBookings } from '@/db/schema/services'
import { customers } from '@/db/schema/inventory'
import { requireTenant } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  const [saleRows, serviceRows] = await Promise.all([
    db
      .select({
        id:            bookings.id,
        bookingNumber: bookings.bookingNumber,
        status:        bookings.status,
        customerName:  customers.name,
        customerPhone: customers.phone,
      })
      .from(bookings)
      .leftJoin(customers, eq(bookings.customerId, customers.id))
      .where(
        and(
          eq(bookings.tenantId, tenant.id),
          ne(bookings.status, 'CANCELLED'),
          or(
            ilike(bookings.bookingNumber, `%${q}%`),
            ilike(customers.name, `%${q}%`),
            ilike(customers.phone, `%${q}%`),
          ),
        ),
      )
      .limit(8),

    db
      .select({
        id:            serviceBookings.id,
        bookingNumber: serviceBookings.jobCardNumber,
        status:        serviceBookings.status,
        customerName:  customers.name,
        customerPhone: customers.phone,
      })
      .from(serviceBookings)
      .leftJoin(customers, eq(serviceBookings.customerId, customers.id))
      .where(
        and(
          eq(serviceBookings.tenantId, tenant.id),
          or(
            ilike(serviceBookings.jobCardNumber, `%${q}%`),
            ilike(customers.name, `%${q}%`),
            ilike(customers.phone, `%${q}%`),
          ),
        ),
      )
      .limit(8),
  ])

  const results = [
    ...saleRows.map(r => ({ ...r, bookingType: 'sale' as const })),
    ...serviceRows.map(r => ({ ...r, bookingType: 'service' as const })),
  ]

  return NextResponse.json(results)
}

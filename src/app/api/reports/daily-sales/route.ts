export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { sql, and, eq, gte, lt } from 'drizzle-orm'
import { db } from '@/db'
import { bookings } from '@/db/schema/bookings'
import { requireTenant } from '@/lib/api-auth'

function dayRange(dateParam: string | null): [Date, Date] {
  const d = dateParam ? new Date(dateParam) : new Date()
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return [start, new Date(start.getTime() + 86_400_000)]
}

export async function GET(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const dateParam = new URL(req.url).searchParams.get('date')
  const [dayStart, dayEnd] = dayRange(dateParam)

  const tenantDay = and(
    eq(bookings.tenantId, tenant.id),
    gte(bookings.bookingDate, dayStart),
    lt(bookings.bookingDate, dayEnd),
  )

  // ── Aggregated stats ──────────────────────────────────────────────────────
  const [stats] = await db
    .select({
      total:       sql<number>`count(*)::int`,
      draft:       sql<number>`count(*) filter (where ${bookings.status} = 'DRAFT')::int`,
      confirmed:   sql<number>`count(*) filter (where ${bookings.status} = 'CONFIRMED')::int`,
      delivered:   sql<number>`count(*) filter (where ${bookings.status} = 'DELIVERED')::int`,
      cancelled:   sql<number>`count(*) filter (where ${bookings.status} = 'CANCELLED')::int`,
      totalValue:  sql<string>`coalesce(sum(${bookings.grandTotal}), 0)::text`,
      cashValue:   sql<string>`coalesce(sum(${bookings.grandTotal}) filter (where ${bookings.salesType} = 'CASH'), 0)::text`,
      financeValue: sql<string>`coalesce(sum(${bookings.grandTotal}) filter (where ${bookings.salesType} = 'FINANCE'), 0)::text`,
    })
    .from(bookings)
    .where(tenantDay)

  // ── Booking list with joins ───────────────────────────────────────────────
  const list = await db.query.bookings.findMany({
    where: tenantDay,
    columns: {
      id: true, bookingNumber: true, status: true, salesType: true,
      grandTotal: true, bookingAmount: true, pendingAmount: true,
      bookingDate: true,
    },
    with: {
      customer: { columns: { id: true, name: true, phone: true } },
      vehicle: {
        columns: { id: true, frameNumber: true },
        with: {
          variant: { columns: { name: true }, with: { model: { columns: { name: true, brand: true } } } },
          color:   { columns: { colorName: true } },
        },
      },
    },
    orderBy: (b, { desc }) => [desc(b.createdAt)],
  })

  return NextResponse.json({
    date:     dayStart.toISOString().slice(0, 10),
    summary:  stats,
    bookings: list,
  })
}

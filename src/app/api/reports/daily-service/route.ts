export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { sql, and, eq, gte, lt } from 'drizzle-orm'
import { db } from '@/db'
import { serviceBookings } from '@/db/schema/services'
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
    eq(serviceBookings.tenantId, tenant.id),
    gte(serviceBookings.scheduledDate, dayStart),
    lt(serviceBookings.scheduledDate, dayEnd),
  )

  // ── Aggregated stats ──────────────────────────────────────────────────────
  const [stats] = await db
    .select({
      total:           sql<number>`count(*)::int`,
      pending:         sql<number>`count(*) filter (where ${serviceBookings.status} = 'PENDING')::int`,
      inProgress:      sql<number>`count(*) filter (where ${serviceBookings.status} = 'IN_PROGRESS')::int`,
      completed:       sql<number>`count(*) filter (where ${serviceBookings.status} = 'COMPLETED')::int`,
      cancelled:       sql<number>`count(*) filter (where ${serviceBookings.status} = 'CANCELLED')::int`,
      waitingForParts: sql<number>`count(*) filter (where ${serviceBookings.status} = 'WAITING_FOR_PARTS')::int`,
      totalValue:      sql<string>`coalesce(sum(${serviceBookings.finalNetAmount}) filter (where ${serviceBookings.status} = 'COMPLETED'), 0)::text`,
    })
    .from(serviceBookings)
    .where(tenantDay)

  // ── Service booking list with joins ───────────────────────────────────────
  const list = await db.query.serviceBookings.findMany({
    where: tenantDay,
    columns: {
      id: true, jobCardNumber: true, status: true,
      vehicleModel: true, vehicleFrameNumber: true, vehicleRegNumber: true,
      scheduledDate: true, subTotal: true, discount: true,
      advanceAmount: true, finalNetAmount: true,
    },
    with: {
      customer:    { columns: { id: true, name: true, phone: true } },
      technician:  { columns: { id: true, name: true, specialization: true } },
      serviceType: { columns: { id: true, name: true } },
      location:    { columns: { id: true, name: true } },
    },
    orderBy: (s, { asc }) => [asc(s.scheduledDate)],
  })

  return NextResponse.json({
    date:     dayStart.toISOString().slice(0, 10),
    summary:  stats,
    bookings: list,
  })
}

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { and, eq, gte, lte, or, gt } from 'drizzle-orm'
import { db } from '@/db'
import { serviceBookings } from '@/db/schema/services'
import { requireTenant } from '@/lib/api-auth'

const TDS_RATE      = 0.10
const TDS_THRESHOLD = 30_000

export async function GET(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { searchParams } = new URL(req.url)
  const startParam = searchParams.get('startDate')
  const endParam   = searchParams.get('endDate')

  if (startParam && isNaN(Date.parse(startParam)))
    return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 })
  if (endParam && isNaN(Date.parse(endParam)))
    return NextResponse.json({ error: 'Invalid endDate' }, { status: 400 })

  const now   = new Date()
  const start = startParam
    ? new Date(startParam + 'T00:00:00.000Z')
    : new Date(now.getFullYear(), now.getMonth(), 1)
  const end   = endParam
    ? new Date(endParam   + 'T23:59:59.999Z')
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const rows = await db.query.serviceBookings.findMany({
    where: and(
      eq(serviceBookings.tenantId, tenant.id),
      eq(serviceBookings.status, 'COMPLETED'),
      gte(serviceBookings.scheduledDate, start),
      lte(serviceBookings.scheduledDate, end),
      gt(serviceBookings.finalNetAmount, String(TDS_THRESHOLD)),
    ),
    columns: {
      id:             true,
      jobCardNumber:  true,
      vehicleModel:   true,
      scheduledDate:  true,
      finalNetAmount: true,
    },
    with: {
      customer:    { columns: { name: true, phone: true } },
      serviceType: { columns: { name: true } },
    },
    orderBy: (s, { asc }) => [asc(s.scheduledDate)],
  })

  let totalAmount = 0
  let totalTDS    = 0

  const tdsRows = rows.map(r => {
    const amount = Number(r.finalNetAmount)
    const tds    = parseFloat((amount * TDS_RATE).toFixed(2))

    totalAmount += amount
    totalTDS    += tds

    return {
      id:           r.id,
      jobCardNumber: r.jobCardNumber,
      customerName:  r.customer?.name  ?? '—',
      customerPhone: r.customer?.phone ?? '',
      serviceType:   r.serviceType?.name ?? '—',
      vehicleModel:  r.vehicleModel,
      scheduledDate: r.scheduledDate,
      amount:        amount.toFixed(2),
      tdsRate:       (TDS_RATE * 100).toFixed(0),
      tdsAmount:     tds.toFixed(2),
    }
  })

  return NextResponse.json({
    startDate:   start.toISOString().slice(0, 10),
    endDate:     end.toISOString().slice(0, 10),
    rows:        tdsRows,
    totalAmount: totalAmount.toFixed(2),
    totalTDS:    totalTDS.toFixed(2),
  })
}

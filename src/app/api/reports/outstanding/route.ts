export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { and, eq, gt, or } from 'drizzle-orm'
import { db } from '@/db'
import { bookings } from '@/db/schema/bookings'
import { requireTenant } from '@/lib/api-auth'

function overdueBucket(daysSince: number): string {
  if (daysSince <= 7)  return '0-7 days'
  if (daysSince <= 30) return '8-30 days'
  if (daysSince <= 60) return '31-60 days'
  return '60+ days'
}

const BUCKET_ORDER = ['0-7 days', '8-30 days', '31-60 days', '60+ days']

export async function GET() {
  const { tenant, err } = await requireTenant()
  if (err) return err

  // ── a) Collection outstanding: bookings with pendingAmount > 0 ────────────
  const collectionRows = await db.query.bookings.findMany({
    where: and(
      eq(bookings.tenantId, tenant.id),
      gt(bookings.pendingAmount, '0'),
      or(eq(bookings.status, 'CONFIRMED'), eq(bookings.status, 'DELIVERED')),
    ),
    columns: {
      id: true, bookingNumber: true, status: true, salesType: true,
      grandTotal: true, bookingAmount: true, pendingAmount: true,
      bookingDate: true,
    },
    with: {
      customer: { columns: { id: true, name: true, phone: true } },
    },
    orderBy: (b, { asc }) => [asc(b.bookingDate)],
  })

  const now = Date.now()

  const bucketed: Record<string, typeof collectionRows> = {
    '0-7 days':   [],
    '8-30 days':  [],
    '31-60 days': [],
    '60+ days':   [],
  }

  let collectionTotal = 0

  for (const b of collectionRows) {
    const daysSince = Math.floor((now - new Date(b.bookingDate).getTime()) / 86_400_000)
    bucketed[overdueBucket(daysSince)].push(b)
    collectionTotal += Number(b.pendingAmount)
  }

  // ── b) Finance outstanding: FINANCE bookings with financeAmount > 0 ───────
  const financeRows = await db.query.bookings.findMany({
    where: and(
      eq(bookings.tenantId, tenant.id),
      eq(bookings.salesType, 'FINANCE'),
      gt(bookings.financeAmount, '0'),
      or(eq(bookings.status, 'CONFIRMED'), eq(bookings.status, 'DELIVERED')),
    ),
    columns: {
      id: true, bookingNumber: true, status: true,
      grandTotal: true, financeAmount: true, financerId: true,
      financeType: true, financePersonName: true,
      deliveryOrderNumber: true, bookingDate: true,
    },
    with: {
      customer: { columns: { id: true, name: true, phone: true } },
      financer: { columns: { id: true, name: true, contactPerson: true, phone: true } },
    },
    orderBy: (b, { asc }) => [asc(b.bookingDate)],
  })

  const financeTotal = financeRows.reduce((s, b) => s + Number(b.financeAmount), 0)

  return NextResponse.json({
    collectionOutstanding: {
      totalAmount: collectionTotal.toFixed(2),
      count:       collectionRows.length,
      buckets:     BUCKET_ORDER.reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = {
          count:   bucketed[key].length,
          amount:  bucketed[key].reduce((s, b) => s + Number(b.pendingAmount), 0).toFixed(2),
          items:   bucketed[key],
        }
        return acc
      }, {}),
    },
    financeOutstanding: {
      totalAmount: financeTotal.toFixed(2),
      count:       financeRows.length,
      items:       financeRows,
    },
  })
}

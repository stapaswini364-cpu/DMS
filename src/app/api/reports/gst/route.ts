export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { and, eq, gte, lte, or } from 'drizzle-orm'
import { db } from '@/db'
import { bookings } from '@/db/schema/bookings'
import { requireTenant } from '@/lib/api-auth'

const GST_RATE   = 0.18
const CGST_RATE  = 0.09
const SGST_RATE  = 0.09
const TCS_RATE   = 0.01
const TCS_THRESHOLD = 1_000_000   // ₹10 lakh

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

  // Default: current calendar month
  const now   = new Date()
  const start = startParam
    ? new Date(startParam + 'T00:00:00.000Z')
    : new Date(now.getFullYear(), now.getMonth(), 1)
  const end   = endParam
    ? new Date(endParam   + 'T23:59:59.999Z')
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const rows = await db.query.bookings.findMany({
    where: and(
      eq(bookings.tenantId, tenant.id),
      or(
        eq(bookings.status, 'CONFIRMED'),
        eq(bookings.status, 'DELIVERED'),
      ),
      gte(bookings.bookingDate, start),
      lte(bookings.bookingDate, end),
    ),
    columns: {
      id:              true,
      bookingNumber:   true,
      exShowroomPrice: true,
      grandTotal:      true,
      bookingDate:     true,
      status:          true,
    },
    with: {
      customer: { columns: { name: true, phone: true } },
      vehicle: {
        columns: { frameNumber: true },
        with: {
          variant: {
            columns: { name: true },
            with: { model: { columns: { name: true, brand: true } } },
          },
        },
      },
    },
    orderBy: (b, { asc }) => [asc(b.bookingDate)],
  })

  let totalTaxable = 0
  let totalCGST    = 0
  let totalSGST    = 0
  let totalIGST    = 0
  let totalTCS     = 0

  const gstRows = rows.map(b => {
    const taxable    = Number(b.exShowroomPrice)
    const grand      = Number(b.grandTotal)

    // Default to intrastate (CGST + SGST) — no state field on booking to determine otherwise
    const cgst  = parseFloat((taxable * CGST_RATE).toFixed(2))
    const sgst  = parseFloat((taxable * SGST_RATE).toFixed(2))
    const igst  = 0
    const tcs   = grand > TCS_THRESHOLD
      ? parseFloat((grand * TCS_RATE).toFixed(2))
      : 0
    const totalGst = cgst + sgst + igst

    totalTaxable += taxable
    totalCGST    += cgst
    totalSGST    += sgst
    totalIGST    += igst
    totalTCS     += tcs

    const v = b.vehicle
    const vehicleLabel = v
      ? [v.variant?.model?.brand, v.variant?.model?.name, v.variant?.name]
          .filter(Boolean).join(' ')
      : '—'

    return {
      bookingId:     b.id,
      invoiceNo:     b.bookingNumber,
      customerName:  b.customer?.name   ?? '—',
      customerPhone: b.customer?.phone  ?? '',
      vehicle:       vehicleLabel,
      bookingDate:   b.bookingDate,
      status:        b.status,
      taxableAmount: taxable.toFixed(2),
      cgst:          cgst.toFixed(2),
      sgst:          sgst.toFixed(2),
      igst:          igst.toFixed(2),
      tcs:           tcs.toFixed(2),
      totalGst:      totalGst.toFixed(2),
      grandTotal:    grand.toFixed(2),
    }
  })

  const totalGSTCollected = totalCGST + totalSGST + totalIGST

  return NextResponse.json({
    startDate:          start.toISOString().slice(0, 10),
    endDate:            end.toISOString().slice(0, 10),
    rows:               gstRows,
    totalTaxableAmount: totalTaxable.toFixed(2),
    totalCGST:          totalCGST.toFixed(2),
    totalSGST:          totalSGST.toFixed(2),
    totalIGST:          totalIGST.toFixed(2),
    totalTCS:           totalTCS.toFixed(2),
    totalGSTCollected:  totalGSTCollected.toFixed(2),
  })
}

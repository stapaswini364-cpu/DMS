export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and, count, desc } from 'drizzle-orm'
import { db } from '@/db'
import { bookings } from '@/db/schema/bookings'
import { vouchers, voucherEntries, chartOfAccounts } from '@/db/schema/accounting'
import { requireTenant } from '@/lib/api-auth'

type Ctx = { params: Promise<{ id: string }> }

function dateStr(d: Date) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('')
}

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params
  const filter = and(eq(bookings.id, id), eq(bookings.tenantId, tenant.id))

  const [existing] = await db
    .select({
      id:            bookings.id,
      status:        bookings.status,
      bookingNumber: bookings.bookingNumber,
      grandTotal:    bookings.grandTotal,
      customerId:    bookings.customerId,
      locationId:    bookings.locationId,
    })
    .from(bookings)
    .where(filter)
    .limit(1)

  if (!existing) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (existing.status !== 'DRAFT') {
    return NextResponse.json(
      { error: `Only DRAFT bookings can be confirmed (current: ${existing.status})` },
      { status: 400 },
    )
  }

  const now = new Date()

  const confirmed = await db.transaction(async (tx) => {
    // 1. Confirm the booking
    const [updated] = await tx
      .update(bookings)
      .set({ status: 'CONFIRMED', updatedAt: now })
      .where(filter)
      .returning()

    // 2. Create SALES voucher
    const [{ vCount }] = await tx
      .select({ vCount: count() })
      .from(vouchers)
      .where(eq(vouchers.tenantId, tenant.id))

    const voucherNumber = `VCHR-${dateStr(now)}-${String(Number(vCount) + 1).padStart(4, '0')}`

    const [voucher] = await tx
      .insert(vouchers)
      .values({
        tenantId:   tenant.id,
        voucherNumber,
        voucherType: 'SALES',
        date:       now,
        partyId:    existing.customerId,
        partyType:  'CUSTOMER',
        amount:     existing.grandTotal,
        narration:  `Sales Booking ${existing.bookingNumber}`,
        reference:  existing.bookingNumber,
        locationId: existing.locationId,
      })
      .returning()

    // 3. Accounting entries (only if COA is configured)
    const [debtorAcct] = await tx
      .select({ id: chartOfAccounts.id })
      .from(chartOfAccounts)
      .where(
        and(
          eq(chartOfAccounts.tenantId, tenant.id),
          eq(chartOfAccounts.accountType, 'ASSET'),
          eq(chartOfAccounts.isActive, true),
        ),
      )
      .orderBy(desc(chartOfAccounts.isSystem))
      .limit(1)

    const [salesAcct] = await tx
      .select({ id: chartOfAccounts.id })
      .from(chartOfAccounts)
      .where(
        and(
          eq(chartOfAccounts.tenantId, tenant.id),
          eq(chartOfAccounts.accountType, 'INCOME'),
          eq(chartOfAccounts.isActive, true),
        ),
      )
      .orderBy(desc(chartOfAccounts.isSystem))
      .limit(1)

    if (debtorAcct && salesAcct) {
      await tx.insert(voucherEntries).values([
        {
          tenantId:     tenant.id,
          voucherId:    voucher.id,
          accountId:    debtorAcct.id,
          debitAmount:  existing.grandTotal,
          creditAmount: '0',
          narration:    `${existing.bookingNumber} — Receivable`,
        },
        {
          tenantId:     tenant.id,
          voucherId:    voucher.id,
          accountId:    salesAcct.id,
          debitAmount:  '0',
          creditAmount: existing.grandTotal,
          narration:    `${existing.bookingNumber} — Sales Revenue`,
        },
      ])
    }

    return updated
  })

  return NextResponse.json(confirmed)
}

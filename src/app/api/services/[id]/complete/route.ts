export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and, count, desc } from 'drizzle-orm'
import { db } from '@/db'
import { serviceBookings } from '@/db/schema/services'
import { vouchers, voucherEntries, chartOfAccounts } from '@/db/schema/accounting'
import { requireTenant } from '@/lib/api-auth'
import { postServiceCompletionEntry } from '@/lib/accounting/booking-postings'

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
  const filter = and(eq(serviceBookings.id, id), eq(serviceBookings.tenantId, tenant.id))

  const [existing] = await db
    .select({
      id:            serviceBookings.id,
      status:        serviceBookings.status,
      jobCardNumber: serviceBookings.jobCardNumber,
      subTotal:      serviceBookings.subTotal,
      discount:      serviceBookings.discount,
      advanceAmount: serviceBookings.advanceAmount,
      locationId:    serviceBookings.locationId,
      customerId:    serviceBookings.customerId,
    })
    .from(serviceBookings)
    .where(filter)
    .limit(1)

  if (!existing) return NextResponse.json({ error: 'Service booking not found' }, { status: 404 })
  if (existing.status === 'COMPLETED') {
    return NextResponse.json({ error: 'Service booking is already completed' }, { status: 400 })
  }
  if (existing.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Cannot complete a cancelled service booking' }, { status: 400 })
  }

  const subTotal     = Number(existing.subTotal)
  const discount     = Number(existing.discount)
  const advanceAmount = Number(existing.advanceAmount)
  const finalNetAmount = Math.max(0, subTotal - discount - advanceAmount)

  const now = new Date()

  const completed = await db.transaction(async (tx) => {
    // ── 1. Update service booking ─────────────────────────────────────────────
    const [updated] = await tx
      .update(serviceBookings)
      .set({ status: 'COMPLETED', finalNetAmount: String(finalNetAmount), updatedAt: now })
      .where(filter)
      .returning()

    // ── 2. Create Service Income voucher ──────────────────────────────────────
    const [{ vCount }] = await tx
      .select({ vCount: count() })
      .from(vouchers)
      .where(eq(vouchers.tenantId, tenant.id))

    const voucherNumber = `VCHR-${dateStr(now)}-${String(Number(vCount) + 1).padStart(4, '0')}`

    const [voucher] = await tx
      .insert(vouchers)
      .values({
        tenantId:    tenant.id,
        voucherNumber,
        voucherType: 'RECEIPT',
        date:        now,
        partyId:     existing.customerId,
        partyType:   'CUSTOMER',
        amount:      String(finalNetAmount),
        narration:   `Service Completed — ${existing.jobCardNumber}`,
        reference:   existing.jobCardNumber,
        locationId:  existing.locationId,
      })
      .returning()

    // ── 3. Accounting entries (only if COA is configured) ─────────────────────
    const [receivableAcct] = await tx
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

    const [incomeAcct] = await tx
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

    if (receivableAcct && incomeAcct) {
      await tx.insert(voucherEntries).values([
        {
          tenantId:     tenant.id,
          voucherId:    voucher.id,
          accountId:    receivableAcct.id,
          debitAmount:  String(finalNetAmount),
          creditAmount: '0',
          narration:    `${existing.jobCardNumber} — Receivable`,
        },
        {
          tenantId:     tenant.id,
          voucherId:    voucher.id,
          accountId:    incomeAcct.id,
          debitAmount:  '0',
          creditAmount: String(finalNetAmount),
          narration:    `${existing.jobCardNumber} — Service Income`,
        },
      ])
    }

    return updated
  })

  if (finalNetAmount > 0) {
    postServiceCompletionEntry({
      tenantId:         tenant.id,
      serviceBookingId: existing.id,
      jobCardNumber:    existing.jobCardNumber,
      finalNetAmount,
      locationId:       existing.locationId,
    }).catch(e => {
      console.error('[accounting] postServiceCompletionEntry failed for', existing.jobCardNumber, e)
    })
  }

  return NextResponse.json(completed)
}

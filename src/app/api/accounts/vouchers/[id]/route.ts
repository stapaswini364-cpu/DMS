export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { vouchers, journalEntries } from '@/db/schema/accounting'
import { bookings, mrnReceipts } from '@/db/schema/bookings'
import { serviceBookings } from '@/db/schema/services'
import { requireTenant } from '@/lib/api-auth'

type Ctx = { params: Promise<{ id: string }> }

// Vouchers are immutable — reversals are done via CREDIT_NOTE / DEBIT_NOTE vouchers.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  const voucher = await db.query.vouchers.findFirst({
    where: and(eq(vouchers.id, id), eq(vouchers.tenantId, tenant.id)),
    with: {
      location:  true,
      createdBy: { columns: { id: true, name: true, email: true } },
      entries: {
        with: {
          account: {
            columns: {
              id:          true,
              accountCode: true,
              accountName: true,
              accountType: true,
            },
          },
        },
      },
    },
  })

  if (!voucher) {
    // Journal entries system (modern posting engine)
    const je = await db.query.journalEntries.findFirst({
      where: and(eq(journalEntries.id, id), eq(journalEntries.tenantId, tenant.id)),
      with: {
        location:      true,
        createdByUser: { columns: { id: true, name: true, email: true } },
        lines: {
          with: {
            ledger: { columns: { id: true, ledgerCode: true, ledgerName: true } },
          },
        },
      },
    })

    if (!je) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })

    const totalDebit = je.lines.reduce((s, l) => s + Number(l.debitAmount), 0)

    // ── Fetch linked SALES booking (referenceType='booking') ──────────────────
    let bookingData = null
    if (je.referenceType === 'booking' && je.reference) {
      const b = await db.query.bookings.findFirst({
        where: and(
          eq(bookings.bookingNumber, je.reference),
          eq(bookings.tenantId, tenant.id),
        ),
        with: {
          customer: true,
          vehicle: {
            with: {
              variant: { with: { model: true } },
              color:    true,
              location: true,
            },
          },
          location: true,
          financer: true,
          mrnReceipts: {
            orderBy: (r, { desc }) => [desc(r.receivedAt)],
          },
        },
      })
      if (b) bookingData = b
    }

    // ── Fetch linked SERVICE booking (referenceType='service') ────────────────
    let serviceBookingData = null
    if (je.referenceType === 'service' && (je.referenceId || je.reference)) {
      const sb = await db.query.serviceBookings.findFirst({
        where: and(
          je.referenceId
            ? eq(serviceBookings.id,            je.referenceId)
            : eq(serviceBookings.jobCardNumber, je.reference!),
          eq(serviceBookings.tenantId, tenant.id),
        ),
        with: {
          customer: true,
          location: true,
        },
      })
      if (sb) {
        const payments = await db.query.mrnReceipts.findMany({
          where: and(
            eq(mrnReceipts.tenantId,         tenant.id),
            eq(mrnReceipts.serviceBookingId, sb.id),
          ),
          orderBy: (r, { desc }) => [desc(r.receivedAt)],
        })
        serviceBookingData = { ...sb, mrnReceipts: payments }
      }
    }

    return NextResponse.json({
      id:            je.id,
      voucherNumber: je.voucherNo,
      voucherType:   je.voucherType,
      referenceType: je.referenceType,
      date:          je.entryDate,
      amount:        String(totalDebit),
      narration:     je.narration,
      reference:     je.reference,
      location:      je.location ? { id: je.location.id, name: je.location.name } : null,
      createdBy:     je.createdByUser
        ? { id: je.createdByUser.id, name: je.createdByUser.name, email: je.createdByUser.email }
        : null,
      entries: je.lines.map(l => ({
        id:     l.id,
        debit:  l.debitAmount,
        credit: l.creditAmount,
        account: {
          id:          l.ledger.id,
          accountCode: l.ledger.ledgerCode,
          accountName: l.ledger.ledgerName,
          accountType: '',
        },
      })),
      booking:        bookingData,
      serviceBooking: serviceBookingData,
    })
  }

  // Legacy vouchers path
  let bookingData = null
  if (voucher.voucherType === 'SALES' && voucher.reference) {
    bookingData = await db.query.bookings.findFirst({
      where: and(
        eq(bookings.bookingNumber, voucher.reference),
        eq(bookings.tenantId, tenant.id),
      ),
      with: {
        customer: true,
        vehicle: {
          with: {
            variant: { with: { model: true } },
            color:    true,
            location: true,
          },
        },
        location: true,
        financer: true,
        mrnReceipts: {
          orderBy: (r, { desc }) => [desc(r.receivedAt)],
        },
      },
    })
  }

  return NextResponse.json({
    ...voucher,
    referenceType:  null,
    booking:        bookingData ?? null,
    serviceBooking: null,
  })
}

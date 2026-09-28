export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { journalEntries } from '@/db/schema/accounting'
import { bookings, mrnReceipts } from '@/db/schema/bookings'
import { serviceBookings } from '@/db/schema/services'
import { requireTenant } from '@/lib/api-auth'
import { postJournalEntry, PostingError } from '@/lib/accounting/posting-engine'

type Ctx = { params: Promise<{ id: string }> }

type PaymentLineInput = {
  ledgerId:  string
  debit?:    number | string
  credit?:   number | string
  narration?: string
}

// POST /api/accounts/vouchers/[id]/record-payment
// Body: { mrnNumber: string; lines: [{ ledgerId, debit, credit, narration? }] }
// [id] must be a modern journal_entries row created via postDeliveryEntry (booking)
// or postServiceCompletionEntry (service).
export async function POST(req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  try {
    const body = await req.json() as { mrnNumber?: string; lines?: PaymentLineInput[] }
    const mrnRaw = body.mrnNumber?.trim() ?? ''
    if (!mrnRaw) return NextResponse.json({ error: 'MRN No. is required' }, { status: 400 })
    if (!Array.isArray(body.lines) || body.lines.length < 2) {
      return NextResponse.json({ error: 'At least a Cash/Bank (Dr) and a Received From (Cr) line are required' }, { status: 400 })
    }

    // Normalise lines
    const lines = body.lines.map((l, i) => {
      if (!l.ledgerId) throw new PostingError(`Row ${i + 1}: ledger is required`)
      const debit  = Number(l.debit  ?? 0)
      const credit = Number(l.credit ?? 0)
      if (isNaN(debit)  || debit  < 0) throw new PostingError(`Row ${i + 1}: debit must be a non-negative number`)
      if (isNaN(credit) || credit < 0) throw new PostingError(`Row ${i + 1}: credit must be a non-negative number`)
      if (debit === 0 && credit === 0) throw new PostingError(`Row ${i + 1}: enter a debit or a credit amount`)
      if (debit > 0 && credit > 0)     throw new PostingError(`Row ${i + 1}: a row cannot have both a debit and a credit amount`)
      return { ledgerId: l.ledgerId, debit, credit, narration: l.narration }
    })

    const totalDebit  = lines.reduce((s, l) => s + l.debit,  0)
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json(
        { error: `Entry is not balanced — Dr ${totalDebit.toFixed(2)} ≠ Cr ${totalCredit.toFixed(2)}` },
        { status: 400 },
      )
    }
    if (totalDebit <= 0) {
      return NextResponse.json({ error: 'Payment amount must be greater than 0' }, { status: 400 })
    }

    const mrn = mrnRaw.toUpperCase()

    // ── MRN uniqueness (server-side, authoritative) ─────────────────────────
    const existingMrn = await db.query.mrnReceipts.findFirst({
      where: and(eq(mrnReceipts.tenantId, tenant.id), eq(mrnReceipts.mrnNumber, mrn)),
      columns: { id: true },
    })
    if (existingMrn) {
      return NextResponse.json(
        { error: 'MRN No. already exists. Please enter a different MRN No.' },
        { status: 409 },
      )
    }

    // ── Load parent voucher and linked booking / service booking ────────────
    const parent = await db.query.journalEntries.findFirst({
      where: and(eq(journalEntries.id, id), eq(journalEntries.tenantId, tenant.id)),
      columns: {
        id:            true,
        reference:     true,
        referenceType: true,
        referenceId:   true,
        locationId:    true,
      },
    })
    if (!parent) return NextResponse.json({ error: 'Parent voucher not found' }, { status: 404 })

    let bookingRow: {
      id: string; bookingNumber: string; customerId: string;
      bookingAmount: string; pendingAmount: string;
    } | null = null
    let serviceRow: {
      id: string; jobCardNumber: string; customerId: string;
      finalNetAmount: string; mrnAmount: string;
    } | null = null

    if (parent.referenceType === 'booking' && parent.reference) {
      const [b] = await db
        .select({
          id:            bookings.id,
          bookingNumber: bookings.bookingNumber,
          customerId:    bookings.customerId,
          bookingAmount: bookings.bookingAmount,
          pendingAmount: bookings.pendingAmount,
        })
        .from(bookings)
        .where(and(eq(bookings.bookingNumber, parent.reference), eq(bookings.tenantId, tenant.id)))
        .limit(1)
      if (!b) return NextResponse.json({ error: 'Linked sales booking not found' }, { status: 404 })
      bookingRow = b
    } else if (parent.referenceType === 'service') {
      const filter = parent.referenceId
        ? eq(serviceBookings.id, parent.referenceId)
        : (parent.reference ? eq(serviceBookings.jobCardNumber, parent.reference) : null)
      if (!filter) return NextResponse.json({ error: 'Parent voucher has no service reference' }, { status: 400 })
      const [s] = await db
        .select({
          id:             serviceBookings.id,
          jobCardNumber:  serviceBookings.jobCardNumber,
          customerId:     serviceBookings.customerId,
          finalNetAmount: serviceBookings.finalNetAmount,
          mrnAmount:      serviceBookings.mrnAmount,
        })
        .from(serviceBookings)
        .where(and(filter, eq(serviceBookings.tenantId, tenant.id)))
        .limit(1)
      if (!s) return NextResponse.json({ error: 'Linked service booking not found' }, { status: 404 })
      serviceRow = s
    } else {
      return NextResponse.json(
        { error: 'Record Payment is only available on SALES / SERVICE vouchers' },
        { status: 400 },
      )
    }

    // ── Pending-amount validation ────────────────────────────────────────────
    const pending = bookingRow
      ? Number(bookingRow.pendingAmount)
      : Math.max(0, Number(serviceRow!.finalNetAmount) - Number(serviceRow!.mrnAmount))

    if (totalDebit - pending > 0.01) {
      return NextResponse.json(
        { error: `Payment (₹${totalDebit.toFixed(2)}) exceeds pending amount (₹${pending.toFixed(2)})` },
        { status: 400 },
      )
    }

    // ── Post the receipt journal entry ───────────────────────────────────────
    const now = new Date()
    const posted = await postJournalEntry({
      tenantId:      tenant.id,
      entryDate:     now,
      voucherType:   'RECEIPT',
      narration:     bookingRow
        ? `Payment received for booking ${bookingRow.bookingNumber} (MRN ${mrn})`
        : `Payment received for service ${serviceRow!.jobCardNumber} (MRN ${mrn})`,
      reference:     bookingRow ? bookingRow.bookingNumber : serviceRow!.jobCardNumber,
      referenceType: bookingRow ? 'booking' : 'service',
      referenceId:   bookingRow ? bookingRow.id : serviceRow!.id,
      locationId:    parent.locationId ?? undefined,
      lines,
      skipManualEntryCheck: false,
    })

    // ── Update linked booking / service and insert MRN receipt row ───────────
    await db.transaction(async (tx) => {
      if (bookingRow) {
        await tx.insert(mrnReceipts).values({
          tenantId:    tenant.id,
          mrnNumber:   mrn,
          bookingId:   bookingRow.id,
          customerId:  bookingRow.customerId,
          amount:      String(totalDebit),
          paymentMode: 'CASH',
          receivedAt:  now,
        })
        await tx
          .update(bookings)
          .set({
            mrnNumber:     mrn,
            bookingAmount: String(Number(bookingRow.bookingAmount) + totalDebit),
            pendingAmount: String(Math.max(0, Number(bookingRow.pendingAmount) - totalDebit)),
            updatedAt:     now,
          })
          .where(and(eq(bookings.id, bookingRow.id), eq(bookings.tenantId, tenant.id)))
      } else if (serviceRow) {
        await tx.insert(mrnReceipts).values({
          tenantId:         tenant.id,
          mrnNumber:        mrn,
          bookingId:        null,
          serviceBookingId: serviceRow.id,
          customerId:       serviceRow.customerId,
          amount:           String(totalDebit),
          paymentMode:      'CASH',
          receivedAt:       now,
        })
        await tx
          .update(serviceBookings)
          .set({
            mrnAmount: String(Number(serviceRow.mrnAmount) + totalDebit),
            updatedAt: now,
          })
          .where(and(eq(serviceBookings.id, serviceRow.id), eq(serviceBookings.tenantId, tenant.id)))
      }
    })

    return NextResponse.json({
      ok:            true,
      voucherNo:     posted.entry.voucherNo,
      voucherId:     posted.entry.id,
      mrnNumber:     mrn,
      amount:        totalDebit,
      pendingAfter:  Math.max(0, pending - totalDebit),
      lastPaymentAt: now.toISOString(),
    }, { status: 201 })
  } catch (e) {
    if (e instanceof PostingError) {
      return NextResponse.json({ error: e.message }, { status: 422 })
    }
    const message = e instanceof Error ? e.message : String(e)
    console.error('[record-payment] failed for voucher', id, e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

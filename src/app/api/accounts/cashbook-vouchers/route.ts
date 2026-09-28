export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { bookings, mrnReceipts, paymentModeEnum } from '@/db/schema/bookings'
import { serviceBookings } from '@/db/schema/services'
import { postJournalEntry, PostingError } from '@/lib/accounting/posting-engine'
import { requireTenant } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'

const ALLOWED_TYPES = ['RECEIPT', 'PAYMENT', 'CONTRA', 'JOURNAL'] as const
type CashbookVoucherType = typeof ALLOWED_TYPES[number]

const PAYMENT_MODES = paymentModeEnum.enumValues

type AdditionalLine = {
  ledgerId:     string
  debitAmount:  number | string
  creditAmount: number | string
  narration?:   string
}

type PaymentLine = {
  ledgerId: string
  amount:   number | string
}

type JournalLine = {
  ledgerId:  string
  debit:     number | string
  credit:    number | string
  narration?: string
}

export async function POST(req: NextRequest) {
  const { tenant, userId, err } = await requireTenant()
  if (err) return err

  const body = await req.json()
  const {
    voucherType,
    date,
    amount,
    debitLedgerId,
    debitAmount,
    creditLedgerId,
    creditAmount,
    additionalLines,
    paymentLines,
    journalLines,
    narration,
    reference,
    locationId,
    bookingId,
    bookingType,
    mrnNumber,
    advanceCustomerId,
    advancePaymentMode,
  } = body as {
    voucherType?:     string
    date?:            string
    amount?:          number | string
    debitLedgerId?:   string
    debitAmount?:     number | string
    creditLedgerId?:  string
    creditAmount?:    number | string
    additionalLines?: AdditionalLine[]
    paymentLines?:    PaymentLine[]
    journalLines?:    JournalLine[]
    narration?:       string
    reference?:       string
    locationId?:      string
    bookingId?:          string
    bookingType?:        'sale' | 'service'
    mrnNumber?:          string
    advanceCustomerId?:  string
    advancePaymentMode?: string
  }

  if (!voucherType || !ALLOWED_TYPES.includes(voucherType as CashbookVoucherType)) {
    return NextResponse.json(
      { error: `voucherType must be one of: ${ALLOWED_TYPES.join(', ')}` },
      { status: 400 },
    )
  }
  if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 })

  // Build lines array
  let lines: Array<{ ledgerId: string; debit: number; credit: number; narration?: string }>

  if (voucherType === 'PAYMENT' && Array.isArray(paymentLines) && paymentLines.length > 0) {
    // Multi-line payment: N Dr rows against one Cr account (Model A)
    if (!creditLedgerId) {
      return NextResponse.json({ error: 'creditLedgerId (Cash / Bank account) is required' }, { status: 400 })
    }
    const crAmt = Number(creditAmount ?? amount ?? 0)
    if (isNaN(crAmt) || crAmt <= 0) {
      return NextResponse.json({ error: 'creditAmount must be a positive number' }, { status: 400 })
    }

    for (let i = 0; i < paymentLines.length; i++) {
      const l = paymentLines[i]
      if (!l.ledgerId) return NextResponse.json({ error: `Row ${i + 1}: ledgerId is required` }, { status: 400 })
      if (isNaN(Number(l.amount)) || Number(l.amount) <= 0) {
        return NextResponse.json({ error: `Row ${i + 1}: amount must be > 0` }, { status: 400 })
      }
    }
    const drLines = paymentLines.map(l => ({ ledgerId: l.ledgerId, debit: Number(l.amount), credit: 0 }))

    const totalDr = drLines.reduce((s, l) => s + l.debit, 0)
    if (Math.abs(totalDr - crAmt) > 0.01) {
      return NextResponse.json(
        { error: `Entry is not balanced — Dr ${totalDr.toFixed(2)} ≠ Cr ${crAmt.toFixed(2)}` },
        { status: 400 },
      )
    }

    lines = [...drLines, { ledgerId: creditLedgerId, debit: 0, credit: crAmt }]

  } else if (voucherType === 'RECEIPT' && (debitAmount !== undefined || creditAmount !== undefined || additionalLines?.length)) {
    // Multi-line receipt format
    if (!debitLedgerId)  return NextResponse.json({ error: 'debitLedgerId is required' },  { status: 400 })
    if (!creditLedgerId) return NextResponse.json({ error: 'creditLedgerId is required' }, { status: 400 })

    const drAmt = Number(debitAmount  ?? amount ?? 0)
    const crAmt = Number(creditAmount ?? amount ?? 0)

    if (drAmt <= 0) return NextResponse.json({ error: 'Debit amount must be > 0' }, { status: 400 })
    if (crAmt <= 0) return NextResponse.json({ error: 'Credit amount must be > 0' }, { status: 400 })

    lines = [
      { ledgerId: debitLedgerId,  debit: drAmt, credit: 0 },
      { ledgerId: creditLedgerId, debit: 0,     credit: crAmt },
      ...(additionalLines ?? []).map(l => ({
        ledgerId:  l.ledgerId,
        debit:     Number(l.debitAmount  ?? 0),
        credit:    Number(l.creditAmount ?? 0),
        narration: l.narration,
      })),
    ]

    const totalDr = lines.reduce((s, l) => s + l.debit,  0)
    const totalCr = lines.reduce((s, l) => s + l.credit, 0)
    if (Math.abs(totalDr - totalCr) > 0.01) {
      return NextResponse.json(
        { error: `Entry is not balanced — Dr ${totalDr.toFixed(2)} ≠ Cr ${totalCr.toFixed(2)}` },
        { status: 400 },
      )
    }
  } else if (voucherType === 'JOURNAL' && Array.isArray(journalLines) && journalLines.length >= 2) {
    // N-to-M journal entry: arbitrary Dr and Cr lines, must balance
    for (let i = 0; i < journalLines.length; i++) {
      const l = journalLines[i]
      if (!l.ledgerId) return NextResponse.json({ error: `Line ${i + 1}: ledgerId is required` }, { status: 400 })
      const dr = Number(l.debit ?? 0)
      const cr = Number(l.credit ?? 0)
      if (isNaN(dr) || dr < 0) return NextResponse.json({ error: `Line ${i + 1}: debit must be non-negative` }, { status: 400 })
      if (isNaN(cr) || cr < 0) return NextResponse.json({ error: `Line ${i + 1}: credit must be non-negative` }, { status: 400 })
      if (dr === 0 && cr === 0) return NextResponse.json({ error: `Line ${i + 1}: both debit and credit are zero` }, { status: 400 })
    }

    lines = journalLines.map(l => ({
      ledgerId:  l.ledgerId,
      debit:     Number(l.debit  ?? 0),
      credit:    Number(l.credit ?? 0),
      narration: l.narration,
    }))

    const totalDr = lines.reduce((s, l) => s + l.debit,  0)
    const totalCr = lines.reduce((s, l) => s + l.credit, 0)
    if (Math.abs(totalDr - totalCr) > 0.01) {
      return NextResponse.json(
        { error: `Entry is not balanced — Dr ${totalDr.toFixed(2)} ≠ Cr ${totalCr.toFixed(2)}` },
        { status: 400 },
      )
    }
  } else {
    // Simple 2-line format (CONTRA)
    if (!debitLedgerId)  return NextResponse.json({ error: 'debitLedgerId is required' },  { status: 400 })
    if (!creditLedgerId) return NextResponse.json({ error: 'creditLedgerId is required' }, { status: 400 })
    if (debitLedgerId === creditLedgerId) {
      return NextResponse.json({ error: 'Debit and credit ledger must be different' }, { status: 400 })
    }
    const parsedAmount = Number(amount ?? debitAmount ?? 0)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }
    lines = [
      { ledgerId: debitLedgerId,  debit: parsedAmount, credit: 0             },
      { ledgerId: creditLedgerId, debit: 0,             credit: parsedAmount },
    ]
  }

  try {
    const result = await postJournalEntry({
      tenantId:      tenant.id,
      entryDate:     new Date(date),
      voucherType:   voucherType as CashbookVoucherType,
      narration:     narration?.trim() || undefined,
      reference:     reference?.trim() || undefined,
      referenceType: (voucherType === 'RECEIPT' && bookingType === 'service') ? 'service' : 'manual',
      locationId:    locationId || undefined,
      createdBy:     undefined,
      lines,
      skipManualEntryCheck: false,
    })

    // Update booking amounts if a booking was linked to this receipt
    if (voucherType === 'RECEIPT' && bookingId && bookingType) {
      const receiptAmt = lines.reduce((s, l) => s + l.debit, 0)
      const mrn = mrnNumber?.trim().toUpperCase() || null
      try {
        if (bookingType === 'sale') {
          const [bk] = await db
            .select({ bookingAmount: bookings.bookingAmount, pendingAmount: bookings.pendingAmount, customerId: bookings.customerId })
            .from(bookings)
            .where(and(eq(bookings.id, bookingId), eq(bookings.tenantId, tenant.id)))
            .limit(1)
          if (bk) {
            await db
              .update(bookings)
              .set({
                bookingAmount: String(Number(bk.bookingAmount) + receiptAmt),
                pendingAmount: String(Math.max(0, Number(bk.pendingAmount) - receiptAmt)),
                updatedAt:     new Date(),
              })
              .where(and(eq(bookings.id, bookingId), eq(bookings.tenantId, tenant.id)))

            if (mrn) {
              const [existing] = await db
                .select({ id: mrnReceipts.id })
                .from(mrnReceipts)
                .where(and(eq(mrnReceipts.tenantId, tenant.id), eq(mrnReceipts.mrnNumber, mrn)))
                .limit(1)
              if (!existing) {
                await db.insert(mrnReceipts).values({
                  tenantId:   tenant.id,
                  mrnNumber:  mrn,
                  bookingId,
                  customerId: bk.customerId,
                  amount:     String(receiptAmt),
                  paymentMode: 'CASH',
                  receivedAt:  new Date(date),
                })
              }
            }
          }
        } else if (bookingType === 'service') {
          const [sb] = await db
            .select({ mrnAmount: serviceBookings.mrnAmount, customerId: serviceBookings.customerId })
            .from(serviceBookings)
            .where(and(eq(serviceBookings.id, bookingId), eq(serviceBookings.tenantId, tenant.id)))
            .limit(1)
          if (sb) {
            await db
              .update(serviceBookings)
              .set({
                mrnAmount:  String(Number(sb.mrnAmount) + receiptAmt),
                updatedAt:  new Date(),
              })
              .where(and(eq(serviceBookings.id, bookingId), eq(serviceBookings.tenantId, tenant.id)))

            if (mrn) {
              const [existing] = await db
                .select({ id: mrnReceipts.id })
                .from(mrnReceipts)
                .where(and(eq(mrnReceipts.tenantId, tenant.id), eq(mrnReceipts.mrnNumber, mrn)))
                .limit(1)
              if (!existing) {
                await db.insert(mrnReceipts).values({
                  tenantId:        tenant.id,
                  mrnNumber:       mrn,
                  bookingId:       null,
                  serviceBookingId: bookingId,
                  customerId:      sb.customerId,
                  amount:          String(receiptAmt),
                  paymentMode:     'CASH',
                  receivedAt:      new Date(date),
                })
              }
            }
          }
        }
      } catch (updateErr) {
        console.error('cashbook-vouchers: booking amount update failed', updateErr)
      }
    }

    // Create mrn_receipt for Advance mode receipts (no linked booking)
    if (voucherType === 'RECEIPT' && !bookingId && mrnNumber?.trim() && advanceCustomerId) {
      const mrn = mrnNumber.trim().toUpperCase()
      const receiptAmt = lines.reduce((s, l) => s + l.debit, 0)
      const pm = PAYMENT_MODES.includes(advancePaymentMode as typeof PAYMENT_MODES[number])
        ? (advancePaymentMode as typeof PAYMENT_MODES[number])
        : 'CASH'
      try {
        const [existing] = await db
          .select({ id: mrnReceipts.id })
          .from(mrnReceipts)
          .where(and(eq(mrnReceipts.tenantId, tenant.id), eq(mrnReceipts.mrnNumber, mrn)))
          .limit(1)
        if (!existing) {
          await db.insert(mrnReceipts).values({
            tenantId:   tenant.id,
            mrnNumber:  mrn,
            bookingId:  null,
            customerId: advanceCustomerId,
            amount:     String(receiptAmt),
            paymentMode: pm,
            receivedAt:  new Date(date),
          })
        }
      } catch (advErr) {
        console.error('cashbook-vouchers: advance mrn_receipt insert failed', advErr)
      }
    }

    logAudit({
      tenantId: tenant.id,
      userId,
      action:   'CASHBOOK_VOUCHER_CREATED',
      module:   'Accounts',
      recordId: result.entry.id,
      details:  {
        voucherNo:   result.entry.voucherNo,
        voucherType,
        lines:       lines.length,
      },
    })

    return NextResponse.json(
      { voucherNo: result.entry.voucherNo, id: result.entry.id },
      { status: 201 },
    )
  } catch (e) {
    if (e instanceof PostingError) {
      return NextResponse.json({ error: e.message }, { status: 422 })
    }
    console.error('cashbook-vouchers POST error:', e)
    return NextResponse.json({ error: 'Internal error while posting voucher' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and, count, inArray, desc, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  vouchers, voucherEntries, voucherTypeEnum,
  journalEntries, journalEntryLines, jeVoucherTypeEnum,
} from '@/db/schema/accounting'
import { locations, users } from '@/db/schema/auth'
import { bookings } from '@/db/schema/bookings'
import { vehicleInventory } from '@/db/schema/inventory'
import { requireTenant } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'

const VOUCHER_TYPES = voucherTypeEnum.enumValues
const JE_TYPES     = jeVoucherTypeEnum.enumValues

const PREFIX: Record<typeof VOUCHER_TYPES[number], string> = {
  RECEIPT:     'RV',
  PAYMENT:     'PV',
  CONTRA:      'CV',
  JOURNAL:     'JV',
  SALES:       'SV',
  PURCHASE:    'PUV',
  DEBIT_NOTE:  'DN',
  CREDIT_NOTE: 'CN',
}

function dateStr(d: Date) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('')
}

type EntryInput = {
  accountId:    string
  debitAmount:  number | string
  creditAmount: number | string
  narration?:   string
}

export async function GET(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const typeParam = new URL(req.url).searchParams.get('type')

  if (typeParam && !JE_TYPES.includes(typeParam as typeof JE_TYPES[number])) {
    return NextResponse.json(
      { error: `type must be one of: ${JE_TYPES.join(', ')}` },
      { status: 400 },
    )
  }

  const rows = await db
    .select({
      id:            journalEntries.id,
      voucherNumber: journalEntries.voucherNo,
      voucherType:   journalEntries.voucherType,
      date:          journalEntries.entryDate,
      narration:     journalEntries.narration,
      reference:     journalEntries.reference,
      referenceType: journalEntries.referenceType,
      locationId:    journalEntries.locationId,
      locationName:  locations.name,
      createdById:   journalEntries.createdBy,
      createdByName: users.name,
      createdAt:     journalEntries.createdAt,
    })
    .from(journalEntries)
    .leftJoin(locations, eq(journalEntries.locationId, locations.id))
    .leftJoin(users, eq(journalEntries.createdBy, users.id))
    .where(
      typeParam
        ? and(
            eq(journalEntries.tenantId, tenant.id),
            eq(journalEntries.voucherType, typeParam as typeof JE_TYPES[number]),
          )
        : eq(journalEntries.tenantId, tenant.id),
    )
    .orderBy(desc(journalEntries.entryDate))
    .limit(100)

  if (rows.length === 0) return NextResponse.json([])

  // Sum debit amounts from lines to get voucher totals
  const entryIds = rows.map(r => r.id)
  const lineSums = await db
    .select({
      journalEntryId: journalEntryLines.journalEntryId,
      totalDebit:     sql<string>`sum(${journalEntryLines.debitAmount})`,
    })
    .from(journalEntryLines)
    .where(inArray(journalEntryLines.journalEntryId, entryIds))
    .groupBy(journalEntryLines.journalEntryId)

  const amountMap = Object.fromEntries(lineSums.map(l => [l.journalEntryId, l.totalDebit ?? '0']))

  // For SALES entries, pull pendingAmount + frameNumber from the linked booking
  const salesRefs = rows
    .filter(r => r.voucherType === 'SALES' && r.reference)
    .map(r => r.reference as string)

  type BookingLookup = { bookingNumber: string; pendingAmount: string; frameNumber: string | null }
  let salesMap: Record<string, BookingLookup> = {}
  if (salesRefs.length > 0) {
    const linkedBookings = await db
      .select({
        bookingNumber: bookings.bookingNumber,
        pendingAmount: bookings.pendingAmount,
        frameNumber:   vehicleInventory.frameNumber,
      })
      .from(bookings)
      .leftJoin(vehicleInventory, eq(bookings.vehicleId, vehicleInventory.id))
      .where(and(eq(bookings.tenantId, tenant.id), inArray(bookings.bookingNumber, salesRefs)))
    salesMap = Object.fromEntries(linkedBookings.map(b => [b.bookingNumber, b]))
  }

  const result = rows.map(r => {
    const salesEntry = r.voucherType === 'SALES' && r.reference ? (salesMap[r.reference] ?? null) : null
    const isService  = r.referenceType === 'service'

    const displayType: string =
      isService                   ? 'SERVICE'  :
      r.voucherType === 'RECEIPT' ? 'RECEIPT'  :
      r.voucherType

    const frameOrJobCard: string | null =
      salesEntry ? (salesEntry.frameNumber ?? null) :
      isService  ? (r.reference ?? null)            :
      null

    return {
      id:            r.id,
      voucherNumber: r.voucherNumber,
      voucherType:   r.voucherType,
      displayType,
      date:          r.date,
      amount:        amountMap[r.id] ?? '0',
      narration:     r.narration,
      partyId:       null,
      pendingAmount: salesEntry ? salesEntry.pendingAmount : null,
      frameOrJobCard,
      location:      r.locationId ? { id: r.locationId, name: r.locationName ?? '' } : null,
      createdBy:     r.createdById ? { id: r.createdById, name: r.createdByName ?? '' } : null,
    }
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const { tenant, userId, err } = await requireTenant()
  if (err) return err

  const body = await req.json()
  const {
    voucherType, date, partyId, partyType,
    amount, narration, reference, locationId,
    entries,
  } = body as {
    voucherType?: string
    date?:        string
    partyId?:     string
    partyType?:   string
    amount?:      number | string
    narration?:   string
    reference?:   string
    locationId?:  string
    entries?:     EntryInput[]
  }

  if (!voucherType) return NextResponse.json({ error: 'voucherType is required' }, { status: 400 })
  if (!VOUCHER_TYPES.includes(voucherType as typeof VOUCHER_TYPES[number])) {
    return NextResponse.json(
      { error: `voucherType must be one of: ${VOUCHER_TYPES.join(', ')}` },
      { status: 400 },
    )
  }
  if (!date)   return NextResponse.json({ error: 'date is required' }, { status: 400 })
  if (!amount) return NextResponse.json({ error: 'amount is required' }, { status: 400 })

  const parsedAmount = Number(amount)
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }

  if (entries && entries.length > 0) {
    const totalDebit  = entries.reduce((s, e) => s + Number(e.debitAmount  ?? 0), 0)
    const totalCredit = entries.reduce((s, e) => s + Number(e.creditAmount ?? 0), 0)
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      return NextResponse.json(
        { error: `Entries do not balance: debit ${totalDebit} ≠ credit ${totalCredit}` },
        { status: 400 },
      )
    }
    if (entries.some((e) => !e.accountId)) {
      return NextResponse.json({ error: 'Each entry must have an accountId' }, { status: 400 })
    }
  }

  const now = new Date()
  const type = voucherType as typeof VOUCHER_TYPES[number]

  const voucher = await db.transaction(async (tx) => {
    const [{ typeCount }] = await tx
      .select({ typeCount: count() })
      .from(vouchers)
      .where(
        and(
          eq(vouchers.tenantId, tenant.id),
          eq(vouchers.voucherType, type),
        ),
      )

    const voucherNumber = `${PREFIX[type]}-${dateStr(now)}-${String(Number(typeCount) + 1).padStart(4, '0')}`

    const [newVoucher] = await tx
      .insert(vouchers)
      .values({
        tenantId:    tenant.id,
        voucherNumber,
        voucherType: type,
        date:        new Date(date),
        partyId:     partyId    ?? null,
        partyType:   (partyType as 'CUSTOMER' | 'VENDOR') ?? null,
        amount:      String(parsedAmount),
        narration:   narration  ?? null,
        reference:   reference  ?? null,
        locationId:  locationId ?? null,
      })
      .returning()

    if (entries && entries.length > 0) {
      await tx.insert(voucherEntries).values(
        entries.map((e) => ({
          tenantId:     tenant.id,
          voucherId:    newVoucher.id,
          accountId:    e.accountId,
          debitAmount:  String(Number(e.debitAmount  ?? 0)),
          creditAmount: String(Number(e.creditAmount ?? 0)),
          narration:    e.narration ?? null,
        })),
      )
    }

    return newVoucher
  })

  logAudit({
    tenantId: tenant.id,
    userId,
    action:   'VOUCHER_CREATED',
    module:   'Accounts',
    recordId: voucher.id,
    details:  { voucherNumber: voucher.voucherNumber, voucherType: voucher.voucherType, amount: String(parsedAmount) },
  })

  return NextResponse.json(voucher, { status: 201 })
}

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { and, eq, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { locations, locationTypeEnum, branchTypeEnum } from '@/db/schema/auth'
import { bookings } from '@/db/schema/bookings'
import { serviceBookings } from '@/db/schema/services'
import { journalEntries, vouchers } from '@/db/schema/accounting'
import { requireTenant } from '@/lib/api-auth'

type Ctx = { params: Promise<{ id: string }> }

const LOC_TYPES    = locationTypeEnum.enumValues
const BRANCH_TYPES = branchTypeEnum.enumValues

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  const [location] = await db
    .select()
    .from(locations)
    .where(and(eq(locations.id, id), eq(locations.tenantId, tenant.id)))
    .limit(1)

  if (!location) return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
  return NextResponse.json(location)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  const existing = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.id, id), eq(locations.tenantId, tenant.id)))
    .limit(1)

  if (!existing.length) return NextResponse.json({ error: 'Branch not found' }, { status: 404 })

  const body = await req.json()
  const {
    name, type, branchType,
    inchargeName, phone, email,
    address, city, state, pincode,
    bankName, accountNumber, ifscCode, accountType, bankBranchName,
    isActive,
  } = body as Record<string, string | boolean | undefined>

  if (name         !== undefined && !String(name).trim())         return NextResponse.json({ error: 'name cannot be empty' },          { status: 400 })
  if (inchargeName !== undefined && !String(inchargeName).trim()) return NextResponse.json({ error: 'inchargeName cannot be empty' },  { status: 400 })
  if (address      !== undefined && !String(address).trim())      return NextResponse.json({ error: 'address cannot be empty' },       { status: 400 })
  if (city         !== undefined && !String(city).trim())         return NextResponse.json({ error: 'city cannot be empty' },          { status: 400 })
  if (state        !== undefined && !String(state).trim())        return NextResponse.json({ error: 'state cannot be empty' },         { status: 400 })

  const updates: Record<string, unknown> = {}
  if (name          !== undefined) updates.name          = String(name).trim()
  if (inchargeName  !== undefined) updates.inchargeName  = String(inchargeName).trim() || null
  if (address       !== undefined) updates.address       = String(address).trim()
  if (city          !== undefined) updates.city          = String(city).trim()
  if (state         !== undefined) updates.state         = String(state).trim()
  if (pincode       !== undefined) updates.pincode       = String(pincode).trim()       || null
  if (phone         !== undefined) updates.phone         = String(phone).trim()         || null
  if (email         !== undefined) updates.email         = String(email).trim()         || null
  if (bankName      !== undefined) updates.bankName      = String(bankName).trim()      || null
  if (accountNumber !== undefined) updates.accountNumber = String(accountNumber).trim() || null
  if (ifscCode      !== undefined) updates.ifscCode      = String(ifscCode).trim()      || null
  if (accountType   !== undefined) updates.accountType   = String(accountType).trim()   || null
  if (bankBranchName !== undefined) updates.bankBranchName = String(bankBranchName).trim() || null
  if (isActive      !== undefined) updates.isActive      = Boolean(isActive)

  if (type !== undefined && LOC_TYPES.includes(type as typeof LOC_TYPES[number])) {
    updates.type = type as typeof LOC_TYPES[number]
  }
  if (branchType !== undefined) {
    updates.branchType = (BRANCH_TYPES.includes(branchType as typeof BRANCH_TYPES[number]))
      ? (branchType as typeof BRANCH_TYPES[number])
      : null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const [updated] = await db
    .update(locations)
    .set(updates)
    .where(and(eq(locations.id, id), eq(locations.tenantId, tenant.id)))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  // Guard: check if any transaction records reference this branch.
  // journalEntries and vouchers FK to locations with NO ACTION — a raw delete would throw.
  // bookings and serviceBookings would silently null out, but we guard them too for data integrity.
  const [usageCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(journalEntries)
    .where(and(
      eq(journalEntries.tenantId, tenant.id),
      eq(journalEntries.locationId, id),
    ))

  if (Number(usageCount?.total) > 0) {
    return NextResponse.json(
      {
        error:
          'This branch has journal entries and cannot be deleted. ' +
          'Deactivate it instead by editing and toggling Active off.',
      },
      { status: 409 },
    )
  }

  // Also block if sales or service bookings reference it
  const [bookingCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(bookings)
    .where(and(
      eq(bookings.tenantId, tenant.id),
      eq(bookings.locationId, id),
    ))

  if (Number(bookingCount?.total) > 0) {
    return NextResponse.json(
      {
        error:
          'This branch has sales bookings and cannot be deleted. ' +
          'Deactivate it instead by editing and toggling Active off.',
      },
      { status: 409 },
    )
  }

  const [serviceCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(serviceBookings)
    .where(and(
      eq(serviceBookings.tenantId, tenant.id),
      eq(serviceBookings.locationId, id),
    ))

  if (Number(serviceCount?.total) > 0) {
    return NextResponse.json(
      {
        error:
          'This branch has service bookings and cannot be deleted. ' +
          'Deactivate it instead by editing and toggling Active off.',
      },
      { status: 409 },
    )
  }

  const [deleted] = await db
    .delete(locations)
    .where(and(eq(locations.id, id), eq(locations.tenantId, tenant.id)))
    .returning()

  if (!deleted) return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}

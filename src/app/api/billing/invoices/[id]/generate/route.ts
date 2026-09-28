export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { bookings } from '@/db/schema/bookings'
import { serviceBookings } from '@/db/schema/services'
import { invoices } from '@/db/schema/invoices'
import { users } from '@/db/schema/auth'
import { requireTenant } from '@/lib/api-auth'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/billing/invoices/[id]/generate
// Body: { invoiceNumber: string; bookingType: 'SALES' | 'SERVICE' }
//
// Validates:
//  - invoiceNumber is non-empty
//  - invoiceNumber is unique within the tenant (compliance requirement)
//  - The referenced booking/service-booking is in an invoiceable state
//
// On success: inserts into invoices table and returns the stored invoice row.

export async function POST(req: NextRequest, { params }: Ctx) {
  const { tenant, userId, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  try {
    const body = await req.json() as { invoiceNumber?: string; bookingType?: string }

    const invoiceNumber = body.invoiceNumber?.trim() ?? ''
    if (!invoiceNumber) {
      return NextResponse.json({ error: 'Invoice number is required' }, { status: 400 })
    }

    const bookingType = body.bookingType === 'SERVICE' ? 'SERVICE' : 'SALES'

    // Uniqueness check — duplicate GST invoice numbers are a compliance problem
    const [existing] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenant.id), eq(invoices.invoiceNumber, invoiceNumber)))
      .limit(1)

    if (existing) {
      return NextResponse.json(
        { error: `Invoice number "${invoiceNumber}" already exists for this tenant` },
        { status: 409 },
      )
    }

    // Clerk userId ("user_XXX") is not a UUID — resolve to internal users.id
    // for the generated_by FK. Fall back to null rather than crashing.
    const [internalUser] = userId
      ? await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.tenantId, tenant.id), eq(users.clerkUserId, userId)))
          .limit(1)
      : []
    const generatedBy = internalUser?.id ?? null

    if (bookingType === 'SALES') {
      const [booking] = await db
        .select({ id: bookings.id, status: bookings.status })
        .from(bookings)
        .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenant.id)))
        .limit(1)

      if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
      }
      if (booking.status !== 'CONFIRMED' && booking.status !== 'DELIVERED') {
        return NextResponse.json(
          { error: `Invoice can only be generated for CONFIRMED or DELIVERED bookings (current: ${booking.status})` },
          { status: 400 },
        )
      }

      const [invoice] = await db
        .insert(invoices)
        .values({
          tenantId:     tenant.id,
          invoiceNumber,
          bookingId:    id,
          generatedBy,
        })
        .returning()

      return NextResponse.json(invoice, { status: 201 })
    }

    // SERVICE booking
    const [svcBooking] = await db
      .select({ id: serviceBookings.id, status: serviceBookings.status })
      .from(serviceBookings)
      .where(and(eq(serviceBookings.id, id), eq(serviceBookings.tenantId, tenant.id)))
      .limit(1)

    if (!svcBooking) {
      return NextResponse.json({ error: 'Service booking not found' }, { status: 404 })
    }
    if (svcBooking.status !== 'COMPLETED' && svcBooking.status !== 'DELIVERED') {
      return NextResponse.json(
        { error: `Invoice can only be generated for COMPLETED or DELIVERED service bookings (current: ${svcBooking.status})` },
        { status: 400 },
      )
    }

    const [invoice] = await db
      .insert(invoices)
      .values({
        tenantId:        tenant.id,
        invoiceNumber,
        serviceBookingId: id,
        generatedBy,
      })
      .returning()

    return NextResponse.json(invoice, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[invoices/generate] failed for booking', id, e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

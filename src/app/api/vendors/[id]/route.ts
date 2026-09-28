export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { vendors, vendorTypeEnum, vendorCategoryEnum } from '@/db/schema/inventory'
import { requireTenant } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'

type Ctx = { params: Promise<{ id: string }> }

const VENDOR_TYPES      = vendorTypeEnum.enumValues
const VENDOR_CATEGORIES = vendorCategoryEnum.enumValues

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  const [vendor] = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.id, id), eq(vendors.tenantId, tenant.id)))
    .limit(1)

  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
  return NextResponse.json(vendor)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  const existing = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(and(eq(vendors.id, id), eq(vendors.tenantId, tenant.id)))
    .limit(1)

  if (!existing.length) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

  const body = await req.json() as Record<string, string | undefined>

  const {
    vendorType, vendorCategory, name, tradeName, contactPerson,
    phone, email, website, pan, gstin, msmeStatus, udyamNo,
    addressLine1, addressLine2, city, state, pincode, country,
    bankName, bankAccountName, accountNumber, ifscCode, bankBranch,
    openingBalance, openingBalanceType, openingBalanceRemarks,
  } = body

  if (name     !== undefined && !name.trim())         return NextResponse.json({ error: 'Vendor Name cannot be empty' },  { status: 400 })
  if (phone    !== undefined && !phone.trim())        return NextResponse.json({ error: 'Mobile No. cannot be empty' },   { status: 400 })
  if (addressLine1 !== undefined && !addressLine1.trim()) return NextResponse.json({ error: 'Address Line 1 cannot be empty' }, { status: 400 })
  if (city     !== undefined && !city.trim())         return NextResponse.json({ error: 'City cannot be empty' },         { status: 400 })
  if (state    !== undefined && !state.trim())        return NextResponse.json({ error: 'State cannot be empty' },        { status: 400 })
  if (pincode  !== undefined && !pincode.trim())      return NextResponse.json({ error: 'PIN cannot be empty' },          { status: 400 })

  const updates: Record<string, unknown> = {}
  if (vendorType !== undefined && VENDOR_TYPES.includes(vendorType as typeof VENDOR_TYPES[number]))
    updates.vendorType = vendorType as typeof VENDOR_TYPES[number]
  if (vendorCategory !== undefined && VENDOR_CATEGORIES.includes(vendorCategory as typeof VENDOR_CATEGORIES[number]))
    updates.vendorCategory = vendorCategory as typeof VENDOR_CATEGORIES[number]
  if (name              !== undefined) updates.name                  = name.trim()
  if (tradeName         !== undefined) updates.tradeName             = tradeName.trim()             || null
  if (contactPerson     !== undefined) updates.contactPerson         = contactPerson.trim()         || null
  if (phone             !== undefined) updates.phone                 = phone.trim()
  if (email             !== undefined) updates.email                 = email.trim()                 || null
  if (website           !== undefined) updates.website               = website.trim()               || null
  if (pan               !== undefined) updates.pan                   = pan.trim()                   || null
  if (gstin             !== undefined) updates.gstin                 = gstin.trim()                 || null
  if (msmeStatus        !== undefined) updates.msmeStatus            = msmeStatus.trim()            || null
  if (udyamNo           !== undefined) updates.udyamNo               = udyamNo.trim()               || null
  if (addressLine1      !== undefined) updates.addressLine1          = addressLine1.trim()
  if (addressLine2      !== undefined) updates.addressLine2          = addressLine2.trim()          || null
  if (city              !== undefined) updates.city                  = city.trim()
  if (state             !== undefined) updates.state                 = state.trim()
  if (pincode           !== undefined) updates.pincode               = pincode.trim()
  if (country           !== undefined) updates.country               = country.trim()               || 'India'
  if (bankName          !== undefined) updates.bankName              = bankName.trim()              || null
  if (bankAccountName   !== undefined) updates.bankAccountName       = bankAccountName.trim()       || null
  if (accountNumber     !== undefined) updates.accountNumber         = accountNumber.trim()         || null
  if (ifscCode          !== undefined) updates.ifscCode              = ifscCode.trim()              || null
  if (bankBranch        !== undefined) updates.bankBranch            = bankBranch.trim()            || null
  if (openingBalance    !== undefined) updates.openingBalance        = openingBalance.trim()        || null
  if (openingBalanceType !== undefined) updates.openingBalanceType   = openingBalanceType.trim()    || null
  if (openingBalanceRemarks !== undefined) updates.openingBalanceRemarks = openingBalanceRemarks.trim() || null

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  const [updated] = await db
    .update(vendors)
    .set(updates)
    .where(and(eq(vendors.id, id), eq(vendors.tenantId, tenant.id)))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { tenant, userId, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  const [deleted] = await db
    .delete(vendors)
    .where(and(eq(vendors.id, id), eq(vendors.tenantId, tenant.id)))
    .returning()

  if (!deleted) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

  logAudit({
    tenantId: tenant.id,
    userId,
    action:   'VENDOR_DELETED',
    module:   'Master',
    recordId: id,
    details:  { name: deleted.name, vendorCode: deleted.vendorCode },
  })

  return NextResponse.json({ deleted: true })
}

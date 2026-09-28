export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, desc, count } from 'drizzle-orm'
import { db } from '@/db'
import { vendors, vendorTypeEnum, vendorCategoryEnum } from '@/db/schema/inventory'
import { requireTenant } from '@/lib/api-auth'

const VENDOR_TYPES     = vendorTypeEnum.enumValues
const VENDOR_CATEGORIES = vendorCategoryEnum.enumValues

export async function GET() {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const rows = await db
    .select()
    .from(vendors)
    .where(eq(vendors.tenantId, tenant.id))
    .orderBy(desc(vendors.createdAt))

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const body = await req.json() as Record<string, string | undefined>

  const {
    vendorType, vendorCategory, name, tradeName, contactPerson,
    phone, email, website, pan, gstin, msmeStatus, udyamNo,
    addressLine1, addressLine2, city, state, pincode, country,
    bankName, bankAccountName, accountNumber, ifscCode, bankBranch,
    openingBalance, openingBalanceType, openingBalanceRemarks,
  } = body

  if (!vendorType || !VENDOR_TYPES.includes(vendorType as typeof VENDOR_TYPES[number]))
    return NextResponse.json({ error: 'Vendor Type is required' }, { status: 400 })
  if (!vendorCategory || !VENDOR_CATEGORIES.includes(vendorCategory as typeof VENDOR_CATEGORIES[number]))
    return NextResponse.json({ error: 'Vendor Category is required' }, { status: 400 })
  if (!name?.trim())
    return NextResponse.json({ error: 'Vendor Name is required' }, { status: 400 })
  if (!phone?.trim())
    return NextResponse.json({ error: 'Mobile No. is required' }, { status: 400 })
  if (!addressLine1?.trim())
    return NextResponse.json({ error: 'Address Line 1 is required' }, { status: 400 })
  if (!city?.trim())
    return NextResponse.json({ error: 'City is required' }, { status: 400 })
  if (!state?.trim())
    return NextResponse.json({ error: 'State is required' }, { status: 400 })
  if (!pincode?.trim())
    return NextResponse.json({ error: 'PIN is required' }, { status: 400 })

  // Generate sequential vendor code per tenant
  const [{ total }] = await db
    .select({ total: count() })
    .from(vendors)
    .where(eq(vendors.tenantId, tenant.id))

  const vendorCode = `VND-${String(Number(total) + 1).padStart(4, '0')}`

  const [vendor] = await db
    .insert(vendors)
    .values({
      tenantId:              tenant.id,
      vendorCode,
      vendorType:            vendorType as typeof VENDOR_TYPES[number],
      vendorCategory:        vendorCategory as typeof VENDOR_CATEGORIES[number],
      name:                  name.trim(),
      tradeName:             tradeName?.trim()         || null,
      contactPerson:         contactPerson?.trim()     || null,
      phone:                 phone.trim(),
      email:                 email?.trim()             || null,
      website:               website?.trim()           || null,
      pan:                   pan?.trim()               || null,
      gstin:                 gstin?.trim()             || null,
      msmeStatus:            msmeStatus?.trim()        || null,
      udyamNo:               udyamNo?.trim()           || null,
      addressLine1:          addressLine1.trim(),
      addressLine2:          addressLine2?.trim()      || null,
      city:                  city.trim(),
      state:                 state.trim(),
      pincode:               pincode.trim(),
      country:               country?.trim()           || 'India',
      bankName:              bankName?.trim()          || null,
      bankAccountName:       bankAccountName?.trim()   || null,
      accountNumber:         accountNumber?.trim()     || null,
      ifscCode:              ifscCode?.trim()          || null,
      bankBranch:            bankBranch?.trim()        || null,
      openingBalance:        openingBalance?.trim()    || null,
      openingBalanceType:    openingBalanceType?.trim()|| null,
      openingBalanceRemarks: openingBalanceRemarks?.trim() || null,
    })
    .returning()

  return NextResponse.json(vendor, { status: 201 })
}

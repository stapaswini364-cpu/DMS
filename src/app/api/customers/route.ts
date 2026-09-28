export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, desc, count } from 'drizzle-orm'
import { db } from '@/db'
import { customers, customerTypeEnum, customerCategoryEnum } from '@/db/schema/inventory'
import { requireTenant } from '@/lib/api-auth'

const CUSTOMER_TYPES      = customerTypeEnum.enumValues
const CUSTOMER_CATEGORIES = customerCategoryEnum.enumValues

export async function GET() {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const rows = await db
    .select()
    .from(customers)
    .where(eq(customers.tenantId, tenant.id))
    .orderBy(desc(customers.createdAt))

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const body = await req.json() as Record<string, string | undefined>

  const {
    customerType, customerCategory,
    name, tradeName, contactPerson,
    phone, email, website,
    aadhar, pan, gstin, msmeStatus, udyamNo,
    address, addressLine2, city, state, pincode, country, stateCode,
    bankName, bankAccountName, accountNumber, ifscCode, bankBranch,
    openingBalance, openingBalanceType, openingBalanceRemarks,
  } = body

  if (!name?.trim())  return NextResponse.json({ error: 'name is required' },  { status: 400 })
  if (!phone?.trim()) return NextResponse.json({ error: 'phone is required' }, { status: 400 })

  // Generate sequential customer code per tenant
  const [{ total }] = await db
    .select({ total: count() })
    .from(customers)
    .where(eq(customers.tenantId, tenant.id))

  const customerCode = `CUST-${String(Number(total) + 1).padStart(4, '0')}`

  const resolvedType = (customerType && CUSTOMER_TYPES.includes(customerType as typeof CUSTOMER_TYPES[number]))
    ? (customerType as typeof CUSTOMER_TYPES[number])
    : null

  const resolvedCategory = (customerCategory && CUSTOMER_CATEGORIES.includes(customerCategory as typeof CUSTOMER_CATEGORIES[number]))
    ? (customerCategory as typeof CUSTOMER_CATEGORIES[number])
    : null

  const [customer] = await db
    .insert(customers)
    .values({
      tenantId:              tenant.id,
      customerCode,
      customerType:          resolvedType,
      customerCategory:      resolvedCategory,
      name:                  name.trim(),
      tradeName:             tradeName?.trim()             || null,
      contactPerson:         contactPerson?.trim()         || null,
      phone:                 phone.trim(),
      email:                 email?.trim()                 || null,
      website:               website?.trim()               || null,
      aadhar:                aadhar?.trim()                || null,
      pan:                   pan?.trim()                   || null,
      gstin:                 gstin?.trim()                 || null,
      msmeStatus:            msmeStatus?.trim()            || null,
      udyamNo:               udyamNo?.trim()               || null,
      address:               address?.trim()               || null,
      addressLine2:          addressLine2?.trim()          || null,
      city:                  city?.trim()                  || null,
      state:                 state?.trim()                 || null,
      pincode:               pincode?.trim()               || null,
      country:               country?.trim()               || 'India',
      stateCode:             stateCode?.trim()             || null,
      bankName:              bankName?.trim()              || null,
      bankAccountName:       bankAccountName?.trim()       || null,
      accountNumber:         accountNumber?.trim()         || null,
      ifscCode:              ifscCode?.trim()              || null,
      bankBranch:            bankBranch?.trim()            || null,
      openingBalance:        openingBalance?.trim()        || null,
      openingBalanceType:    openingBalanceType?.trim()    || null,
      openingBalanceRemarks: openingBalanceRemarks?.trim() || null,
    })
    .returning()

  return NextResponse.json(customer, { status: 201 })
}

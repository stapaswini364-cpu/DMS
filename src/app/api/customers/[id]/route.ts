export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { customers, customerTypeEnum, customerCategoryEnum } from '@/db/schema/inventory'
import { requireTenant } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'

type Ctx = { params: Promise<{ id: string }> }

const CUSTOMER_TYPES      = customerTypeEnum.enumValues
const CUSTOMER_CATEGORIES = customerCategoryEnum.enumValues

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.tenantId, tenant.id)))
    .limit(1)

  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  return NextResponse.json(customer)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  const existing = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.tenantId, tenant.id)))
    .limit(1)

  if (!existing.length) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

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

  if (name  !== undefined && !name.trim())  return NextResponse.json({ error: 'name cannot be empty' },  { status: 400 })
  if (phone !== undefined && !phone.trim()) return NextResponse.json({ error: 'phone cannot be empty' }, { status: 400 })

  const updates: Record<string, unknown> = {}

  if (customerType !== undefined) {
    updates.customerType = (CUSTOMER_TYPES.includes(customerType as typeof CUSTOMER_TYPES[number]))
      ? (customerType as typeof CUSTOMER_TYPES[number])
      : null
  }
  if (customerCategory !== undefined) {
    updates.customerCategory = (CUSTOMER_CATEGORIES.includes(customerCategory as typeof CUSTOMER_CATEGORIES[number]))
      ? (customerCategory as typeof CUSTOMER_CATEGORIES[number])
      : null
  }

  const s = (v: string | undefined) => v !== undefined ? (v.trim() || null) : undefined
  const r = (v: string | undefined) => v !== undefined ? v.trim() : undefined

  if (name          !== undefined) updates.name          = name.trim()
  if (phone         !== undefined) updates.phone         = phone.trim()
  if (tradeName     !== undefined) updates.tradeName     = s(tradeName)
  if (contactPerson !== undefined) updates.contactPerson = s(contactPerson)
  if (email         !== undefined) updates.email         = s(email)
  if (website       !== undefined) updates.website       = s(website)
  if (aadhar        !== undefined) updates.aadhar        = s(aadhar)
  if (pan           !== undefined) updates.pan           = s(pan)
  if (gstin         !== undefined) updates.gstin         = s(gstin)
  if (msmeStatus    !== undefined) updates.msmeStatus    = s(msmeStatus)
  if (udyamNo       !== undefined) updates.udyamNo       = s(udyamNo)
  if (address       !== undefined) updates.address       = s(address)
  if (addressLine2  !== undefined) updates.addressLine2  = s(addressLine2)
  if (city          !== undefined) updates.city          = s(city)
  if (state         !== undefined) updates.state         = s(state)
  if (pincode       !== undefined) updates.pincode       = s(pincode)
  if (country       !== undefined) updates.country       = r(country) || 'India'
  if (stateCode     !== undefined) updates.stateCode     = s(stateCode)
  if (bankName      !== undefined) updates.bankName      = s(bankName)
  if (bankAccountName !== undefined) updates.bankAccountName = s(bankAccountName)
  if (accountNumber !== undefined) updates.accountNumber = s(accountNumber)
  if (ifscCode      !== undefined) updates.ifscCode      = s(ifscCode)
  if (bankBranch    !== undefined) updates.bankBranch    = s(bankBranch)
  if (openingBalance    !== undefined) updates.openingBalance    = s(openingBalance)
  if (openingBalanceType !== undefined) updates.openingBalanceType = s(openingBalanceType)
  if (openingBalanceRemarks !== undefined) updates.openingBalanceRemarks = s(openingBalanceRemarks)

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  const [updated] = await db
    .update(customers)
    .set(updates)
    .where(and(eq(customers.id, id), eq(customers.tenantId, tenant.id)))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { tenant, userId, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  const [deleted] = await db
    .delete(customers)
    .where(and(eq(customers.id, id), eq(customers.tenantId, tenant.id)))
    .returning()

  if (!deleted) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  logAudit({
    tenantId: tenant.id,
    userId,
    action:   'CUSTOMER_DELETED',
    module:   'Master',
    recordId: id,
    details:  { name: deleted.name, phone: deleted.phone },
  })

  return NextResponse.json({ deleted: true })
}

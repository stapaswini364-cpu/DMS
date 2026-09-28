export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { locations, locationTypeEnum, branchTypeEnum } from '@/db/schema/auth'
import { requireTenant } from '@/lib/api-auth'

const LOC_TYPES    = locationTypeEnum.enumValues
const BRANCH_TYPES = branchTypeEnum.enumValues

export async function GET() {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const rows = await db
    .select()
    .from(locations)
    .where(eq(locations.tenantId, tenant.id))
    .orderBy(locations.name)

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const body = await req.json()
  const {
    name, type, branchType,
    inchargeName, phone, email,
    address, city, state, pincode,
    bankName, accountNumber, ifscCode, accountType, bankBranchName,
  } = body as Record<string, string | undefined>

  if (!name?.trim())         return NextResponse.json({ error: 'Branch name is required' },    { status: 400 })
  if (!inchargeName?.trim()) return NextResponse.json({ error: 'Incharge name is required' }, { status: 400 })
  if (!address?.trim())      return NextResponse.json({ error: 'Address is required' },        { status: 400 })
  if (!city?.trim())         return NextResponse.json({ error: 'City is required' },           { status: 400 })
  if (!state?.trim())        return NextResponse.json({ error: 'State is required' },          { status: 400 })

  const locType = (type && LOC_TYPES.includes(type as typeof LOC_TYPES[number]))
    ? (type as typeof LOC_TYPES[number])
    : 'HO'

  const bType = (branchType && BRANCH_TYPES.includes(branchType as typeof BRANCH_TYPES[number]))
    ? (branchType as typeof BRANCH_TYPES[number])
    : null

  const [location] = await db
    .insert(locations)
    .values({
      tenantId:       tenant.id,
      name:           name.trim(),
      type:           locType,
      branchType:     bType,
      inchargeName:   inchargeName.trim(),
      phone:          phone?.trim()          || null,
      email:          email?.trim()          || null,
      address:        address.trim(),
      city:           city.trim(),
      state:          state.trim(),
      pincode:        pincode?.trim()        || null,
      bankName:       bankName?.trim()       || null,
      accountNumber:  accountNumber?.trim()  || null,
      ifscCode:       ifscCode?.trim()       || null,
      accountType:    accountType?.trim()    || null,
      bankBranchName: bankBranchName?.trim() || null,
    })
    .returning()

  return NextResponse.json(location, { status: 201 })
}

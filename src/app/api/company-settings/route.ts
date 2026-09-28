export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { companySettings } from '@/db/schema/auth'
import { requireTenant } from '@/lib/api-auth'
import { currentFyStartIso } from '@/lib/tenant-settings'

// GET — returns the tenant's company settings with defaults filled in.
// Does NOT create a row; callers must PUT to persist for the first time.
export async function GET() {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const [row] = await db
    .select()
    .from(companySettings)
    .where(eq(companySettings.tenantId, tenant.id))
    .limit(1)

  const fyStartMonth = row?.fyStartMonth ?? 4
  const fyStartDay   = row?.fyStartDay   ?? 1

  return NextResponse.json({
    companyName:        row?.companyName        ?? null,
    companyCategory:    row?.companyCategory    ?? null,
    email:              row?.email              ?? null,
    phone:              row?.phone              ?? null,
    website:            row?.website            ?? null,
    address:            row?.address            ?? null,
    state:              row?.state              ?? null,
    country:            row?.country            ?? 'India',
    pincode:            row?.pincode            ?? null,
    mailingName:        row?.mailingName        ?? null,
    fyStartMonth,
    fyStartDay,
    fyStartDate:        currentFyStartIso(fyStartMonth, fyStartDay),
    booksBeginningFrom: row?.booksBeginningFrom ?? null,
    gstin:              row?.gstin              ?? null,
    pan:                row?.pan                ?? null,
    msme:               row?.msme               ?? null,
    tan:                row?.tan                ?? null,
    cin:                row?.cin                ?? null,
    bankName:           row?.bankName           ?? null,
    accountNumber:      row?.accountNumber      ?? null,
    ifscCode:           row?.ifscCode           ?? null,
    accountType:        row?.accountType        ?? null,
    currencySymbol:     row?.currencySymbol     ?? '₹',
    currencyFormalName: row?.currencyFormalName ?? 'INR - Indian Rupee',
    logoUrl:            row?.logoUrl            ?? null,
  })
}

// PUT — upsert company settings (insert on first save, update on subsequent saves).
export async function PUT(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const body = await req.json() as Record<string, string | number | null | undefined>

  const {
    companyName, companyCategory, email, phone, website,
    address, state, country, pincode, mailingName,
    fyStartMonth, fyStartDay, booksBeginningFrom,
    gstin, pan, msme, tan, cin,
    bankName, accountNumber, ifscCode, accountType,
    currencySymbol, currencyFormalName,
  } = body

  // Basic validation for required-by-UI fields
  if (companyName !== undefined && !String(companyName ?? '').trim())
    return NextResponse.json({ error: 'Company name cannot be empty' }, { status: 400 })
  if (pan !== undefined && pan !== null && pan !== '' && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(pan).trim()))
    return NextResponse.json({ error: 'PAN must be in the format AAAAA9999A' }, { status: 400 })

  const fyMonth = fyStartMonth !== undefined ? Number(fyStartMonth) : undefined
  const fyDay   = fyStartDay   !== undefined ? Number(fyStartDay)   : undefined
  if (fyMonth !== undefined && (isNaN(fyMonth) || fyMonth < 1 || fyMonth > 12))
    return NextResponse.json({ error: 'fyStartMonth must be 1–12' }, { status: 400 })
  if (fyDay !== undefined && (isNaN(fyDay) || fyDay < 1 || fyDay > 31))
    return NextResponse.json({ error: 'fyStartDay must be 1–31' }, { status: 400 })

  const s = (v: unknown) => (v !== undefined && v !== null ? String(v).trim() || null : undefined)

  const values = {
    tenantId:           tenant.id,
    companyName:        s(companyName),
    companyCategory:    s(companyCategory),
    email:              s(email),
    phone:              s(phone),
    website:            s(website),
    address:            s(address),
    state:              s(state),
    country:            s(country) ?? 'India',
    pincode:            s(pincode),
    mailingName:        s(mailingName),
    fyStartMonth:       fyMonth ?? 4,
    fyStartDay:         fyDay   ?? 1,
    booksBeginningFrom: s(booksBeginningFrom) ?? null,
    gstin:              s(gstin),
    pan:                s(pan),
    msme:               s(msme),
    tan:                s(tan),
    cin:                s(cin),
    bankName:           s(bankName),
    accountNumber:      s(accountNumber),
    ifscCode:           s(ifscCode),
    accountType:        s(accountType),
    currencySymbol:     s(currencySymbol) ?? '₹',
    currencyFormalName: s(currencyFormalName) ?? 'INR - Indian Rupee',
    updatedAt:          new Date(),
  }

  // Remove undefined entries (fields not sent in body) — keep only provided fields for upsert
  const cleanValues = Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== undefined),
  ) as typeof values

  const [updated] = await db
    .insert(companySettings)
    .values({ ...cleanValues, tenantId: tenant.id, fyStartMonth: fyMonth ?? 4, fyStartDay: fyDay ?? 1 })
    .onConflictDoUpdate({
      target: companySettings.tenantId,
      set: cleanValues,
    })
    .returning()

  return NextResponse.json(updated)
}

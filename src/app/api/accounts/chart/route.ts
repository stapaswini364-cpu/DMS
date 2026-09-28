export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { chartOfAccounts, accountTypeEnum } from '@/db/schema/accounting'
import { requireTenant } from '@/lib/api-auth'

const ACCOUNT_TYPES = accountTypeEnum.enumValues

export async function GET(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { searchParams } = new URL(req.url)
  const typeParam     = searchParams.get('type')
  const parentIdParam = searchParams.get('parentId')

  if (typeParam && !ACCOUNT_TYPES.includes(typeParam as typeof ACCOUNT_TYPES[number])) {
    return NextResponse.json(
      { error: `type must be one of: ${ACCOUNT_TYPES.join(', ')}` },
      { status: 400 },
    )
  }

  const conditions = [
    eq(chartOfAccounts.tenantId, tenant.id),
    eq(chartOfAccounts.isActive, true),
    ...(typeParam     ? [eq(chartOfAccounts.accountType, typeParam as typeof ACCOUNT_TYPES[number])] : []),
    ...(parentIdParam === 'null'
      ? [isNull(chartOfAccounts.parentId)]
      : parentIdParam
        ? [eq(chartOfAccounts.parentId, parentIdParam)]
        : []),
  ]

  const rows = await db.query.chartOfAccounts.findMany({
    where: and(...conditions),
    with: {
      children: {
        where: eq(chartOfAccounts.isActive, true),
        columns: { id: true, accountCode: true, accountName: true, accountType: true },
      },
    },
    orderBy: (a, { asc }) => [asc(a.accountCode)],
  })

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const body = await req.json()
  const { accountCode, accountName, accountType, parentId, majorHead, subHead } =
    body as Record<string, string | undefined>

  if (!accountCode?.trim()) return NextResponse.json({ error: 'accountCode is required' }, { status: 400 })
  if (!accountName?.trim()) return NextResponse.json({ error: 'accountName is required' }, { status: 400 })
  if (!accountType)         return NextResponse.json({ error: 'accountType is required' }, { status: 400 })

  if (!ACCOUNT_TYPES.includes(accountType as typeof ACCOUNT_TYPES[number])) {
    return NextResponse.json(
      { error: `accountType must be one of: ${ACCOUNT_TYPES.join(', ')}` },
      { status: 400 },
    )
  }

  // Unique accountCode per tenant
  const [duplicate] = await db
    .select({ id: chartOfAccounts.id })
    .from(chartOfAccounts)
    .where(
      and(
        eq(chartOfAccounts.tenantId, tenant.id),
        eq(chartOfAccounts.accountCode, accountCode.trim()),
      ),
    )
    .limit(1)

  if (duplicate) {
    return NextResponse.json(
      { error: `Account code '${accountCode.trim()}' already exists` },
      { status: 400 },
    )
  }

  // Verify parent belongs to same tenant if provided
  if (parentId) {
    const [parent] = await db
      .select({ id: chartOfAccounts.id })
      .from(chartOfAccounts)
      .where(
        and(
          eq(chartOfAccounts.id, parentId),
          eq(chartOfAccounts.tenantId, tenant.id),
        ),
      )
      .limit(1)

    if (!parent) return NextResponse.json({ error: 'Parent account not found' }, { status: 404 })
  }

  const [account] = await db
    .insert(chartOfAccounts)
    .values({
      tenantId:    tenant.id,
      accountCode: accountCode.trim(),
      accountName: accountName.trim(),
      accountType: accountType as typeof ACCOUNT_TYPES[number],
      parentId:    parentId   ?? null,
      majorHead:   majorHead?.trim() ?? null,
      subHead:     subHead?.trim()   ?? null,
      isSystem:    false,
      isActive:    true,
    })
    .returning()

  return NextResponse.json(account, { status: 201 })
}

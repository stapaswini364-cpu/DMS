export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/db'
import { tenants, planEnum, tenantStatusEnum } from '@/db/schema/auth'

const CLERK_BASE = 'https://api.clerk.com/v1'
const PLANS    = planEnum.enumValues
const STATUSES = tenantStatusEnum.enumValues

type Ctx = { params: Promise<{ tenantId: string }> }

function clerkHeaders() {
  return {
    Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function guardSuperAdmin() {
  const user = await currentUser()
  if (user?.publicMetadata?.role !== 'super_admin') return false
  return true
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  if (!await guardSuperAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { tenantId } = await params

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  // Fetch Clerk org metadata (admin email) + members in parallel
  const [orgRes, membRes] = await Promise.all([
    fetch(`${CLERK_BASE}/organizations/${tenant.clerkOrgId}`, {
      headers: clerkHeaders(), cache: 'no-store',
    }),
    fetch(`${CLERK_BASE}/organizations/${tenant.clerkOrgId}/memberships?limit=100`, {
      headers: clerkHeaders(), cache: 'no-store',
    }),
  ])

  const adminEmail = orgRes.ok
    ? ((await orgRes.json()).public_metadata?.adminEmail ?? '—')
    : '—'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members: any[] = membRes.ok ? ((await membRes.json()).data ?? []) : []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memberList = members.map((m: any) => ({
    id:        m.id,
    name:      [m.public_user_data?.first_name, m.public_user_data?.last_name].filter(Boolean).join(' ') || '—',
    email:     m.public_user_data?.identifier ?? '—',
    role:      m.role ?? '',
    joinedAt:  m.created_at ? new Date(m.created_at).toISOString() : null,
  }))

  return NextResponse.json({ ...tenant, adminEmail, members: memberList })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!await guardSuperAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { tenantId } = await params
  const body = await req.json()

  const updates: Record<string, string> = {}

  if (body.plan !== undefined) {
    if (!PLANS.includes(body.plan)) {
      return NextResponse.json({ error: `plan must be one of: ${PLANS.join(', ')}` }, { status: 400 })
    }
    updates.plan = body.plan
  }

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `status must be one of: ${STATUSES.join(', ')}` }, { status: 400 })
    }
    updates.status = body.status
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const [updated] = await db
    .update(tenants)
    .set(updates)
    .where(eq(tenants.id, tenantId))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  return NextResponse.json(updated)
}

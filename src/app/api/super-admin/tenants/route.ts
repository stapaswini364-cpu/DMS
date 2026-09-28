export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/db'
import { tenants } from '@/db/schema/auth'
import { seedChartOfAccounts } from '@/lib/accounting/seed-coa'
import { getAppOrigin } from '@/lib/app-origin'

const CLERK_BASE = 'https://api.clerk.com/v1'

function clerkHeaders() {
  return {
    Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  }
}

export async function POST(req: NextRequest) {
  const user = await currentUser()
  if (user?.publicMetadata?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body       = await req.json()
  const name       = String(body.name       ?? '').trim()
  const adminEmail = String(body.adminEmail ?? '').trim().toLowerCase()
  const adminName  = String(body.adminName  ?? '').trim()

  if (!name)       return NextResponse.json({ error: 'Dealership name is required' }, { status: 400 })
  if (!adminEmail) return NextResponse.json({ error: 'Admin email is required' },     { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail))
    return NextResponse.json({ error: 'Invalid admin email address' }, { status: 400 })

  // ── 1. Create Clerk organisation ──────────────────────────────────────────
  const orgRes = await fetch(`${CLERK_BASE}/organizations`, {
    method:  'POST',
    headers: clerkHeaders(),
    body:    JSON.stringify({
      name,
      public_metadata: { adminEmail, adminName: adminName || undefined },
    }),
  })

  if (!orgRes.ok) {
    const body = await orgRes.json().catch(() => ({}))
    const msg  = body?.errors?.[0]?.long_message
              ?? body?.errors?.[0]?.message
              ?? 'Failed to create Clerk organisation'
    return NextResponse.json({ error: msg }, { status: orgRes.status })
  }

  const org: { id: string } = await orgRes.json()
  const clerkOrgId = org.id

  // ── 2. Invite dealer admin ────────────────────────────────────────────────
  const invRes = await fetch(
    `${CLERK_BASE}/organizations/${clerkOrgId}/invitations`,
    {
      method:  'POST',
      headers: clerkHeaders(),
      body:    JSON.stringify({
        email_address:   adminEmail,
        role:            'org:admin',
        public_metadata: { adminName: adminName || undefined },
        redirect_url:    `${getAppOrigin(req)}/sign-up`,
      }),
    },
  )

  // Non-fatal: log but don't fail if invite couldn't be sent
  if (!invRes.ok) {
    const invBody = await invRes.json().catch(() => ({}))
    console.error(
      'Clerk invitation failed for org', clerkOrgId,
      invBody?.errors?.[0]?.message ?? invRes.status,
    )
  }

  // ── 3. Persist tenant ─────────────────────────────────────────────────────
  const [tenant] = await db
    .insert(tenants)
    .values({ name, clerkOrgId })
    .returning()

  // ── 4. Seed default Chart of Accounts ─────────────────────────────────────
  // Non-fatal: a failed seed leaves the tenant creatable but flagged so the
  // super_admin can retry via the "Seed Chart of Accounts" button.
  let coaSeeded = false
  let coaError: string | null = null
  try {
    const result = await seedChartOfAccounts(tenant.id)
    coaSeeded = result.seeded || result.alreadySeeded
  } catch (e) {
    coaError = e instanceof Error ? e.message : String(e)
    console.error('[super-admin/tenants] COA seed failed for', tenant.id, e)
  }

  return NextResponse.json(
    { ...tenant, adminEmail, inviteSent: invRes.ok, coaSeeded, coaError },
    { status: 201 },
  )
}

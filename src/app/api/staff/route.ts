export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api-auth'

const CLERK_BASE = 'https://api.clerk.com/v1'

function clerkHeaders() {
  return {
    Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  }
}

export async function GET() {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const orgId = tenant.clerkOrgId

  const [membRes, invRes] = await Promise.all([
    fetch(`${CLERK_BASE}/organizations/${orgId}/memberships?limit=100`, {
      headers: clerkHeaders(),
      cache: 'no-store',
    }),
    fetch(`${CLERK_BASE}/organizations/${orgId}/invitations?status=pending&limit=100`, {
      headers: clerkHeaders(),
      cache: 'no-store',
    }),
  ])

  if (!membRes.ok || !invRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch staff from Clerk' }, { status: 502 })
  }

  const [membData, invData] = await Promise.all([membRes.json(), invRes.json()])

  // Active members
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members = (membData.data ?? []).map((m: any) => ({
    id:          m.id,
    userId:      m.public_user_data?.user_id ?? null,
    type:        'member' as const,
    name:        [m.public_user_data?.first_name, m.public_user_data?.last_name].filter(Boolean).join(' ') || '—',
    email:       m.public_user_data?.identifier ?? '—',
    faatproRole: m.public_metadata?.faatproRole ?? '',
    clerkRole:   m.role ?? '',
    joinedAt:    m.created_at ? new Date(m.created_at).toISOString() : null,
    status:      'active' as const,
  }))

  // Pending invitations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invitations = (invData.data ?? []).map((inv: any) => ({
    id:          inv.id,
    userId:      null,
    type:        'invitation' as const,
    name:        inv.public_metadata?.staffName ?? '—',
    email:       inv.email_address ?? '—',
    faatproRole: inv.public_metadata?.faatproRole ?? '',
    clerkRole:   inv.role ?? '',
    joinedAt:    null,
    status:      'pending' as const,
  }))

  return NextResponse.json([...members, ...invitations])
}

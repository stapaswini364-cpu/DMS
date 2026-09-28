export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api-auth'

const CLERK_BASE = 'https://api.clerk.com/v1'

type Ctx = { params: Promise<{ id: string }> }

// type=member  → removes the active org membership  (needs userId, not orgmem id)
// type=invitation → revokes a pending invitation    (needs invitation id)
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id }  = await params
  const type    = req.nextUrl.searchParams.get('type')   // 'member' | 'invitation'
  const userId  = req.nextUrl.searchParams.get('userId') // only for member type

  const orgId = tenant.clerkOrgId

  let clerkRes: Response

  if (type === 'invitation') {
    // Revoke pending invitation
    clerkRes = await fetch(
      `${CLERK_BASE}/organizations/${orgId}/invitations/${id}/revoke`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    )
  } else {
    // Remove active member — Clerk DELETE uses the user ID, not orgmem ID
    const target = userId ?? id
    clerkRes = await fetch(
      `${CLERK_BASE}/organizations/${orgId}/memberships/${target}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
      },
    )
  }

  if (!clerkRes.ok) {
    const body    = await clerkRes.json().catch(() => ({}))
    const message = body?.errors?.[0]?.long_message
                 ?? body?.errors?.[0]?.message
                 ?? 'Failed to remove staff member'
    return NextResponse.json({ error: message }, { status: clerkRes.status })
  }

  return NextResponse.json({ removed: true })
}

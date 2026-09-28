export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api-auth'
import { getAppOrigin } from '@/lib/app-origin'

const CLERK_BASE = 'https://api.clerk.com/v1'

export async function POST(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const body = await req.json()
  const email       = String(body.email ?? '').trim().toLowerCase()
  const faatproRole = String(body.role  ?? '').trim()
  const staffName   = String(body.name  ?? '').trim()
  const permissions = Array.isArray(body.permissions) ? body.permissions.map(String) : []

  if (!email)       return NextResponse.json({ error: 'email is required' },       { status: 400 })
  if (!faatproRole) return NextResponse.json({ error: 'role is required' },        { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: 'invalid email address' }, { status: 400 })

  const orgId = tenant.clerkOrgId

  const clerkRes = await fetch(
    `${CLERK_BASE}/organizations/${orgId}/invitations`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address:   email,
        role:            'org:member',
        public_metadata: { faatproRole, staffName, permissions },
        redirect_url:    `${getAppOrigin(req)}/sign-up`,
      }),
    },
  )

  if (!clerkRes.ok) {
    const clerkBody = await clerkRes.json().catch(() => ({}))
    const message   = clerkBody?.errors?.[0]?.long_message
                   ?? clerkBody?.errors?.[0]?.message
                   ?? 'Failed to send invitation'
    return NextResponse.json({ error: message }, { status: clerkRes.status })
  }

  const invitation = await clerkRes.json()
  return NextResponse.json({ invited: true, email, id: invitation.id }, { status: 201 })
}

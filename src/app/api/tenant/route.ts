export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCurrentTenant } from '@/lib/tenant'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await getCurrentTenant()
  if (!tenant) return NextResponse.json(null, { status: 200 })

  return NextResponse.json(tenant)
}

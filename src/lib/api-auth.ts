import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getCurrentTenant } from './tenant'
import type { Tenant } from '@/db/schema/auth'

type AuthSuccess = { tenant: Tenant; userId: string; err: null }
type AuthFailure = { tenant: null; userId: null; err: NextResponse }

export async function requireTenant(): Promise<AuthSuccess | AuthFailure> {
  const { userId } = await auth()
  if (!userId) {
    return { tenant: null, userId: null, err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const tenant = await getCurrentTenant()
  if (!tenant) {
    return { tenant: null, userId: null, err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { tenant, userId, err: null }
}

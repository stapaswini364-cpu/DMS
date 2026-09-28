import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { tenants } from '@/db/schema/auth'
import type { Tenant } from '@/db/schema/auth'

export async function getCurrentTenant(): Promise<Tenant | null> {
  const { orgId } = await auth()
  if (!orgId) return null

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.clerkOrgId, orgId))
    .limit(1)

  return tenant ?? null
}

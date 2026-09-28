export const dynamic = 'force-dynamic'

import { currentUser } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { tenants } from '@/db/schema/auth'
import { coaLedgers } from '@/db/schema/accounting'
import TenantActions from './TenantActions'
import SeedCoaButton from './SeedCoaButton'

const CLERK_BASE = 'https://api.clerk.com/v1'

function clerkHeaders() {
  return { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` }
}

type Member = {
  id:       string
  name:     string
  email:    string
  role:     string
  joinedAt: string | null
}

const ROLE_LABEL: Record<string, string> = {
  'org:admin':  'Admin',
  'org:member': 'Member',
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE:    'fp-badge-active',
  SUSPENDED: 'fp-badge-suspended',
  TRIAL:     'fp-badge-trial',
}

type Ctx = { params: Promise<{ tenantId: string }> }

export default async function TenantDetailPage({ params }: Ctx) {
  const user = await currentUser()
  if (user?.publicMetadata?.role !== 'super_admin') redirect('/dashboard')

  const { tenantId } = await params

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  if (!tenant) notFound()

  const [orgRes, membRes, ledgerCountRow] = await Promise.all([
    fetch(`${CLERK_BASE}/organizations/${tenant.clerkOrgId}`, {
      headers: clerkHeaders(), cache: 'no-store',
    }),
    fetch(`${CLERK_BASE}/organizations/${tenant.clerkOrgId}/memberships?limit=100`, {
      headers: clerkHeaders(), cache: 'no-store',
    }),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(coaLedgers)
      .where(eq(coaLedgers.tenantId, tenant.id))
      .then(rows => rows[0]),
  ])

  const ledgerCount = Number(ledgerCountRow?.n ?? 0)

  const adminEmail: string = orgRes.ok
    ? ((await orgRes.json()).public_metadata?.adminEmail ?? '—')
    : '—'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawMembers: any[] = membRes.ok ? ((await membRes.json()).data ?? []) : []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members: Member[] = rawMembers.map((m: any) => ({
    id:       m.id,
    name:     [m.public_user_data?.first_name, m.public_user_data?.last_name].filter(Boolean).join(' ') || '—',
    email:    m.public_user_data?.identifier ?? '—',
    role:     m.role ?? '',
    joinedAt: m.created_at ? new Date(m.created_at).toISOString() : null,
  }))

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/super-admin" className="text-sm hover:underline" style={{ color: '#64748B' }}>
          ← Super Admin
        </Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">{tenant.name}</h1>
      </div>

      <div className="fp-card p-6 mb-6">
        <h2 className="text-sm font-semibold text-[#1E293B] mb-4">Dealership Details</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <dt className="text-xs mb-0.5" style={{ color: '#94A3B8' }}>Name</dt>
            <dd className="text-sm font-medium text-[#1E293B]">{tenant.name}</dd>
          </div>
          <div>
            <dt className="text-xs mb-0.5" style={{ color: '#94A3B8' }}>Admin Email</dt>
            <dd className="text-sm font-medium text-[#1E293B]">{adminEmail}</dd>
          </div>
          <div>
            <dt className="text-xs mb-0.5" style={{ color: '#94A3B8' }}>Plan</dt>
            <dd className="text-sm font-medium text-[#1E293B]">{tenant.plan}</dd>
          </div>
          <div>
            <dt className="text-xs mb-0.5" style={{ color: '#94A3B8' }}>Status</dt>
            <dd>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[tenant.status] ?? 'bg-[#F1F5F9] text-[#475569]'}`}>
                {tenant.status}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs mb-0.5" style={{ color: '#94A3B8' }}>Created</dt>
            <dd className="text-sm font-medium text-[#1E293B]">
              {new Date(tenant.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </dd>
          </div>
          <div>
            <dt className="text-xs mb-0.5" style={{ color: '#94A3B8' }}>Clerk Org ID</dt>
            <dd className="text-xs font-mono truncate" style={{ color: '#94A3B8' }}>{tenant.clerkOrgId}</dd>
          </div>
        </dl>
      </div>

      <div className="fp-card p-6 mb-6">
        <h2 className="text-sm font-semibold text-[#1E293B] mb-4">Actions</h2>
        <TenantActions
          tenantId={tenant.id}
          currentPlan={tenant.plan}
          currentStatus={tenant.status}
        />
      </div>

      <div className="fp-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#1E293B]">Chart of Accounts</h2>
          {ledgerCount > 0 && (
            <span className="fp-badge-active px-2 py-0.5 rounded-full text-xs font-medium">
              {ledgerCount} ledger{ledgerCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {ledgerCount === 0 ? (
          <SeedCoaButton tenantId={tenant.id} />
        ) : (
          <p className="text-xs" style={{ color: '#94A3B8' }}>
            Default Chart of Accounts is seeded for this dealership.
          </p>
        )}
      </div>

      <div className="fp-card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h2 className="text-sm font-semibold text-[#1E293B]">Members</h2>
          <span className="text-xs" style={{ color: '#94A3B8' }}>{members.length} member{members.length !== 1 ? 's' : ''}</span>
        </div>

        {members.length === 0 ? (
          <div className="py-10 text-center text-sm" style={{ color: '#94A3B8' }}>No members yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left fp-table">
              <thead>
                <tr>
                  {['Name', 'Email', 'Role', 'Joined'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id}>
                    <td className="font-medium text-[#1E293B]">{m.name}</td>
                    <td style={{ color: '#64748B' }}>{m.email}</td>
                    <td>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#FEE2E2] text-[#B91C1C]">
                        {ROLE_LABEL[m.role] ?? m.role}
                      </span>
                    </td>
                    <td className="text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>
                      {m.joinedAt
                        ? new Date(m.joinedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

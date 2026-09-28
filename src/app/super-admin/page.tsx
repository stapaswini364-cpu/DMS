export const dynamic = 'force-dynamic'

import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { desc } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/db'
import { tenants } from '@/db/schema/auth'
import AddDealershipForm from './AddDealershipForm'

async function fetchClerkOrgEmails(): Promise<Map<string, string>> {
  try {
    const res = await fetch(
      'https://api.clerk.com/v1/organizations?limit=200',
      {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
        cache: 'no-store',
      },
    )
    if (!res.ok) return new Map()
    const body = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Map((body.data ?? []).map((org: any) => [
      org.id as string,
      (org.public_metadata?.adminEmail as string) ?? '—',
    ]))
  } catch {
    return new Map()
  }
}

export default async function SuperAdminPage() {
  const user = await currentUser()

  if (user?.publicMetadata?.role !== 'super_admin') {
    redirect('/dashboard')
  }

  const [allTenants, orgEmailMap] = await Promise.all([
    db.select().from(tenants).orderBy(desc(tenants.createdAt)),
    fetchClerkOrgEmails(),
  ])

  const STATUS_STYLE: Record<string, string> = {
    ACTIVE:    'fp-badge-active',
    SUSPENDED: 'fp-badge-suspended',
    TRIAL:     'fp-badge-trial',
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B]">Super Admin Panel</h1>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
            {allTenants.length} dealership{allTenants.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <AddDealershipForm />
      </div>

      {allTenants.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl" style={{ color: '#94A3B8', borderColor: '#E2E8F0' }}>
          No dealerships yet. Add one to get started.
        </div>
      ) : (
        <div className="fp-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left fp-table">
              <thead>
                <tr>
                  {['Dealership Name', 'Admin Email', 'Plan', 'Status', 'Created', ''].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allTenants.map(t => (
                  <tr key={t.id}>
                    <td className="font-medium" style={{ color: '#1E293B' }}>{t.name}</td>
                    <td style={{ color: '#64748B' }}>{orgEmailMap.get(t.clerkOrgId) ?? '—'}</td>
                    <td style={{ color: '#374151' }}>{t.plan}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[t.status] ?? 'bg-[#F1F5F9] text-[#475569]'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap" style={{ color: '#94A3B8' }}>
                      {new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      <Link
                        href={`/super-admin/${t.id}`}
                        className="text-xs hover:underline whitespace-nowrap"
                        style={{ color: '#CC1133' }}
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useUser, useOrganization } from '@clerk/nextjs'
import Sidebar from '@/app/components/ui/Sidebar'

function deriveRole(
  publicMetaRole: unknown,
  membershipRole: string | undefined,
  hasActiveOrg:  boolean,
): string {
  if (typeof publicMetaRole === 'string' && publicMetaRole) {
    const role = publicMetaRole.toLowerCase()
    // super_admin inside a dealership org → act as admin for that org
    if (role === 'super_admin') return hasActiveOrg ? 'admin' : 'super_admin'
    return role
  }
  if (membershipRole === 'org:admin') return 'admin'
  return 'member'
}

export default function LayoutWithSidebar({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { user }                  = useUser()
  const { membership, organization } = useOrganization()

  const userRole = deriveRole(
    user?.publicMetadata?.role,
    membership?.role,
    !!organization,
  )

  const permissions = (membership?.publicMetadata?.permissions as string[] | undefined) ?? []

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userRole={userRole}
        permissions={permissions}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', color: '#1E293B' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 rounded transition"
            style={{ color: '#1E293B' }}
            aria-label="Open menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6"  x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="text-base font-bold tracking-wide text-white">DMS</span>
        </div>

        <main className="flex-1 overflow-y-auto" style={{ background: '#F5F7FA' }}>
          {children}
        </main>
      </div>
    </div>
  )
}

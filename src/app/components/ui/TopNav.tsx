'use client'

import Link from 'next/link'
import { useUser, useOrganization, OrganizationSwitcher, UserButton } from '@clerk/nextjs'
import TenantLogo from './TenantLogo'

export default function TopNav() {
  const { user, isSignedIn, isLoaded } = useUser()
  const { organization } = useOrganization()

  const isSuperAdmin = user?.publicMetadata?.role === 'super_admin'

  return (
    <header className="h-14 flex-shrink-0 flex items-center justify-between px-5 z-50" style={{ background: 'rgba(13,21,40,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span className="text-base font-bold tracking-wide text-white">DMS</span>

      <div className="flex-1 flex justify-center px-4">
        {organization && (
          <div className="flex items-center gap-2.5">
            <TenantLogo orgKey={organization.id} orgName={organization.name} />
            {isSuperAdmin ? (
              <OrganizationSwitcher
                hidePersonal={true}
                afterCreateOrganizationUrl="/dashboard"
                afterSelectOrganizationUrl="/dashboard"
                appearance={{
                  elements: {
                    rootBox: 'flex items-center',
                    organizationSwitcherTrigger:
                      'text-white/90 hover:text-white hover:bg-white/10 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                    organizationSwitcherTriggerIcon: 'text-white/60',
                    organizationPreviewAvatarBox: 'hidden',
                    createOrganizationButton: 'hidden',
                    organizationSwitcherPopoverActionButton__createOrganization: 'hidden',
                    organizationSwitcherPopoverFooter: 'hidden',
                  },
                }}
              />
            ) : (
              <span className="text-white/90 text-sm font-medium">{organization.name}</span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {isLoaded && !isSignedIn && (
          <Link
            href="/sign-in"
            className="text-white/90 hover:text-white hover:bg-white/10 rounded-lg px-4 py-1.5 text-sm font-medium transition"
          >
            Sign In
          </Link>
        )}
        {isSignedIn && (
          <UserButton
            appearance={{
              elements: { avatarBox: 'w-8 h-8' },
            }}
          />
        )}
      </div>
    </header>
  )
}

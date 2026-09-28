'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const ADMIN_ROLES = ['admin', 'super_admin', 'sub_admin']

type NavChild = { label: string; href: string }
type NavItem  = {
  label:       string
  href:        string
  roles:       string[]
  permission?: string        // module key checked against permissions[] for staff
  children?:   NavChild[]
}

const NAV_CONFIG: NavItem[] = [
  {
    label: 'Dashboard',
    href:  '/dashboard',
    roles: ['all'],
  },
  {
    label:      'Sales',
    href:       '/sales',
    roles:      ['admin', 'sub_admin', 'sales'],
    permission: 'sales',
  },
  {
    label:      'Service',
    href:       '/service',
    roles:      ['admin', 'sub_admin', 'services'],
    permission: 'service',
  },
  {
    label:      'Accounts',
    href:       '/accounts',
    roles:      ['admin', 'sub_admin', 'accounts'],
    permission: 'accounts',
  },
  {
    label:      'Billing',
    href:       '/billing',
    roles:      ['admin', 'sub_admin', 'billing', 'accounts'],
    permission: 'billing',
  },
  {
    label:      'Reports',
    href:       '/reports',
    roles:      ['admin', 'sub_admin', 'auditor'],
    permission: 'reports',
    children: [
      { label: 'Sales Report',  href: '/reports/sales' },
      { label: 'Daily Sales',   href: '/reports/daily-sales' },
      { label: 'Daily Service', href: '/reports/daily-service' },
      { label: 'Cash Flow',     href: '/reports/cash-flow' },
      { label: 'P&L Account',   href: '/reports/pl' },
      { label: 'Balance Sheet', href: '/reports/balance-sheet' },
      { label: 'Trial Balance', href: '/reports/trial-balance' },
      { label: 'GST Report',    href: '/reports/gst' },
      { label: 'TDS Report',    href: '/reports/tds' },
      { label: 'Outstanding',   href: '/reports/outstanding' },
      { label: 'Audit Trail',   href: '/reports/audit' },
    ],
  },
  {
    label:      'Master Data',
    href:       '/master',
    roles:      ['admin', 'sub_admin'],
    permission: 'master',
  },
]

type Props = {
  open:        boolean
  onClose:     () => void
  userRole:    string
  permissions: string[]
}

function canSee(link: NavItem, userRole: string, permissions: string[]): boolean {
  if (link.roles.includes('all')) return true
  if (ADMIN_ROLES.includes(userRole)) return true
  if (!link.permission) return false
  return permissions.includes(link.permission)
}

export default function Sidebar({ open, onClose, userRole, permissions }: Props) {
  const pathname = usePathname()
  const [reportsOpen, setReportsOpen] = useState(pathname.startsWith('/reports'))

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname === href || pathname.startsWith(href + '/')

  const visibleNav = NAV_CONFIG.filter(link => canSee(link, userRole, permissions))

  const inner = (
    <div className="w-64 h-full text-white flex flex-col overflow-y-auto" style={{ background: 'linear-gradient(180deg, #0F1F35 0%, #0A1628 100%)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="p-6 border-b border-white/[0.08] flex-shrink-0 flex items-center justify-between">
        <span className="text-lg font-bold tracking-wide text-white">DMS</span>
        <button
          onClick={onClose}
          className="md:hidden text-white/40 hover:text-white text-2xl leading-none"
          aria-label="Close menu"
        >
          ×
        </button>
      </div>

      <nav className="flex-1 p-4 flex flex-col gap-0.5">
        {visibleNav.map(link => {
          const active      = isActive(link.href)
          const hasChildren = !!link.children?.length
          const expanded    = hasChildren && reportsOpen

          return (
            <div key={link.href}>
              <Link
                href={link.href}
                onClick={e => {
                  if (hasChildren) {
                    e.preventDefault()
                    setReportsOpen(v => !v)
                  } else {
                    onClose()
                  }
                }}
                className={
                  active && !hasChildren
                    ? 'flex items-center justify-between px-4 py-2 rounded-md text-sm transition text-white font-semibold'
                    : active && hasChildren
                      ? 'flex items-center justify-between px-4 py-2 rounded-md text-sm transition text-white font-semibold'
                      : 'flex items-center justify-between px-4 py-2 rounded-md text-sm transition hover:text-white'
                }
                style={
                  active && !hasChildren
                    ? { background: 'rgba(204,17,51,0.15)', borderLeft: '3px solid #CC1133', color: 'white' }
                    : active && hasChildren
                      ? { background: 'rgba(255,255,255,0.05)', color: 'white' }
                      : { color: 'rgba(255,255,255,0.55)' }
                }
              >
                <span>{link.label}</span>
                {hasChildren && (
                  <span className={`text-xs transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} style={{ color: 'rgba(255,255,255,0.3)' }}>
                    ›
                  </span>
                )}
              </Link>

              {hasChildren && expanded && (
                <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l pl-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  {link.children!.map(child => (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onClose}
                      className={`px-3 py-1.5 rounded-md text-xs transition ${
                        pathname === child.href
                          ? 'text-white font-semibold'
                          : 'hover:text-white'
                      }`}
                      style={
                        pathname === child.href
                          ? { background: 'rgba(204,17,51,0.12)', color: 'white' }
                          : { color: 'rgba(255,255,255,0.4)' }
                      }
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </div>
  )

  return (
    <>
      <div className="hidden md:flex h-screen w-64 flex-shrink-0">
        {inner}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
          <div className="relative h-full">{inner}</div>
        </div>
      )}
    </>
  )
}

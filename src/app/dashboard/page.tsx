'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useUser, useOrganization, useClerk, SignOutButton } from '@clerk/nextjs'
import Link from 'next/link'
import LoadingSpinner from '@/app/components/ui/LoadingSpinner'

type Summary = {
  total: number; confirmed: number; delivered: number
  totalValue: string; cashValue: string; financeValue: string
}

type BookingRow = {
  id: string; bookingNumber: string; status: string; salesType: string
  grandTotal: string; pendingAmount: string; bookingDate: string
  customer: { name: string; phone: string } | null
  vehicle: {
    frameNumber: string
    variant: { name: string; model: { name: string; brand: string } } | null
    color: { colorName: string } | null
  } | null
}

type PLData = {
  totalIncome: string; totalExpense: string; netProfit: string; isProfit: boolean
}

type CashbookData = {
  closingBalance: string
}

type TenantData = {
  id: string; name: string; plan: string; status: string
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT:     'fp-badge-draft',
  CONFIRMED: 'fp-badge-confirmed',
  DELIVERED: 'fp-badge-delivered',
  CANCELLED: 'fp-badge-cancelled',
}

const fmt = (n: string | number) =>
  `₹ ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

function KpiCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="fp-card rounded-xl p-4">
      <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>{label}</p>
      <p className={`text-xl font-bold truncate ${color ?? 'text-[#1E293B]'}`}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{sub}</p>}
    </div>
  )
}

const QUICK = [
  { label: 'New Booking',  sub: 'Sales entry',       href: '/sales/new',                           icon: '🚗', accent: '#60A5FA' },
  { label: 'New Service',  sub: 'Job card',           href: '/service/new',                         icon: '🔧', accent: '#FB923C' },
  { label: 'Receipt',      sub: 'Cash / cheque in',  href: '/accounts/vouchers/new?type=RECEIPT',  icon: '💰', accent: '#4ADE80' },
  { label: 'Payment',      sub: 'Cash / cheque out', href: '/accounts/vouchers/new?type=PAYMENT',  icon: '💸', accent: '#FF6B6B' },
]

export default function DashboardPage() {
  const { user }         = useUser()
  const { organization } = useOrganization()
  const { setActive }    = useClerk()
  const today            = new Date().toISOString().slice(0, 10)

  const [summary,  setSummary]  = useState<Summary | null>(null)
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [pl,       setPL]       = useState<PLData | null>(null)
  const [cashbook, setCashbook] = useState<CashbookData | null>(null)
  const [tenant,   setTenant]   = useState<TenantData | null | undefined>(undefined) // undefined = loading
  const [loading,  setLoading]  = useState(true)
  const [fyStart,  setFyStart]  = useState('')

  // Auto-select the user's org if they have exactly one and none is active yet
  useEffect(() => {
    if (organization) return
    const memberships = user?.organizationMemberships
    if (memberships?.length === 1) {
      setActive({ organization: memberships[0].organization.id }).catch(() => {})
    }
  }, [user, organization, setActive])

  // Load FY start from company settings once on mount; fall back to April 1.
  useEffect(() => {
    fetch('/api/company-settings')
      .then(r => r.json())
      .then((s: { fyStartDate?: string }) => {
        setFyStart(s.fyStartDate ?? (() => {
          const yr = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1
          return `${yr}-04-01`
        })())
      })
      .catch(() => {
        const yr = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1
        setFyStart(`${yr}-04-01`)
      })
  }, [])

  useEffect(() => {
    if (!fyStart) return
    Promise.all([
      fetch('/api/tenant').then(r => r.json()).catch(() => null),
      fetch(`/api/reports/daily-sales?date=${today}`).then(r => r.json()).catch(() => null),
      fetch(`/api/reports/pl?startDate=${fyStart}&endDate=${today}`).then(r => r.json()).catch(() => null),
      fetch(`/api/accounts/cashbook?startDate=${today}&endDate=${today}`).then(r => r.json()).catch(() => null),
    ]).then(([tenantData, sales, plData, cb]) => {
      setTenant(tenantData && 'id' in tenantData ? tenantData : null)
      if (sales) {
        setSummary(sales.summary ?? null)
        setBookings(Array.isArray(sales.bookings) ? sales.bookings.slice(0, 5) : [])
      }
      if (plData && 'totalIncome' in plData) setPL(plData)
      if (cb && 'closingBalance' in cb) setCashbook(cb)
      setLoading(false)
    })
  }, [today, fyStart])   // fyStart is now state, populated from company-settings on mount

  const name  = user?.fullName ?? user?.firstName ?? 'there'
  const email = user?.primaryEmailAddress?.emailAddress ?? ''

  if (!loading && tenant === null) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="fp-card text-center max-w-sm p-8 rounded-xl">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl" style={{ background: '#F1F5F9' }}>
            🔒
          </div>
          <h2 className="text-lg font-semibold text-[#1E293B] mb-2">No access yet</h2>
          <p className="text-sm mb-1" style={{ color: '#94A3B8' }}>
            Contact your administrator to get access.
          </p>
          {email && (
            <p className="text-xs font-mono mt-3" style={{ color: '#CBD5E1' }}>{email}</p>
          )}
          <SignOutButton>
            <button className="mt-6 fp-btn-secondary text-xs">
              Sign out
            </button>
          </SignOutButton>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[#1E293B]">Good {greeting()}, {name}</h1>
          <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <SignOutButton>
          <button className="fp-btn-secondary text-xs px-3 py-1.5">
            Sign out
          </button>
        </SignOutButton>
      </div>

      {/* Tenant banner */}
      {tenant && (
        <div className="fp-card mb-6 flex items-center gap-3 px-4 py-3" style={{ borderLeft: '3px solid #CC1133' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg, #CC1133, #FF2244)' }}>
            {tenant.name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1E293B]">{tenant.name}</p>
            <p className="text-xs" style={{ color: '#64748B' }}>
              {tenant.plan} plan · <span style={{ color: tenant.status === 'ACTIVE' ? '#16A34A' : '#D97706' }}>{tenant.status}</span>
            </p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        {QUICK.map(q => (
          <Link
            key={q.href}
            href={q.href}
            className="fp-card fp-card-clickable flex items-center gap-3 px-4 py-3"
          >
            <span
              className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: `${q.accent}18`, border: `1px solid ${q.accent}30` }}
            >
              {q.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1E293B] truncate">{q.label}</p>
              <p className="text-xs truncate" style={{ color: '#94A3B8' }}>{q.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size={32} />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-6">
            <KpiCard
              label="Total Income"
              value={pl ? fmt(pl.totalIncome) : '—'}
              sub="Financial year"
              color="text-[#16A34A]"
            />
            <KpiCard
              label="Total Expenses"
              value={pl ? fmt(pl.totalExpense) : '—'}
              sub="Financial year"
              color="text-[#DC2626]"
            />
            <KpiCard
              label="Net Profit"
              value={pl ? fmt(Math.abs(Number(pl.netProfit))) : '—'}
              sub={pl ? (pl.isProfit ? 'Profit' : 'Loss') : undefined}
              color={pl?.isProfit ? 'text-[#16A34A]' : 'text-[#DC2626]'}
            />
            <KpiCard
              label="Cash in Hand"
              value={cashbook ? fmt(cashbook.closingBalance) : '—'}
              sub="Today's closing"
              color="text-[#2563EB]"
            />
            <KpiCard
              label="Today's Bookings"
              value={summary ? String(summary.total) : '0'}
              sub={summary ? `${fmt(summary.totalValue)} value` : undefined}
              color="text-[#1E293B]"
            />
          </div>

          {/* Today's mini-stats */}
          {summary && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="fp-card rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-[#2563EB]">{summary.confirmed}</p>
                <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Confirmed today</p>
              </div>
              <div className="fp-card rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-[#16A34A]">{summary.delivered}</p>
                <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Delivered today</p>
              </div>
              <div className="fp-card rounded-xl p-4 text-center">
                <p className="text-lg font-bold text-[#1E293B]">{fmt(summary.cashValue)}</p>
                <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Cash sales today</p>
              </div>
            </div>
          )}

          {/* Recent Bookings */}
          <div className="fp-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9', background: '#FFFFFF' }}>
              <h2 className="text-sm font-semibold text-[#1E293B]">Recent Bookings</h2>
              <Link href="/sales" className="text-xs hover:underline" style={{ color: '#CC1133' }}>View all →</Link>
            </div>
            {bookings.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>
                No bookings today.{' '}
                <Link href="/sales/new" className="hover:underline" style={{ color: '#CC1133' }}>Create one →</Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm text-left fp-table">
                <thead>
                  <tr>
                    {['Booking #', 'Customer', 'Vehicle', 'Total', 'Status'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(b => (
                    <tr
                      key={b.id}
                      className="cursor-pointer"
                      onClick={() => window.location.href = `/sales/${b.id}`}
                    >
                      <td className="font-mono text-xs font-semibold" style={{ color: '#1E3A5F' }}>{b.bookingNumber}</td>
                      <td>
                        <div className="font-medium text-[#374151]">{b.customer?.name ?? '—'}</div>
                        <div className="text-xs" style={{ color: '#94A3B8' }}>{b.customer?.phone}</div>
                      </td>
                      <td>
                        {b.vehicle ? (
                          <div style={{ color: '#374151' }}>
                            {b.vehicle.variant?.model?.name}
                            <span className="text-xs ml-1" style={{ color: '#94A3B8' }}>· {b.vehicle.variant?.name}</span>
                          </div>
                        ) : <span style={{ color: '#94A3B8' }}>—</span>}
                      </td>
                      <td className="font-bold" style={{ color: '#1E293B' }}>{fmt(b.grandTotal)}</td>
                      <td>
                        <span className={STATUS_BADGE[b.status] ?? 'fp-badge-draft'}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

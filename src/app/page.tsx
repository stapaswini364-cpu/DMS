export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

const features = [
  {
    title: 'Sales',
    description: 'Bookings, deliveries, and vehicle inventory in one flow.',
  },
  {
    title: 'Service',
    description: 'Job cards, technician assignments, and workshop billing.',
  },
  {
    title: 'Billing & Invoicing',
    description: 'GST-ready invoices with automatic journal posting.',
  },
  {
    title: 'Accounts',
    description: 'Double-entry ledgers, receipts, payments, and vouchers.',
  },
  {
    title: 'Reports',
    description: 'Trial balance, P&L, balance sheet, cash flow, GST, TDS.',
  },
]

export default async function HomePage() {
  const { userId } = await auth()
  if (userId) redirect('/dashboard')

  const year = new Date().getFullYear()

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#F5F7FA' }}>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(1000px 500px at 50% -10%, rgba(204,17,51,0.08), transparent 60%), radial-gradient(800px 400px at 90% 20%, rgba(15,31,53,0.06), transparent 60%)',
          }}
        />
        <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32 text-center">
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-5"
            style={{ color: '#0F1F35', lineHeight: 1.1 }}
          >
            Run your dealership on one platform
          </h1>

          <p
            className="text-base md:text-lg max-w-2xl mx-auto mb-10"
            style={{ color: '#475569', lineHeight: 1.6 }}
          >
            A complete management system for vehicle dealerships — sales, service,
            billing, accounts, and reports in one place.
          </p>

          <Link
            href="/sign-in"
            className="fp-btn-primary inline-flex"
            style={{ padding: '12px 28px', fontSize: '15px' }}
          >
            Sign In to Continue
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="relative border-t" style={{ borderColor: '#E2E8F0', background: '#FFFFFF' }}>
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#CC1133' }}>
              Everything you need
            </p>
            <h2 className="text-2xl md:text-3xl font-bold" style={{ color: '#0F1F35' }}>
              Built for dealership operations, end to end
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div key={f.title} className="fp-card p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="section-badge">{i + 1}</div>
                  <h3 className="text-base font-semibold" style={{ color: '#0F1F35' }}>{f.title}</h3>
                </div>
                <p className="text-sm" style={{ color: '#64748B', lineHeight: 1.55 }}>
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Secondary CTA */}
      <section className="border-t" style={{ borderColor: '#E2E8F0', background: '#F5F7FA' }}>
        <div className="max-w-4xl mx-auto px-6 py-14 text-center">
          <h2 className="text-xl md:text-2xl font-semibold mb-3" style={{ color: '#0F1F35' }}>
            Ready to get started?
          </h2>
          <p className="text-sm mb-6" style={{ color: '#64748B' }}>
            Sign in to access your dealership dashboard.
          </p>
          <Link href="/sign-in" className="fp-btn-primary inline-flex">
            Sign In
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t" style={{ borderColor: '#E2E8F0', background: '#FFFFFF' }}>
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <div />
          <p className="text-xs" style={{ color: '#94A3B8' }}>
            © {year} Dealer Management System. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

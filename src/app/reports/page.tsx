export const dynamic = 'force-dynamic'

import Link from 'next/link'

const REPORTS = [
  {
    title: 'Sales Report',
    desc:  'All sales bookings for a date range with full detail — customer, vehicle, pricing, finance and export to CSV.',
    href:  '/reports/sales',
    icon:  '🚗',
    accent: '#CC1133',
  },
  {
    title: 'Daily Sales',
    desc:  "Today's booking counts, values, cash vs finance.",
    href:  '/reports/daily-sales',
    icon:  '📊',
    accent: '#60A5FA',
  },
  {
    title: 'Daily Service',
    desc:  "Today's job cards, service revenue and technician utilization.",
    href:  '/reports/daily-service',
    icon:  '🔧',
    accent: '#FB923C',
  },
  {
    title: 'Cash Flow',
    desc:  'Day-by-day cash receipts and payments over a period.',
    href:  '/reports/cash-flow',
    icon:  '💸',
    accent: '#4ADE80',
  },
  {
    title: 'P&L Account',
    desc:  'Income vs expenses and net profit or loss for a period.',
    href:  '/reports/pl',
    icon:  '📈',
    accent: '#4ADE80',
  },
  {
    title: 'Balance Sheet',
    desc:  'Assets, liabilities and equity as at a given date.',
    href:  '/reports/balance-sheet',
    icon:  '⚖️',
    accent: '#A78BFA',
  },
  {
    title: 'Outstanding',
    desc:  'Collection overdue and finance pending by age bucket.',
    href:  '/reports/outstanding',
    icon:  '🔔',
    accent: '#FBBF24',
  },
  {
    title: 'Trial Balance',
    desc:  'All account debit and credit totals as at a given date — balanced check included.',
    href:  '/reports/trial-balance',
    icon:  '⚖️',
    accent: '#A78BFA',
  },
  {
    title: 'GST Report',
    desc:  'Invoice-wise CGST, SGST, IGST and TCS breakdown for a date range.',
    href:  '/reports/gst',
    icon:  '🧾',
    accent: '#34D399',
  },
  {
    title: 'TDS Report',
    desc:  'Tax deducted at source on service payments above ₹30,000.',
    href:  '/reports/tds',
    icon:  '📋',
    accent: '#60A5FA',
  },
  {
    title: 'Audit Trail',
    desc:  'Full log of who did what and when — bookings, vouchers, deletions and status changes.',
    href:  '/reports/audit',
    icon:  '🔍',
    accent: '#CC1133',
  },
]

export default function ReportsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E293B]">Reports</h1>
        <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>Financial and operational insights</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map(r => (
          <Link
            key={r.href}
            href={r.href}
            className="fp-card fp-card-clickable group flex flex-col gap-3 p-5"
            style={{ borderRadius: '14px' }}
          >
            <div className="flex items-center gap-3">
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: `${r.accent}18`, border: `1px solid ${r.accent}30` }}
              >
                {r.icon}
              </span>
              <h2 className="text-sm font-semibold text-[#1E293B]">{r.title}</h2>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>{r.desc}</p>
            <div className="text-xs font-medium mt-auto" style={{ color: '#CC1133' }}>
              Open report →
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

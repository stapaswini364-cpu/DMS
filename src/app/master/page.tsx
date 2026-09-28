import Link from 'next/link'

const CARDS = [
  {
    icon: '🏛️',
    title: 'Company Details',
    desc: 'Company identity, statutory IDs, bank details, and financial year settings.',
    href: '/master/company',
  },
  {
    icon: '🏢',
    title: 'Branch Management',
    desc: 'Manage branches, showrooms, workshops and bank details.',
    href: '/master/organisation',
  },
  {
    icon: '🚗',
    title: 'Product Models',
    desc: 'Add and manage vehicle models, brands and fuel types.',
    href: '/master/products/models',
  },
  {
    icon: '⚙️',
    title: 'Product Variants',
    desc: 'Configure trims, ex-showroom prices and specifications.',
    href: '/master/products/variants',
  },
  {
    icon: '🎨',
    title: 'Product Colors',
    desc: 'Define available colors and color codes per variant.',
    href: '/master/products/colors',
  },
  {
    icon: '🔑',
    title: 'Vehicle Inventory',
    desc: 'Track stock by frame number, engine number and location.',
    href: '/master/inventory',
  },
  {
    icon: '👥',
    title: 'Customers',
    desc: 'View and manage customer records, contacts and KYC details.',
    href: '/customers',
  },
  {
    icon: '🏭',
    title: 'Vendor Master',
    desc: 'Manage suppliers and creditors — type, category, bank details and opening balance.',
    href: '/master/vendors',
  },
  {
    icon: '🏦',
    title: 'Financers',
    desc: 'Manage partner finance companies, contact persons and loan details.',
    href: '/master/financers',
  },
  {
    icon: '👥',
    title: 'Staff Management',
    desc: 'Invite staff, assign roles and manage team access for your dealership.',
    href: '/master/staff',
  },
  {
    icon: '🔧',
    title: 'Service Types',
    desc: 'Define service categories and base prices for the service booking form.',
    href: '/master/service-types',
  },
  {
    icon: '👨‍🔧',
    title: 'Technicians',
    desc: 'Manage technician profiles, specializations and branch assignments.',
    href: '/master/technicians',
  },
  {
    icon: '📊',
    title: 'Chart of Accounts',
    desc: 'View the full account hierarchy — types, major heads, groups, sub-groups and ledgers.',
    href: '/master/chart-of-accounts',
  },
]

export default function MasterPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E293B]">Master Data</h1>
        <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>Configure products, inventory and organisation settings</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="fp-card fp-card-clickable group p-5 flex flex-col gap-4 transition"
          >
            <div className="flex items-start justify-between">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl" style={{ background: '#F1F5F9' }}>
                {card.icon}
              </div>
              <span className="text-lg transition-colors" style={{ color: '#CBD5E1' }}>→</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#1E293B] mb-1">{card.title}</h2>
              <p className="text-xs leading-relaxed" style={{ color: '#94A3B8' }}>{card.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

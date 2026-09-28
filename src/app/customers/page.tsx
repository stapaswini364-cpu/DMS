'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Customer = {
  id:              string
  customerCode:    string
  customerType:    string | null
  customerCategory: string | null
  name:            string
  phone:           string
  email:           string | null
  city:            string | null
  state:           string | null
  createdAt:       string
}

const TYPE_LABEL: Record<string, string> = {
  INDIVIDUAL: 'Individual', PROPRIETORSHIP: 'Proprietorship', PARTNERSHIP: 'Partnership',
  LLP: 'LLP', COMPANY: 'Company', TRUST: 'Trust', GOVT: 'Govt / PSU', OTHER: 'Other',
}

const CAT_LABEL: Record<string, string> = {
  CUSTOMER: 'Customer', DEALER: 'Dealer', INSURANCE: 'Insurance',
  FINANCER: 'Financer', OTHER: 'Other',
}

export default function CustomersPage() {
  const router = useRouter()
  const [customerList, setCustomerList] = useState<Customer[]>([])
  const [loading,  setLoading]  = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search,   setSearch]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch('/api/customers').then(r => r.json()).catch(() => [])
    setCustomerList(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete customer "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    setDeleting(null)
    load()
  }

  const filtered = customerList.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.customerCode.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B]">Customers</h1>
          <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>
            {customerList.length} customer{customerList.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/customers/new" className="fp-btn-primary">
          + Add Customer
        </Link>
      </div>

      <div className="mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, customer ID, phone or email…"
          className="fp-input max-w-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: '#94A3B8' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl" style={{ color: '#94A3B8', borderColor: '#E2E8F0' }}>
          {search ? 'No customers match your search.' : 'No customers yet. Add one above.'}
        </div>
      ) : (
        <div className="fp-card overflow-hidden">
          <table className="w-full text-sm text-left fp-table">
            <thead>
              <tr>
                {['Customer ID', 'Name', 'Type', 'Category', 'Phone', 'City / State', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td className="font-mono text-xs" style={{ color: '#64748B' }}>{c.customerCode}</td>
                  <td className="font-medium text-[#1E293B]">{c.name}</td>
                  <td style={{ color: '#64748B' }}>{c.customerType ? (TYPE_LABEL[c.customerType] ?? c.customerType) : '—'}</td>
                  <td style={{ color: '#64748B' }}>{c.customerCategory ? (CAT_LABEL[c.customerCategory] ?? c.customerCategory) : '—'}</td>
                  <td style={{ color: '#374151' }}>{c.phone}</td>
                  <td style={{ color: '#64748B' }}>{[c.city, c.state].filter(Boolean).join(', ') || '—'}</td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/customers/${c.id}/edit`)}
                        className="fp-btn-secondary text-xs"
                        style={{ padding: '5px 12px' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        disabled={deleting === c.id}
                        className="fp-btn-danger text-xs disabled:opacity-50"
                        style={{ padding: '5px 12px' }}
                      >
                        {deleting === c.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

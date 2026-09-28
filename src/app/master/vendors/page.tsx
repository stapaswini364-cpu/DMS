'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Vendor = {
  id:             string
  vendorCode:     string
  vendorType:     string
  vendorCategory: string
  name:           string
  tradeName:      string | null
  phone:          string
  email:          string | null
  city:           string
  state:          string
  createdAt:      string
}

const TYPE_LABEL: Record<string, string> = {
  INDIVIDUAL: 'Individual', PROPRIETORSHIP: 'Proprietorship', PARTNERSHIP: 'Partnership',
  LLP: 'LLP', COMPANY: 'Company', TRUST: 'Trust', GOVT: 'Govt / PSU', OTHER: 'Other',
}

const CAT_LABEL: Record<string, string> = {
  VEHICLE: 'Vehicle', PARTS: 'Parts', SERVICES: 'Services', CAPITAL_GOODS: 'Capital Goods',
  TRANSPORT: 'Transport', PROFESSIONAL: 'Professional', UTILITY: 'Utility', OTHER: 'Other',
}

export default function VendorListPage() {
  const router = useRouter()
  const [vendorList, setVendorList] = useState<Vendor[]>([])
  const [loading,   setLoading]     = useState(true)
  const [deleting,  setDeleting]    = useState<string | null>(null)
  const [search,    setSearch]      = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch('/api/vendors').then(r => r.json()).catch(() => [])
    setVendorList(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete vendor "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    await fetch(`/api/vendors/${id}`, { method: 'DELETE' })
    setDeleting(null)
    load()
  }

  const filtered = vendorList.filter(v =>
    !search ||
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.vendorCode.toLowerCase().includes(search.toLowerCase()) ||
    v.phone.includes(search) ||
    (v.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (v.tradeName ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B]">Vendor Master</h1>
          <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>
            {vendorList.length} vendor{vendorList.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/master/vendors/new" className="fp-btn-primary">
          + Add Vendor
        </Link>
      </div>

      <div className="mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, vendor ID, phone or email…"
          className="fp-input max-w-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: '#94A3B8' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl" style={{ color: '#94A3B8', borderColor: '#E2E8F0' }}>
          {search ? 'No vendors match your search.' : 'No vendors yet. Add one above.'}
        </div>
      ) : (
        <div className="fp-card overflow-hidden">
          <table className="w-full text-sm text-left fp-table">
            <thead>
              <tr>
                {['Vendor ID', 'Name', 'Type', 'Category', 'Phone', 'City / State', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id}>
                  <td className="font-mono text-xs" style={{ color: '#64748B' }}>{v.vendorCode}</td>
                  <td>
                    <div className="font-medium text-[#1E293B]">{v.name}</div>
                    {v.tradeName && <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{v.tradeName}</div>}
                  </td>
                  <td style={{ color: '#64748B' }}>{TYPE_LABEL[v.vendorType] ?? v.vendorType}</td>
                  <td style={{ color: '#64748B' }}>{CAT_LABEL[v.vendorCategory] ?? v.vendorCategory}</td>
                  <td style={{ color: '#374151' }}>{v.phone}</td>
                  <td style={{ color: '#64748B' }}>{[v.city, v.state].filter(Boolean).join(', ')}</td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/master/vendors/${v.id}/edit`)}
                        className="fp-btn-secondary text-xs"
                        style={{ padding: '5px 12px' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(v.id, v.name)}
                        disabled={deleting === v.id}
                        className="fp-btn-danger text-xs disabled:opacity-50"
                        style={{ padding: '5px 12px' }}
                      >
                        {deleting === v.id ? '…' : 'Delete'}
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

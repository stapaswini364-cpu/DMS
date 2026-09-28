'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Model = {
  id: string
  name: string
  brand: string
  fuelType: string
  isActive: boolean
}

const FUEL_TYPES = ['PETROL', 'DIESEL', 'ELECTRIC', 'CNG', 'HYBRID'] as const
const FUEL_BADGE: Record<string, string> = {
  PETROL:   'bg-[#FEF3C7] text-[#92400E]',
  DIESEL:   'bg-[#F1F5F9] text-[#475569]',
  ELECTRIC: 'fp-badge-active',
  CNG:      'fp-badge-confirmed',
  HYBRID:   'bg-[#F0FDFA] text-[#0F766E]',
}

export default function ProductModelsPage() {
  const [models,   setModels]   = useState<Model[]>([])
  const [loading,  setLoading]  = useState(true)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  const [name,     setName]     = useState('')
  const [brand,    setBrand]    = useState('')
  const [fuelType, setFuelType] = useState('PETROL')

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch('/api/products/models').then(r => r.json()).catch(() => [])
    setModels(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function startEdit(m: Model) {
    setEditId(m.id); setName(m.name); setBrand(m.brand); setFuelType(m.fuelType)
    setError(''); setSuccess('')
  }

  function cancelEdit() {
    setEditId(null); setName(''); setBrand(''); setFuelType('PETROL'); setError('')
  }

  async function handleSave() {
    setError(''); setSuccess('')
    if (!name.trim())  { setError('Name is required');  return }
    if (!brand.trim()) { setError('Brand is required'); return }
    setSaving(true)

    const url    = editId ? `/api/products/models/${editId}` : '/api/products/models'
    const method = editId ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), brand: brand.trim(), fuelType }),
    })
    setSaving(false)
    if (!res.ok) { const b = await res.json().catch(() => ({})); setError(b?.error ?? 'Failed to save'); return }
    setSuccess(editId ? 'Model updated.' : 'Model added.')
    cancelEdit(); load()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete model "${name}"? This will also remove its variants and colors.`)) return
    setDeleting(id)
    const res = await fetch(`/api/products/models/${id}`, { method: 'DELETE' })
    setDeleting(null)
    if (!res.ok) { const b = await res.json().catch(() => ({})); setError(b?.error ?? 'Failed to delete'); return }
    load()
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/master" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Master Data</Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">Product Models</h1>
      </div>

      {success && <div className="mb-4 px-4 py-3 bg-[#DCFCE7] border border-[#BBF7D0] text-[#15803D] text-sm rounded-xl">✓ {success}</div>}
      {error   && <div className="mb-4 px-4 py-3 bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-sm rounded-xl">{error}</div>}

      <div className="fp-card overflow-hidden mb-6">
        <div className="px-5 py-3" style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
          <h2 className="text-sm font-semibold text-[#1E293B]">{editId ? 'Edit Model' : 'Add Model'}</h2>
        </div>
        <div className="p-5 grid grid-cols-3 gap-4">
          <div>
            <label className="fp-label">Brand <span className="text-[#DC2626]">*</span></label>
            <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Hero" className="fp-input" />
          </div>
          <div>
            <label className="fp-label">Model Name <span className="text-[#DC2626]">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Splendor Plus" className="fp-input" />
          </div>
          <div>
            <label className="fp-label">Fuel Type</label>
            <select value={fuelType} onChange={e => setFuelType(e.target.value)} className="fp-input fp-select">
              {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={handleSave} disabled={saving} className="fp-btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : editId ? 'Update Model' : 'Add Model'}
          </button>
          {editId && <button onClick={cancelEdit} className="fp-btn-secondary">Cancel</button>}
        </div>
      </div>

      <div className="fp-card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h2 className="text-sm font-semibold text-[#1E293B]">Models {!loading && `(${models.length})`}</h2>
        </div>
        {loading ? (
          <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
        ) : models.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>No models yet. Add one above.</div>
        ) : (
          <table className="w-full text-sm text-left fp-table">
            <thead>
              <tr>{['Brand', 'Model', 'Fuel Type', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {models.map(m => (
                <tr key={m.id}>
                  <td className="font-medium text-[#374151]">{m.brand}</td>
                  <td style={{ color: '#374151' }}>{m.name}</td>
                  <td>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${FUEL_BADGE[m.fuelType] ?? 'bg-[#F1F5F9] text-[#475569]'}`}>{m.fuelType}</span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(m)} className="fp-btn-secondary text-xs" style={{ padding: '5px 12px' }}>Edit</button>
                      <button onClick={() => handleDelete(m.id, m.name)} disabled={deleting === m.id} className="fp-btn-danger text-xs disabled:opacity-50" style={{ padding: '5px 12px' }}>
                        {deleting === m.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

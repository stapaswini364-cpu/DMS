'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { AddModelModal } from '../QuickAddModals'

type Model   = { id: string; name: string; brand: string }
type Variant = { id: string; modelId: string; name: string; exShowroomPrice: string; isActive: boolean }

const fmt = (n: string | number) =>
  `₹ ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export default function ProductVariantsPage() {
  const [models,    setModels]    = useState<Model[]>([])
  const [variants,  setVariants]  = useState<Variant[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filterModel, setFilterModel] = useState('')
  const [editId,    setEditId]    = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState<string | null>(null)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')

  const [modelId,        setModelId]        = useState('')
  const [name,           setName]           = useState('')
  const [exShowroomPrice, setExShowroomPrice] = useState('')
  const [showAddModel,   setShowAddModel]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const qs   = filterModel ? `?modelId=${filterModel}` : ''
    const [m, v] = await Promise.all([
      fetch('/api/products/models').then(r => r.json()).catch(() => []),
      fetch(`/api/products/variants${qs}`).then(r => r.json()).catch(() => []),
    ])
    setModels(Array.isArray(m) ? m : [])
    setVariants(Array.isArray(v) ? v : [])
    setLoading(false)
  }, [filterModel])

  useEffect(() => { load() }, [load])

  function modelLabel(id: string) {
    const m = models.find(x => x.id === id)
    return m ? m.name : '—'
  }

  function startEdit(v: Variant) {
    setEditId(v.id); setModelId(v.modelId); setName(v.name); setExShowroomPrice(v.exShowroomPrice)
    setError(''); setSuccess('')
  }

  function cancelEdit() {
    setEditId(null); setModelId(''); setName(''); setExShowroomPrice(''); setError('')
  }

  async function handleSave() {
    setError(''); setSuccess('')
    if (!modelId)              { setError('Select a model'); return }
    if (!name.trim())          { setError('Name is required'); return }
    if (!exShowroomPrice || Number(exShowroomPrice) <= 0) { setError('Valid price is required'); return }

    setSaving(true)
    const url    = editId ? `/api/products/variants/${editId}` : '/api/products/variants'
    const method = editId ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId, name: name.trim(), exShowroomPrice: Number(exShowroomPrice) }),
    })
    setSaving(false)
    if (!res.ok) { const b = await res.json().catch(() => ({})); setError(b?.error ?? 'Failed to save'); return }
    setSuccess(editId ? 'Variant updated.' : 'Variant added.')
    cancelEdit(); load()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete variant "${name}"? Its colors will also be removed.`)) return
    setDeleting(id)
    const res = await fetch(`/api/products/variants/${id}`, { method: 'DELETE' })
    setDeleting(null)
    if (!res.ok) { const b = await res.json().catch(() => ({})); setError(b?.error ?? 'Failed to delete'); return }
    load()
  }

  return (
    <div className="p-6 max-w-4xl">
      {showAddModel && (
        <AddModelModal
          onClose={() => setShowAddModel(false)}
          onCreated={m => {
            setModels(prev => [...prev, m])
            setModelId(m.id)
            setShowAddModel(false)
          }}
        />
      )}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/master" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Master Data</Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">Product Variants</h1>
      </div>

      {success && <div className="mb-4 px-4 py-3 bg-[#DCFCE7] border border-[#BBF7D0] text-[#15803D] text-sm rounded-xl">✓ {success}</div>}
      {error   && <div className="mb-4 px-4 py-3 bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-sm rounded-xl">{error}</div>}

      <div className="fp-card overflow-hidden mb-6">
        <div className="px-5 py-3" style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
          <h2 className="text-sm font-semibold text-[#1E293B]">{editId ? 'Edit Variant' : 'Add Variant'}</h2>
        </div>
        <div className="p-5 grid grid-cols-3 gap-4">
          <div>
            <label className="fp-label">Model <span className="text-[#DC2626]">*</span></label>
            <div className="flex gap-2">
              <select value={modelId} onChange={e => setModelId(e.target.value)} className="fp-input fp-select">
                <option value="">Select model…</option>
                {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setShowAddModel(true)}
                className="fp-btn-secondary text-xs flex-shrink-0"
                style={{ padding: '0 10px' }}
              >
                + Add Model
              </button>
            </div>
          </div>
          <div>
            <label className="fp-label">Variant Name <span className="text-[#DC2626]">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. VX, ZX, Base" className="fp-input" />
          </div>
          <div>
            <label className="fp-label">Ex-Showroom Price (₹) <span className="text-[#DC2626]">*</span></label>
            <input type="number" min="0" step="1" value={exShowroomPrice} onChange={e => setExShowroomPrice(e.target.value)} placeholder="0" className="fp-input" />
          </div>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={handleSave} disabled={saving} className="fp-btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : editId ? 'Update Variant' : 'Add Variant'}
          </button>
          {editId && <button onClick={cancelEdit} className="fp-btn-secondary">Cancel</button>}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <label className="fp-label mb-0">Filter by model</label>
        <select value={filterModel} onChange={e => setFilterModel(e.target.value)} className="fp-input fp-select max-w-xs">
          <option value="">All models</option>
          {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div className="fp-card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h2 className="text-sm font-semibold text-[#1E293B]">Variants {!loading && `(${variants.length})`}</h2>
        </div>
        {loading ? (
          <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
        ) : variants.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>No variants found.</div>
        ) : (
          <table className="w-full text-sm text-left fp-table">
            <thead>
              <tr>{['Model', 'Variant', 'Ex-Showroom Price', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {variants.map(v => (
                <tr key={v.id}>
                  <td style={{ color: '#374151' }}>{modelLabel(v.modelId)}</td>
                  <td className="font-medium text-[#374151]">{v.name}</td>
                  <td className="font-medium text-[#374151]">{fmt(v.exShowroomPrice)}</td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(v)} className="fp-btn-secondary text-xs" style={{ padding: '5px 12px' }}>Edit</button>
                      <button onClick={() => handleDelete(v.id, v.name)} disabled={deleting === v.id} className="fp-btn-danger text-xs disabled:opacity-50" style={{ padding: '5px 12px' }}>
                        {deleting === v.id ? '…' : 'Delete'}
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

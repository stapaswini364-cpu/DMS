'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { AddModelModal, AddVariantModal } from '../QuickAddModals'

type Model   = { id: string; name: string; brand: string }
type Variant = { id: string; modelId: string; name: string }
type Color   = { id: string; variantId: string; colorName: string; colorCode: string | null; isActive: boolean }

export default function ProductColorsPage() {
  const [models,    setModels]    = useState<Model[]>([])
  const [variants,  setVariants]  = useState<Variant[]>([])
  const [colors,    setColors]    = useState<Color[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filterVariant, setFilterVariant] = useState('')
  const [filterModel,   setFilterModel]   = useState('')
  const [editId,    setEditId]    = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState<string | null>(null)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')

  const [variantId,  setVariantId]  = useState('')
  const [colorName,  setColorName]  = useState('')
  const [colorCode,  setColorCode]  = useState('')
  const [showAddModel,   setShowAddModel]   = useState(false)
  const [showAddVariant, setShowAddVariant] = useState(false)

  const filteredVariants = filterModel
    ? variants.filter(v => v.modelId === filterModel)
    : variants

  const load = useCallback(async () => {
    setLoading(true)
    const qs = filterVariant ? `?variantId=${filterVariant}` : ''
    const [m, v, c] = await Promise.all([
      fetch('/api/products/models').then(r => r.json()).catch(() => []),
      fetch('/api/products/variants').then(r => r.json()).catch(() => []),
      fetch(`/api/products/colors${qs}`).then(r => r.json()).catch(() => []),
    ])
    setModels(Array.isArray(m) ? m : [])
    setVariants(Array.isArray(v) ? v : [])
    setColors(Array.isArray(c) ? c : [])
    setLoading(false)
  }, [filterVariant])

  useEffect(() => { load() }, [load])

  function variantLabel(id: string) {
    const v = variants.find(x => x.id === id)
    if (!v) return '—'
    const m = models.find(x => x.id === v.modelId)
    return m ? `${m.name} — ${v.name}` : v.name
  }

  function startEdit(c: Color) {
    setEditId(c.id); setVariantId(c.variantId); setColorName(c.colorName); setColorCode(c.colorCode ?? '')
    setError(''); setSuccess('')
  }

  function cancelEdit() {
    setEditId(null); setVariantId(''); setColorName(''); setColorCode(''); setError('')
  }

  async function handleSave() {
    setError(''); setSuccess('')
    if (!variantId)        { setError('Select a variant'); return }
    if (!colorName.trim()) { setError('Color name is required'); return }

    setSaving(true)
    const url    = editId ? `/api/products/colors/${editId}` : '/api/products/colors'
    const method = editId ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variantId, colorName: colorName.trim(), colorCode: colorCode.trim() || null }),
    })
    setSaving(false)
    if (!res.ok) { const b = await res.json().catch(() => ({})); setError(b?.error ?? 'Failed to save'); return }
    setSuccess(editId ? 'Color updated.' : 'Color added.')
    cancelEdit(); load()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete color "${name}"?`)) return
    setDeleting(id)
    const res = await fetch(`/api/products/colors/${id}`, { method: 'DELETE' })
    setDeleting(null)
    if (!res.ok) { const b = await res.json().catch(() => ({})); setError(b?.error ?? 'Failed to delete'); return }
    load()
  }

  const selectedModel = models.find(m => m.id === filterModel)

  return (
    <div className="p-6 max-w-4xl">
      {showAddModel && (
        <AddModelModal
          onClose={() => setShowAddModel(false)}
          onCreated={m => {
            setModels(prev => [...prev, m])
            setFilterModel(m.id)
            setVariantId('')
            setShowAddModel(false)
          }}
        />
      )}
      {showAddVariant && selectedModel && (
        <AddVariantModal
          modelId={selectedModel.id}
          modelLabel={selectedModel.name}
          onClose={() => setShowAddVariant(false)}
          onCreated={v => {
            setVariants(prev => [...prev, v])
            setVariantId(v.id)
            setShowAddVariant(false)
          }}
        />
      )}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/master" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Master Data</Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">Product Colors</h1>
      </div>

      {success && <div className="mb-4 px-4 py-3 bg-[#DCFCE7] border border-[#BBF7D0] text-[#15803D] text-sm rounded-xl">✓ {success}</div>}
      {error   && <div className="mb-4 px-4 py-3 bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-sm rounded-xl">{error}</div>}

      <div className="fp-card overflow-hidden mb-6">
        <div className="px-5 py-3" style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
          <h2 className="text-sm font-semibold text-[#1E293B]">{editId ? 'Edit Color' : 'Add Color'}</h2>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="fp-label">Filter by Model</label>
            <div className="flex gap-2">
              <select value={filterModel} onChange={e => { setFilterModel(e.target.value); setVariantId('') }} className="fp-input fp-select">
                <option value="">All models</option>
                {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setShowAddModel(true)}
                className="fp-btn-secondary text-xs flex-shrink-0"
                style={{ padding: '0 10px' }}
              >
                + Add
              </button>
            </div>
          </div>
          <div>
            <label className="fp-label">Variant <span className="text-[#DC2626]">*</span></label>
            <div className="flex gap-2">
              <select value={variantId} onChange={e => setVariantId(e.target.value)} className="fp-input fp-select">
                <option value="">Select variant…</option>
                {filteredVariants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setShowAddVariant(true)}
                disabled={!filterModel}
                title={filterModel ? '' : 'Select a Model first'}
                className="fp-btn-secondary text-xs flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ padding: '0 10px' }}
              >
                + Add
              </button>
            </div>
          </div>
          <div>
            <label className="fp-label">Color Name <span className="text-[#DC2626]">*</span></label>
            <input value={colorName} onChange={e => setColorName(e.target.value)} placeholder="e.g. Pearl White" className="fp-input" />
          </div>
          <div>
            <label className="fp-label">Color Code</label>
            <div className="flex gap-2">
              <input value={colorCode} onChange={e => setColorCode(e.target.value)} placeholder="#FFFFFF" className="fp-input" />
              {colorCode && /^#[0-9A-Fa-f]{6}$/.test(colorCode) && (
                <div className="w-9 h-9 rounded-lg border border-[#E2E8F0] flex-shrink-0" style={{ backgroundColor: colorCode }} />
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={handleSave} disabled={saving} className="fp-btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : editId ? 'Update Color' : 'Add Color'}
          </button>
          {editId && <button onClick={cancelEdit} className="fp-btn-secondary">Cancel</button>}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <label className="fp-label mb-0">Filter table by variant</label>
        <select value={filterVariant} onChange={e => setFilterVariant(e.target.value)} className="fp-input fp-select max-w-xs">
          <option value="">All variants</option>
          {variants.map(v => <option key={v.id} value={v.id}>{variantLabel(v.id)}</option>)}
        </select>
      </div>

      <div className="fp-card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h2 className="text-sm font-semibold text-[#1E293B]">Colors {!loading && `(${colors.length})`}</h2>
        </div>
        {loading ? (
          <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
        ) : colors.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>No colors found.</div>
        ) : (
          <table className="w-full text-sm text-left fp-table">
            <thead>
              <tr>{['Swatch', 'Color Name', 'Code', 'Variant', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {colors.map(c => (
                <tr key={c.id}>
                  <td>
                    {c.colorCode && /^#[0-9A-Fa-f]{6}$/.test(c.colorCode) ? (
                      <div className="w-7 h-7 rounded-md border border-[#E2E8F0]" style={{ backgroundColor: c.colorCode }} />
                    ) : (
                      <div className="w-7 h-7 rounded-md bg-[#F1F5F9] border border-[#E2E8F0]" />
                    )}
                  </td>
                  <td className="font-medium text-[#374151]">{c.colorName}</td>
                  <td className="font-mono text-xs" style={{ color: '#94A3B8' }}>{c.colorCode ?? '—'}</td>
                  <td style={{ color: '#374151' }}>{variantLabel(c.variantId)}</td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(c)} className="fp-btn-secondary text-xs" style={{ padding: '5px 12px' }}>Edit</button>
                      <button onClick={() => handleDelete(c.id, c.colorName)} disabled={deleting === c.id} className="fp-btn-danger text-xs disabled:opacity-50" style={{ padding: '5px 12px' }}>
                        {deleting === c.id ? '…' : 'Delete'}
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

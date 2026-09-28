'use client'

import { useState } from 'react'

type Model = { id: string; name: string; brand: string; fuelType: string }
type Variant = { id: string; modelId: string; name: string; exShowroomPrice: string }

const FUEL_TYPES = ['PETROL', 'DIESEL', 'ELECTRIC', 'CNG', 'HYBRID'] as const

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
      <div className="fp-card w-full max-w-md rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: '#E2E8F0' }}>
          <h2 className="text-base font-semibold text-[#1E293B]">{title}</h2>
          <button onClick={onClose} className="text-sm font-medium" style={{ color: '#64748B' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function AddModelModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (model: Model) => void
}) {
  const [brand, setBrand] = useState('')
  const [name, setName] = useState('')
  const [fuelType, setFuelType] = useState<(typeof FUEL_TYPES)[number]>('PETROL')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setError('')
    if (!brand.trim()) { setError('Brand is required'); return }
    if (!name.trim())  { setError('Name is required'); return }
    setSaving(true)
    const res = await fetch('/api/products/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: brand.trim(), name: name.trim(), fuelType }),
    })
    setSaving(false)
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setError(b?.error ?? 'Failed to add model')
      return
    }
    const created = await res.json() as Model
    onCreated(created)
  }

  return (
    <ModalShell title="Add Model" onClose={onClose}>
      <div className="p-5 space-y-4">
        {error && (
          <div className="px-3 py-2 text-xs rounded-lg bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C]">{error}</div>
        )}
        <div>
          <label className="fp-label">Brand <span className="text-[#DC2626]">*</span></label>
          <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Hero" className="fp-input" autoFocus />
        </div>
        <div>
          <label className="fp-label">Model Name <span className="text-[#DC2626]">*</span></label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Splendor Plus" className="fp-input" />
        </div>
        <div>
          <label className="fp-label">Fuel Type</label>
          <select value={fuelType} onChange={e => setFuelType(e.target.value as (typeof FUEL_TYPES)[number])} className="fp-input fp-select">
            {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>
      <div className="px-5 py-3 border-t flex justify-end gap-2" style={{ borderColor: '#E2E8F0' }}>
        <button onClick={onClose} disabled={saving} className="fp-btn-secondary text-sm disabled:opacity-50">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="fp-btn-primary text-sm disabled:opacity-50">
          {saving ? 'Saving…' : 'Add Model'}
        </button>
      </div>
    </ModalShell>
  )
}

export function AddVariantModal({
  modelId,
  modelLabel,
  onClose,
  onCreated,
}: {
  modelId: string
  modelLabel: string
  onClose: () => void
  onCreated: (variant: Variant) => void
}) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setError('')
    if (!name.trim())                    { setError('Name is required'); return }
    if (!price || Number(price) <= 0)    { setError('Valid price is required'); return }
    setSaving(true)
    const res = await fetch('/api/products/variants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId, name: name.trim(), exShowroomPrice: Number(price) }),
    })
    setSaving(false)
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setError(b?.error ?? 'Failed to add variant')
      return
    }
    const created = await res.json() as Variant
    onCreated(created)
  }

  return (
    <ModalShell title="Add Variant" onClose={onClose}>
      <div className="p-5 space-y-4">
        {error && (
          <div className="px-3 py-2 text-xs rounded-lg bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C]">{error}</div>
        )}
        <div>
          <label className="fp-label">Model</label>
          <div className="fp-input" style={{ background: '#F8FAFC', color: '#475569' }}>{modelLabel}</div>
        </div>
        <div>
          <label className="fp-label">Variant Name <span className="text-[#DC2626]">*</span></label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. VX, ZX, Base" className="fp-input" autoFocus />
        </div>
        <div>
          <label className="fp-label">Ex-Showroom Price (₹) <span className="text-[#DC2626]">*</span></label>
          <input type="number" min="0" step="1" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" className="fp-input" />
        </div>
      </div>
      <div className="px-5 py-3 border-t flex justify-end gap-2" style={{ borderColor: '#E2E8F0' }}>
        <button onClick={onClose} disabled={saving} className="fp-btn-secondary text-sm disabled:opacity-50">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="fp-btn-primary text-sm disabled:opacity-50">
          {saving ? 'Saving…' : 'Add Variant'}
        </button>
      </div>
    </ModalShell>
  )
}

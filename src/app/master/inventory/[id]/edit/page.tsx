'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'

type Model   = { id: string; name: string; brand: string }
type Variant = { id: string; name: string; modelId: string }
type Color   = { id: string; colorName: string }
type Location = { id: string; name: string }

export default function EditVehiclePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  // Read-only fields
  const [frameNumber, setFrameNumber] = useState('')
  const [currentStatus, setCurrentStatus] = useState('')

  // Editable fields
  const [modelId,              setModelId]              = useState('')
  const [variantId,            setVariantId]            = useState('')
  const [colorId,              setColorId]              = useState('')
  const [locationId,           setLocationId]           = useState('')
  const [engineNumber,         setEngineNumber]         = useState('')
  const [purchaseDate,         setPurchaseDate]         = useState('')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')

  // Dropdown data
  const [models,    setModels]    = useState<Model[]>([])
  const [variants,  setVariants]  = useState<Variant[]>([])
  const [colors,    setColors]    = useState<Color[]>([])
  const [locations, setLocations] = useState<Location[]>([])

  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  // Load vehicle + master data in parallel
  useEffect(() => {
    Promise.all([
      fetch(`/api/inventory/${id}`).then(r => r.json()),
      fetch('/api/products/models').then(r => r.json()).catch(() => []),
      fetch('/api/locations').then(r => r.json()).catch(() => []),
    ]).then(async ([vehicle, m, l]) => {
      if (vehicle.error) { setError(vehicle.error); setLoading(false); return }

      setFrameNumber(vehicle.frameNumber ?? '')
      setCurrentStatus(vehicle.status ?? '')
      setEngineNumber(vehicle.engineNumber ?? '')
      setPurchaseDate(vehicle.purchaseDate ?? '')
      setExpectedDeliveryDate(vehicle.expectedDeliveryDate ?? '')
      setLocationId(vehicle.locationId ?? '')
      setModelId(vehicle.variant?.model?.id ?? '')

      setModels(Array.isArray(m) ? m : [])
      setLocations(Array.isArray(l) ? l : [])

      // Load variants for this model, then colors for this variant
      if (vehicle.variant?.model?.id) {
        const vars = await fetch(`/api/products/variants?modelId=${vehicle.variant.model.id}`)
          .then(r => r.json()).catch(() => [])
        setVariants(Array.isArray(vars) ? vars : [])
        setVariantId(vehicle.variantId ?? '')

        if (vehicle.variantId) {
          const cols = await fetch(`/api/products/colors?variantId=${vehicle.variantId}`)
            .then(r => r.json()).catch(() => [])
          setColors(Array.isArray(cols) ? cols : [])
          setColorId(vehicle.colorId ?? '')
        }
      }
      setLoading(false)
    }).catch(() => { setError('Failed to load vehicle'); setLoading(false) })
  }, [id])

  async function onModelChange(mid: string) {
    setModelId(mid); setVariantId(''); setColorId(''); setVariants([]); setColors([])
    if (!mid) return
    const data = await fetch(`/api/products/variants?modelId=${mid}`).then(r => r.json()).catch(() => [])
    setVariants(Array.isArray(data) ? data : [])
  }

  async function onVariantChange(vid: string) {
    setVariantId(vid); setColorId(''); setColors([])
    if (!vid) return
    const data = await fetch(`/api/products/colors?variantId=${vid}`).then(r => r.json()).catch(() => [])
    setColors(Array.isArray(data) ? data : [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!variantId)          { setError('Variant is required'); return }
    if (!colorId)            { setError('Color is required'); return }
    if (!locationId)         { setError('Location is required'); return }
    if (!engineNumber.trim()) { setError('Engine number is required'); return }

    setSaving(true)
    try {
      const res = await fetch(`/api/inventory/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId,
          colorId,
          locationId,
          engineNumber: engineNumber.trim().toUpperCase(),
          purchaseDate:         purchaseDate         || null,
          expectedDeliveryDate: expectedDeliveryDate || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to save'); return }
      router.push('/master/inventory')
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: '#3B82F6', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (error && !frameNumber) {
    return (
      <div className="p-6">
        <div className="text-sm mb-4" style={{ color: '#EF4444' }}>{error}</div>
        <Link href="/master/inventory" className="fp-btn-secondary">← Back to Inventory</Link>
      </div>
    )
  }

  const STATUS_BADGE: Record<string, string> = {
    AVAILABLE: 'fp-badge-active', BOOKED: 'bg-[#FEF3C7] text-[#92400E]',
    SOLD: 'fp-badge-draft', IN_TRANSIT: 'fp-badge-trial',
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/master/inventory" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Vehicle Inventory</Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">Edit Vehicle</h1>
      </div>

      {/* Read-only identity row */}
      <div className="fp-card p-4 mb-5 flex items-center gap-6 rounded-xl">
        <div>
          <p className="text-xs mb-0.5" style={{ color: '#94A3B8' }}>Frame Number</p>
          <p className="font-mono font-semibold text-sm text-[#1E293B]">{frameNumber}</p>
        </div>
        <div>
          <p className="text-xs mb-0.5" style={{ color: '#94A3B8' }}>Status</p>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[currentStatus] ?? 'fp-badge-draft'}`}>
            {currentStatus.replace('_', ' ')}
          </span>
        </div>
        <p className="text-xs ml-auto" style={{ color: '#94A3B8' }}>Frame number cannot be changed after entry.</p>
      </div>

      <form onSubmit={handleSubmit} className="fp-card p-5 rounded-xl space-y-4">
        {error && (
          <div className="px-3 py-2 text-xs rounded-lg" style={{ background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FECACA' }}>{error}</div>
        )}

        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <div>
            <label className="fp-label">Model *</label>
            <select value={modelId} onChange={e => onModelChange(e.target.value)} className="fp-input fp-select">
              <option value="">Select model…</option>
              {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="fp-label">Variant *</label>
            <select value={variantId} onChange={e => onVariantChange(e.target.value)} disabled={!modelId} className="fp-input fp-select">
              <option value="">Select variant…</option>
              {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="fp-label">Color *</label>
            <select value={colorId} onChange={e => setColorId(e.target.value)} disabled={!variantId} className="fp-input fp-select">
              <option value="">Select color…</option>
              {colors.map(c => <option key={c.id} value={c.id}>{c.colorName}</option>)}
            </select>
          </div>
          <div>
            <label className="fp-label">Engine Number *</label>
            <input
              value={engineNumber}
              onChange={e => setEngineNumber(e.target.value.toUpperCase())}
              className="fp-input"
            />
          </div>
          <div>
            <label className="fp-label">Location *</label>
            <select value={locationId} onChange={e => setLocationId(e.target.value)} className="fp-input fp-select">
              <option value="">Select location…</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="fp-label">Purchase Date</label>
            <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className="fp-input" />
          </div>
          <div>
            <label className="fp-label">Expected Delivery Date</label>
            <input type="date" value={expectedDeliveryDate} onChange={e => setExpectedDeliveryDate(e.target.value)} className="fp-input" />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={saving} className="fp-btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <Link href="/master/inventory" className="fp-btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  )
}

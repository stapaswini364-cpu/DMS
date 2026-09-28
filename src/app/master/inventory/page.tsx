'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ImportModal from './ImportModal'

type Model    = { id: string; name: string; brand: string }
type Variant  = { id: string; name: string; exShowroomPrice: string }
type Color    = { id: string; colorName: string }
type Location = { id: string; name: string }

type VehicleRow = {
  id: string
  frameNumber: string
  engineNumber: string
  status: string
  purchaseDate: string | null
  expectedDeliveryDate: string | null
  variant: { id: string; name: string; model: { id: string; name: string; brand: string } } | null
  color: { id: string; colorName: string } | null
  location: { id: string; name: string } | null
}

const STATUS_BADGE: Record<string, string> = {
  AVAILABLE:  'fp-badge-active',
  BOOKED:     'bg-[#FEF3C7] text-[#92400E]',
  SOLD:       'fp-badge-draft',
  IN_TRANSIT: 'fp-badge-trial',
}

const ALL_STATUSES = ['AVAILABLE', 'BOOKED', 'SOLD', 'IN_TRANSIT']

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="fp-card px-4 py-3 flex flex-col gap-0.5">
      <span className="text-xs" style={{ color: '#94A3B8' }}>{label}</span>
      <span className="text-xl font-bold" style={{ color: accent ?? '#1E293B' }}>{value}</span>
    </div>
  )
}

function exportCSV(vehicles: VehicleRow[]) {
  const headers = ['Frame Number', 'Engine Number', 'Brand', 'Model', 'Variant', 'Color', 'Status', 'Location', 'Purchase Date', 'Expected Delivery']
  const rows = vehicles.map(v => [
    v.frameNumber,
    v.engineNumber,
    v.variant?.model?.brand ?? '',
    v.variant?.model?.name ?? '',
    v.variant?.name ?? '',
    v.color?.colorName ?? '',
    v.status,
    v.location?.name ?? '',
    v.purchaseDate ?? '',
    v.expectedDeliveryDate ?? '',
  ])
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = 'vehicle-inventory.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function InventoryPage() {
  const router = useRouter()

  const [vehicles,    setVehicles]    = useState<VehicleRow[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showAdd,     setShowAdd]     = useState(false)
  const [showImport,  setShowImport]  = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [formError,   setFormError]   = useState('')
  const [search,      setSearch]      = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deleteError, setDeleteError] = useState<Record<string, string>>({})
  const [deleting,    setDeleting]    = useState<string | null>(null)

  // Add-form master data
  const [models,    setModels]    = useState<Model[]>([])
  const [variants,  setVariants]  = useState<Variant[]>([])
  const [colors,    setColors]    = useState<Color[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [metaReady, setMetaReady] = useState(false)

  // Add-form fields
  const [modelId,              setModelId]              = useState('')
  const [variantId,            setVariantId]            = useState('')
  const [colorId,              setColorId]              = useState('')
  const [locationId,           setLocationId]           = useState('')
  const [frameNumber,          setFrameNumber]          = useState('')
  const [engineNumber,         setEngineNumber]         = useState('')
  const [purchaseDate,         setPurchaseDate]         = useState('')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')

  const safeArr = <T,>(d: unknown): T[] => Array.isArray(d) ? d as T[] : []

  const loadVehicles = useCallback(async () => {
    setLoading(true)
    const data = await fetch('/api/inventory').then(r => r.json()).catch(() => [])
    setVehicles(safeArr<VehicleRow>(data))
    setLoading(false)
  }, [])

  useEffect(() => { loadVehicles() }, [loadVehicles])

  useEffect(() => {
    if (!showAdd || metaReady) return
    Promise.all([
      fetch('/api/products/models').then(r => r.json()).catch(() => []),
      fetch('/api/locations').then(r => r.json()).catch(() => []),
    ]).then(([m, l]) => {
      setModels(safeArr<Model>(m))
      setLocations(safeArr<Location>(l))
      setMetaReady(true)
    })
  }, [showAdd, metaReady])

  async function onModelChange(id: string) {
    setModelId(id); setVariantId(''); setColorId(''); setVariants([]); setColors([])
    if (!id) return
    const data = await fetch(`/api/products/variants?modelId=${id}`).then(r => r.json()).catch(() => [])
    setVariants(safeArr<Variant>(data))
  }

  async function onVariantChange(id: string) {
    setVariantId(id); setColorId(''); setColors([])
    if (!id) return
    const data = await fetch(`/api/products/colors?variantId=${id}`).then(r => r.json()).catch(() => [])
    setColors(safeArr<Color>(data))
  }

  function resetForm() {
    setModelId(''); setVariantId(''); setColorId(''); setLocationId('')
    setFrameNumber(''); setEngineNumber(''); setPurchaseDate(''); setExpectedDeliveryDate('')
    setVariants([]); setColors([]); setFormError('')
  }

  async function handleAdd() {
    setFormError('')
    if (!variantId)          { setFormError('Select a variant'); return }
    if (!colorId)            { setFormError('Select a color'); return }
    if (!frameNumber.trim()) { setFormError('Frame number is required'); return }
    if (!engineNumber.trim()) { setFormError('Engine number is required'); return }
    if (!locationId)         { setFormError('Select a location'); return }

    setSaving(true)
    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variantId, colorId,
        frameNumber:          frameNumber.trim().toUpperCase(),
        engineNumber:         engineNumber.trim().toUpperCase(),
        locationId,
        purchaseDate:         purchaseDate         || null,
        expectedDeliveryDate: expectedDeliveryDate || null,
      }),
    })
    setSaving(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setFormError(body?.error ?? 'Failed to add vehicle')
      return
    }
    setShowAdd(false); resetForm(); loadVehicles()
  }

  async function handleDelete(v: VehicleRow) {
    setDeleteError(prev => ({ ...prev, [v.id]: '' }))
    setDeleting(v.id)
    const res = await fetch(`/api/inventory/${v.id}`, { method: 'DELETE' })
    setDeleting(null)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setDeleteError(prev => ({ ...prev, [v.id]: body?.error ?? 'Failed to delete vehicle' }))
      return
    }
    loadVehicles()
  }

  // Summary counts
  const counts = vehicles.reduce((acc, v) => {
    acc[v.status] = (acc[v.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const filtered = vehicles.filter(v => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      v.frameNumber.toLowerCase().includes(q) ||
      v.engineNumber.toLowerCase().includes(q) ||
      (v.variant?.model?.brand ?? '').toLowerCase().includes(q) ||
      (v.variant?.model?.name  ?? '').toLowerCase().includes(q) ||
      (v.variant?.name         ?? '').toLowerCase().includes(q) ||
      (v.location?.name        ?? '').toLowerCase().includes(q)
    const matchStatus = !statusFilter || v.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="p-6">
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={loadVehicles}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B]">Vehicle Inventory</h1>
          <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>{vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportCSV(filtered)}
            className="fp-btn-secondary text-sm"
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="fp-btn-secondary text-sm"
          >
            Import CSV
          </button>
          <button
            onClick={() => { setShowAdd(v => !v); if (showAdd) resetForm() }}
            className="fp-btn-primary"
          >
            {showAdd ? '✕ Cancel' : '+ Add Vehicle'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        <StatCard label="Total"      value={vehicles.length} />
        <StatCard label="Available"  value={counts.AVAILABLE  ?? 0} accent="#16A34A" />
        <StatCard label="Booked"     value={counts.BOOKED     ?? 0} accent="#92400E" />
        <StatCard label="Sold"       value={counts.SOLD       ?? 0} accent="#64748B" />
        <StatCard label="In Transit" value={counts.IN_TRANSIT ?? 0} accent="#2563EB" />
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="fp-card p-5 mb-5 rounded-xl">
          <h2 className="text-sm font-semibold text-[#1E293B] mb-4">New Vehicle</h2>
          {formError && (
            <div className="mb-3 px-3 py-2 text-xs rounded-lg bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C]">{formError}</div>
          )}
          {!metaReady ? (
            <div className="text-sm py-4" style={{ color: '#94A3B8' }}>Loading…</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <label className="fp-label">Frame Number *</label>
                  <input value={frameNumber} onChange={e => setFrameNumber(e.target.value.toUpperCase())} placeholder="MD2A1ABY…" className="fp-input" />
                </div>
                <div>
                  <label className="fp-label">Engine Number *</label>
                  <input value={engineNumber} onChange={e => setEngineNumber(e.target.value.toUpperCase())} className="fp-input" />
                </div>
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
              <div className="flex gap-2 mt-4">
                <button onClick={handleAdd} disabled={saving} className="fp-btn-primary disabled:opacity-50">
                  {saving ? 'Adding…' : 'Add Vehicle'}
                </button>
                <button onClick={() => { setShowAdd(false); resetForm() }} className="fp-btn-secondary">Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by frame/engine number, model, location…"
          className="fp-input max-w-sm"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="fp-input fp-select w-40"
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: '#94A3B8' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl" style={{ color: '#94A3B8', borderColor: '#E2E8F0' }}>
          {search || statusFilter ? 'No vehicles match your filters.' : 'No vehicles in inventory. Add one above.'}
        </div>
      ) : (
        <div className="fp-card overflow-hidden">
          <table className="w-full text-sm text-left fp-table">
            <thead>
              <tr>
                {['Frame No.', 'Engine No.', 'Model / Variant', 'Color', 'Status', 'Location', ''].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <>
                  <tr key={v.id}>
                    <td className="font-mono text-xs font-medium" style={{ color: '#1E3A5F' }}>{v.frameNumber}</td>
                    <td className="font-mono text-xs" style={{ color: '#374151' }}>{v.engineNumber}</td>
                    <td>
                      <div className="font-medium text-[#374151]">
                        {v.variant?.model?.name ?? '—'}
                      </div>
                      <div className="text-xs" style={{ color: '#94A3B8' }}>{v.variant?.name ?? ''}</div>
                    </td>
                    <td style={{ color: '#374151' }}>{v.color?.colorName ?? '—'}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[v.status] ?? 'fp-badge-draft'}`}>
                        {v.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ color: '#64748B' }}>{v.location?.name ?? '—'}</td>
                    <td>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => router.push(`/master/inventory/${v.id}/edit`)}
                          className="text-xs px-2 py-1 rounded font-medium"
                          style={{ color: '#2563EB', background: '#EFF6FF' }}
                        >
                          Edit
                        </button>
                        {v.status !== 'BOOKED' && v.status !== 'SOLD' && (
                          <button
                            onClick={() => handleDelete(v)}
                            disabled={deleting === v.id}
                            className="text-xs px-2 py-1 rounded font-medium disabled:opacity-50"
                            style={{ color: '#DC2626', background: '#FEF2F2' }}
                          >
                            {deleting === v.id ? '…' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {deleteError[v.id] && (
                    <tr key={`${v.id}-err`}>
                      <td colSpan={7} className="pt-0 pb-2">
                        <div className="text-xs px-3 py-1.5 rounded bg-[#FEE2E2] text-[#B91C1C]">{deleteError[v.id]}</div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

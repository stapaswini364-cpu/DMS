'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type ServiceType = {
  id: string
  name: string
  basePrice: string
  isActive: boolean
}

const EMPTY = { name: '', basePrice: '' }
type FormData = typeof EMPTY

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="fp-label">
        {label}{required && <span className="text-[#DC2626] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const fmtPrice = (p: string) =>
  `₹ ${Number(p).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export default function ServiceTypesPage() {
  const [rows,     setRows]     = useState<ServiceType[]>([])
  const [loading,  setLoading]  = useState(true)
  const [form,     setForm]     = useState<FormData>(EMPTY)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [success,  setSuccess]  = useState('')
  const [error,    setError]    = useState('')

  const up = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }))

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch('/api/service-types').then(r => r.json()).catch(() => [])
    setRows(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function startEdit(st: ServiceType) {
    setEditId(st.id)
    setForm({ name: st.name, basePrice: st.basePrice })
    setError('')
    setSuccess('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditId(null)
    setForm(EMPTY)
    setError('')
  }

  async function handleSave() {
    setError('')
    setSuccess('')
    if (!form.name.trim()) { setError('Name is required'); return }

    setSaving(true)
    const url    = editId ? `/api/service-types/${editId}` : '/api/service-types'
    const method = editId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), basePrice: form.basePrice || '0' }),
    })
    setSaving(false)

    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setError(b?.error ?? 'Failed to save')
      return
    }

    setSuccess(editId ? 'Service type updated.' : 'Service type created.')
    setEditId(null)
    setForm(EMPTY)
    load()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete service type "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    const res = await fetch(`/api/service-types/${id}`, { method: 'DELETE' })
    setDeleting(null)
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setError(b?.error ?? 'Failed to delete')
      return
    }
    load()
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/master" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Master Data</Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">Service Types</h1>
      </div>

      {success && (
        <div className="mb-4 px-4 py-3 bg-[#DCFCE7] border border-[#BBF7D0] text-[#15803D] text-sm rounded-xl flex items-center gap-2">
          <span>✓</span> {success}
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-sm rounded-xl">{error}</div>
      )}

      <div className="fp-card overflow-hidden mb-6">
        <div className="px-5 py-4" style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
          <h2 className="text-sm font-semibold text-[#1E293B]">
            {editId ? 'Edit Service Type' : 'Add New Service Type'}
          </h2>
        </div>
        <div className="p-5 grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Name" required>
            <input value={form.name} onChange={e => up('name', e.target.value)} placeholder="e.g. General Service" className="fp-input" />
          </Field>
          <Field label="Base Price (₹)">
            <input type="number" min="0" step="0.01" value={form.basePrice} onChange={e => up('basePrice', e.target.value)} placeholder="0" className="fp-input" />
          </Field>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={handleSave} disabled={saving} className="fp-btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : editId ? 'Update Service Type' : 'Save Service Type'}
          </button>
          {editId && (
            <button onClick={cancelEdit} className="fp-btn-secondary">Cancel</button>
          )}
        </div>
      </div>

      <div className="fp-card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h2 className="text-sm font-semibold text-[#1E293B]">
            Service Types {!loading && `(${rows.length})`}
          </h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>No service types yet. Add one above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left fp-table">
              <thead>
                <tr>
                  {['Name', 'Base Price', 'Status', 'Actions'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(st => (
                  <tr key={st.id}>
                    <td className="font-medium text-[#374151]">{st.name}</td>
                    <td style={{ color: '#374151' }}>{fmtPrice(st.basePrice)}</td>
                    <td>
                      <span className={st.isActive ? 'fp-badge-active' : 'fp-badge-draft'}>
                        {st.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(st)} className="fp-btn-secondary text-xs" style={{ padding: '5px 12px' }}>Edit</button>
                        <button onClick={() => handleDelete(st.id, st.name)} disabled={deleting === st.id} className="fp-btn-danger text-xs disabled:opacity-50" style={{ padding: '5px 12px' }}>
                          {deleting === st.id ? '…' : 'Delete'}
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
    </div>
  )
}

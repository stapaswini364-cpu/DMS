'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Technician = {
  id: string
  name: string
  phone: string | null
  specialization: string | null
  locationId: string | null
  isActive: boolean
}

type Location = { id: string; name: string }

const EMPTY = { name: '', phone: '', specialization: '', locationId: '' }
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

export default function TechniciansPage() {
  const [rows,      setRows]      = useState<Technician[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading,   setLoading]   = useState(true)
  const [form,      setForm]      = useState<FormData>(EMPTY)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState<string | null>(null)
  const [success,   setSuccess]   = useState('')
  const [error,     setError]     = useState('')

  const up = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }))

  const load = useCallback(async () => {
    setLoading(true)
    const [techData, locData] = await Promise.all([
      fetch('/api/technicians').then(r => r.json()).catch(() => []),
      fetch('/api/locations').then(r => r.json()).catch(() => []),
    ])
    setRows(Array.isArray(techData) ? techData : [])
    setLocations(Array.isArray(locData) ? locData : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function startEdit(t: Technician) {
    setEditId(t.id)
    setForm({
      name:           t.name,
      phone:          t.phone          ?? '',
      specialization: t.specialization ?? '',
      locationId:     t.locationId     ?? '',
    })
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
    const url    = editId ? `/api/technicians/${editId}` : '/api/technicians'
    const method = editId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:           form.name.trim(),
        phone:          form.phone.trim()          || null,
        specialization: form.specialization.trim() || null,
        locationId:     form.locationId            || null,
      }),
    })
    setSaving(false)

    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setError(b?.error ?? 'Failed to save')
      return
    }

    setSuccess(editId ? 'Technician updated.' : 'Technician created.')
    setEditId(null)
    setForm(EMPTY)
    load()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete technician "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    const res = await fetch(`/api/technicians/${id}`, { method: 'DELETE' })
    setDeleting(null)
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setError(b?.error ?? 'Failed to delete')
      return
    }
    load()
  }

  const locationName = (id: string | null) =>
    locations.find(l => l.id === id)?.name ?? '—'

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/master" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Master Data</Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">Technicians</h1>
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
            {editId ? 'Edit Technician' : 'Add New Technician'}
          </h2>
        </div>
        <div className="p-5 grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Name" required>
            <input value={form.name} onChange={e => up('name', e.target.value)} placeholder="Full name" className="fp-input" />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={e => up('phone', e.target.value)} placeholder="+91 XXXXX XXXXX" className="fp-input" />
          </Field>
          <Field label="Specialization">
            <input value={form.specialization} onChange={e => up('specialization', e.target.value)} placeholder="e.g. Engine, Electricals" className="fp-input" />
          </Field>
          <Field label="Location">
            <select value={form.locationId} onChange={e => up('locationId', e.target.value)} className="fp-input fp-select">
              <option value="">All locations</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={handleSave} disabled={saving} className="fp-btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : editId ? 'Update Technician' : 'Save Technician'}
          </button>
          {editId && (
            <button onClick={cancelEdit} className="fp-btn-secondary">Cancel</button>
          )}
        </div>
      </div>

      <div className="fp-card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h2 className="text-sm font-semibold text-[#1E293B]">
            Technicians {!loading && `(${rows.length})`}
          </h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>No technicians yet. Add one above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left fp-table">
              <thead>
                <tr>
                  {['Name', 'Phone', 'Specialization', 'Location', 'Status', 'Actions'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(t => (
                  <tr key={t.id}>
                    <td className="font-medium text-[#374151]">{t.name}</td>
                    <td style={{ color: '#374151' }}>{t.phone ?? '—'}</td>
                    <td style={{ color: '#374151' }}>{t.specialization ?? '—'}</td>
                    <td style={{ color: '#374151' }}>{locationName(t.locationId)}</td>
                    <td>
                      <span className={t.isActive ? 'fp-badge-active' : 'fp-badge-draft'}>
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(t)} className="fp-btn-secondary text-xs" style={{ padding: '5px 12px' }}>Edit</button>
                        <button onClick={() => handleDelete(t.id, t.name)} disabled={deleting === t.id} className="fp-btn-danger text-xs disabled:opacity-50" style={{ padding: '5px 12px' }}>
                          {deleting === t.id ? '…' : 'Delete'}
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

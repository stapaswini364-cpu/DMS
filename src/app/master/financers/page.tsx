'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Financer = {
  id:            string
  name:          string
  contactPerson: string | null
  phone:         string | null
  email:         string | null
  address:       string | null
  isActive:      boolean
}

const EMPTY = { name: '', contactPerson: '', phone: '', email: '', address: '' }
type FormData = typeof EMPTY

function Field({ label, required, full, children }: {
  label: string; required?: boolean; full?: boolean; children: React.ReactNode
}) {
  return (
    <div className={full ? 'col-span-2 sm:col-span-3' : ''}>
      <label className="fp-label">
        {label}{required && <span className="text-[#DC2626] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

export default function FinancersPage() {
  const [rows,     setRows]     = useState<Financer[]>([])
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
    const data = await fetch('/api/financers').then(r => r.json()).catch(() => [])
    setRows(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function startEdit(f: Financer) {
    setEditId(f.id)
    setForm({
      name:          f.name,
      contactPerson: f.contactPerson ?? '',
      phone:         f.phone         ?? '',
      email:         f.email         ?? '',
      address:       f.address       ?? '',
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
    const url    = editId ? `/api/financers/${editId}` : '/api/financers'
    const method = editId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:          form.name.trim(),
        contactPerson: form.contactPerson.trim() || null,
        phone:         form.phone.trim()         || null,
        email:         form.email.trim()         || null,
        address:       form.address.trim()       || null,
      }),
    })
    setSaving(false)

    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setError(b?.error ?? 'Failed to save')
      return
    }

    setSuccess(editId ? 'Financer updated.' : 'Financer created.')
    setEditId(null)
    setForm(EMPTY)
    load()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete financer "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    const res = await fetch(`/api/financers/${id}`, { method: 'DELETE' })
    setDeleting(null)
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setError(b?.error ?? 'Failed to delete')
      return
    }
    load()
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/master" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Master Data</Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">Financer Master</h1>
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
            {editId ? 'Edit Financer' : 'Add New Financer'}
          </h2>
        </div>
        <div className="p-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Field label="Name" required>
            <input value={form.name} onChange={e => up('name', e.target.value)} placeholder="e.g. HDFC Bank" className="fp-input" />
          </Field>
          <Field label="Contact Person">
            <input value={form.contactPerson} onChange={e => up('contactPerson', e.target.value)} placeholder="Relationship manager" className="fp-input" />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={e => up('phone', e.target.value)} placeholder="+91 XXXXX XXXXX" className="fp-input" />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={e => up('email', e.target.value)} placeholder="contact@financer.com" className="fp-input" />
          </Field>
          <Field label="Address" full>
            <input value={form.address} onChange={e => up('address', e.target.value)} placeholder="Branch address" className="fp-input" />
          </Field>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={handleSave} disabled={saving} className="fp-btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : editId ? 'Update Financer' : 'Save Financer'}
          </button>
          {editId && (
            <button onClick={cancelEdit} className="fp-btn-secondary">Cancel</button>
          )}
        </div>
      </div>

      <div className="fp-card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h2 className="text-sm font-semibold text-[#1E293B]">
            Financers {!loading && `(${rows.length})`}
          </h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>No financers yet. Add one above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left fp-table">
              <thead>
                <tr>
                  {['Name', 'Contact Person', 'Phone', 'Email', 'Status', 'Actions'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td className="font-medium text-[#374151]">{row.name}</td>
                    <td style={{ color: '#374151' }}>{row.contactPerson ?? '—'}</td>
                    <td style={{ color: '#374151' }}>{row.phone ?? '—'}</td>
                    <td style={{ color: '#374151' }}>{row.email ?? '—'}</td>
                    <td>
                      <span className={row.isActive ? 'fp-badge-active' : 'fp-badge-draft'}>
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(row)} className="fp-btn-secondary text-xs" style={{ padding: '5px 12px' }}>Edit</button>
                        <button onClick={() => handleDelete(row.id, row.name)} disabled={deleting === row.id} className="fp-btn-danger text-xs disabled:opacity-50" style={{ padding: '5px 12px' }}>
                          {deleting === row.id ? '…' : 'Delete'}
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

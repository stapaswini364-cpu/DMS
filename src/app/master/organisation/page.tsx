'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────

type Branch = {
  id: string
  name: string
  type: 'HO' | 'BRANCH'
  branchType: 'BRANCH' | 'SHOWROOM' | 'WORKSHOP' | 'WAREHOUSE' | null
  inchargeName: string | null
  phone: string | null
  email: string | null
  address: string
  city: string
  state: string
  pincode: string | null
  bankName: string | null
  accountNumber: string | null
  ifscCode: string | null
  accountType: string | null
  bankBranchName: string | null
  isActive: boolean
}

const BRANCH_TYPES = ['BRANCH', 'SHOWROOM', 'WORKSHOP', 'WAREHOUSE'] as const
const LOC_TYPES    = ['HO', 'BRANCH'] as const

const BRANCH_TYPE_LABEL: Record<string, string> = {
  BRANCH:    'Branch',
  SHOWROOM:  'Showroom',
  WORKSHOP:  'Workshop',
  WAREHOUSE: 'Warehouse',
}

const BRANCH_TYPE_BADGE: Record<string, { bg: string; color: string }> = {
  BRANCH:    { bg: '#EFF6FF', color: '#1D4ED8' },
  SHOWROOM:  { bg: '#F3E8FF', color: '#7E22CE' },
  WORKSHOP:  { bg: '#FEF3C7', color: '#92400E' },
  WAREHOUSE: { bg: '#F0FDF4', color: '#15803D' },
}

// ── Empty form ────────────────────────────────────────────────────────────────

const EMPTY = {
  name:           '',
  type:           'HO' as 'HO' | 'BRANCH',
  branchType:     '' as '' | 'BRANCH' | 'SHOWROOM' | 'WORKSHOP' | 'WAREHOUSE',
  inchargeName:   '',
  phone:          '',
  email:          '',
  address:        '',
  city:           '',
  state:          '',
  pincode:        '',
  bankName:       '',
  accountNumber:  '',
  ifscCode:       '',
  accountType:    '',
  bankBranchName: '',
  isActive:       true,
}
type FormData = typeof EMPTY

// ── Field wrapper ─────────────────────────────────────────────────────────────

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

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="col-span-2 sm:col-span-3 pt-2 mt-1" style={{ borderTop: '1px solid #F1F5F9' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide mb-3" style={{ color: '#94A3B8' }}>
        {title}
      </p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BranchManagementPage() {
  const [branches,  setBranches]  = useState<Branch[]>([])
  const [loading,   setLoading]   = useState(true)
  const [form,      setForm]      = useState<FormData>(EMPTY)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState<string | null>(null)
  const [success,   setSuccess]   = useState('')
  const [error,     setError]     = useState('')
  const [query,     setQuery]     = useState('')

  const up = (k: keyof FormData, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }))

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch('/api/locations').then(r => r.json()).catch(() => [])
    setBranches(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Client-side search across name, city, state, incharge, type
  const filtered = query.trim()
    ? branches.filter(b => {
        const q = query.toLowerCase()
        return (
          b.name.toLowerCase().includes(q) ||
          b.city.toLowerCase().includes(q) ||
          b.state.toLowerCase().includes(q) ||
          (b.inchargeName?.toLowerCase().includes(q) ?? false) ||
          (b.branchType?.toLowerCase().includes(q) ?? false) ||
          b.type.toLowerCase().includes(q)
        )
      })
    : branches

  function startEdit(b: Branch) {
    setEditId(b.id)
    setForm({
      name:           b.name,
      type:           b.type,
      branchType:     b.branchType ?? '',
      inchargeName:   b.inchargeName   ?? '',
      phone:          b.phone          ?? '',
      email:          b.email          ?? '',
      address:        b.address,
      city:           b.city,
      state:          b.state,
      pincode:        b.pincode        ?? '',
      bankName:       b.bankName       ?? '',
      accountNumber:  b.accountNumber  ?? '',
      ifscCode:       b.ifscCode       ?? '',
      accountType:    b.accountType    ?? '',
      bankBranchName: b.bankBranchName ?? '',
      isActive:       b.isActive,
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
    if (!form.name.trim())         { setError('Branch name is required');   return }
    if (!form.inchargeName.trim()) { setError('Incharge name is required'); return }
    if (!form.address.trim())      { setError('Address is required');       return }
    if (!form.city.trim())         { setError('City is required');          return }
    if (!form.state.trim())        { setError('State is required');         return }

    setSaving(true)

    const payload = {
      name:           form.name.trim(),
      type:           form.type,
      branchType:     form.branchType || null,
      inchargeName:   form.inchargeName.trim(),
      phone:          form.phone.trim()          || null,
      email:          form.email.trim()          || null,
      address:        form.address.trim(),
      city:           form.city.trim(),
      state:          form.state.trim(),
      pincode:        form.pincode.trim()        || null,
      bankName:       form.bankName.trim()       || null,
      accountNumber:  form.accountNumber.trim()  || null,
      ifscCode:       form.ifscCode.trim()       || null,
      accountType:    form.accountType.trim()    || null,
      bankBranchName: form.bankBranchName.trim() || null,
      ...(editId ? { isActive: form.isActive } : {}),
    }

    const url    = editId ? `/api/locations/${editId}` : '/api/locations'
    const method = editId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSaving(false)

    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setError((b as { error?: string })?.error ?? 'Failed to save branch')
      return
    }

    setSuccess(editId ? 'Branch updated successfully.' : 'Branch added successfully.')
    setEditId(null)
    setForm(EMPTY)
    load()
  }

  async function handleDeactivate(id: string, isActive: boolean) {
    const action = isActive ? 'deactivate' : 'reactivate'
    if (!confirm(`${action === 'deactivate' ? 'Deactivate' : 'Reactivate'} this branch?`)) return
    const res = await fetch(`/api/locations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setError((b as { error?: string })?.error ?? `Failed to ${action} branch`)
      return
    }
    load()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Permanently delete branch "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    const res = await fetch(`/api/locations/${id}`, { method: 'DELETE' })
    setDeleting(null)
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setError((b as { error?: string })?.error ?? 'Failed to delete branch')
      return
    }
    load()
  }

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/master" className="text-sm hover:underline" style={{ color: '#64748B' }}>
          ← Master Data
        </Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">Branch Management</h1>
      </div>

      {/* Toast banners */}
      {success && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
          style={{ background: '#DCFCE7', border: '1px solid #BBF7D0', color: '#15803D' }}>
          ✓ {success}
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{ background: '#FEE2E2', border: '1px solid #FECACA', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      {/* ── Add / Edit form ───────────────────────────────────────────────── */}
      <div className="fp-card overflow-hidden mb-6">
        <div className="px-5 py-4" style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
          <h2 className="text-sm font-semibold text-[#1E293B]">
            {editId ? 'Edit Branch' : 'Add New Branch'}
          </h2>
        </div>

        <div className="p-5">
          {/* Branch Details section */}
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-3" style={{ color: '#94A3B8' }}>
            Branch Details
          </p>

          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Branch Name" required>
              <input
                value={form.name}
                onChange={e => up('name', e.target.value)}
                placeholder="e.g. Main Showroom, Workshop North"
                className="fp-input"
              />
            </Field>

            <Field label="Branch Type">
              <select
                value={form.branchType}
                onChange={e => up('branchType', e.target.value)}
                className="fp-input fp-select"
              >
                <option value="">Select type…</option>
                {BRANCH_TYPES.map(t => (
                  <option key={t} value={t}>{BRANCH_TYPE_LABEL[t]}</option>
                ))}
              </select>
            </Field>

            <Field label="Organisation Type">
              <select
                value={form.type}
                onChange={e => up('type', e.target.value)}
                className="fp-input fp-select"
              >
                {LOC_TYPES.map(t => (
                  <option key={t} value={t}>{t === 'HO' ? 'Head Office (HO)' : 'Branch'}</option>
                ))}
              </select>
            </Field>

            <Field label="Incharge Name" required>
              <input
                value={form.inchargeName}
                onChange={e => up('inchargeName', e.target.value)}
                placeholder="Branch manager / incharge"
                className="fp-input"
              />
            </Field>

            <Field label="Phone">
              <input
                value={form.phone}
                onChange={e => up('phone', e.target.value)}
                placeholder="+91 XXXXX XXXXX"
                className="fp-input"
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={e => up('email', e.target.value)}
                placeholder="branch@dealership.com"
                className="fp-input"
              />
            </Field>

            <Field label="Address" required>
              <input
                value={form.address}
                onChange={e => up('address', e.target.value)}
                placeholder="Street / building"
                className="fp-input"
              />
            </Field>

            <Field label="City" required>
              <input
                value={form.city}
                onChange={e => up('city', e.target.value)}
                className="fp-input"
              />
            </Field>

            <Field label="State" required>
              <input
                value={form.state}
                onChange={e => up('state', e.target.value)}
                className="fp-input"
              />
            </Field>

            <Field label="PIN Code">
              <input
                value={form.pincode}
                onChange={e => up('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit PIN"
                className="fp-input"
                maxLength={6}
              />
            </Field>

            {editId && (
              <Field label="Status">
                <select
                  value={form.isActive ? 'active' : 'inactive'}
                  onChange={e => up('isActive', e.target.value === 'active')}
                  className="fp-input fp-select"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
            )}
          </div>

          {/* Bank Details section */}
          <div
            className="mt-5 pt-4"
            style={{ borderTop: '1px solid #F1F5F9' }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-3" style={{ color: '#94A3B8' }}>
              Bank Details
            </p>
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Bank Name">
                <input
                  value={form.bankName}
                  onChange={e => up('bankName', e.target.value)}
                  placeholder="e.g. State Bank of India"
                  className="fp-input"
                />
              </Field>

              <Field label="Account Number">
                <input
                  value={form.accountNumber}
                  onChange={e => up('accountNumber', e.target.value)}
                  className="fp-input"
                />
              </Field>

              <Field label="IFSC Code">
                <input
                  value={form.ifscCode}
                  onChange={e => up('ifscCode', e.target.value.toUpperCase())}
                  placeholder="e.g. SBIN0001234"
                  className="fp-input"
                />
              </Field>

              <Field label="Account Type">
                <input
                  value={form.accountType}
                  onChange={e => up('accountType', e.target.value)}
                  placeholder="e.g. Current, Savings"
                  className="fp-input"
                />
              </Field>

              <Field label="Bank Branch Name">
                <input
                  value={form.bankBranchName}
                  onChange={e => up('bankBranchName', e.target.value)}
                  placeholder="Bank's own branch name"
                  className="fp-input"
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="fp-btn-primary disabled:opacity-50"
          >
            {saving ? 'Saving…' : editId ? 'Update Branch' : 'Save Branch'}
          </button>
          {editId && (
            <button onClick={cancelEdit} className="fp-btn-secondary">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* ── Branch list ───────────────────────────────────────────────────── */}
      <div className="fp-card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-4"
          style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h2 className="text-sm font-semibold text-[#1E293B] flex-shrink-0">
            Branches {!loading && `(${branches.length})`}
          </h2>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, city, incharge, type…"
            className="fp-input"
            style={{ maxWidth: '320px' }}
          />
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>
            {query ? 'No branches match your search.' : 'No branches yet. Add your first branch above.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left fp-table">
              <thead>
                <tr>
                  {['Branch Name', 'Type', 'Incharge', 'Location', 'Phone', 'Bank', 'Status', 'Actions'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => {
                  const badge = b.branchType ? BRANCH_TYPE_BADGE[b.branchType] : null
                  return (
                    <tr key={b.id}>
                      <td>
                        <div className="font-medium text-[#374151]">{b.name}</div>
                        <div className="text-xs font-mono" style={{ color: '#94A3B8' }}>{b.type}</div>
                      </td>
                      <td>
                        {b.branchType && badge ? (
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ background: badge.bg, color: badge.color }}
                          >
                            {BRANCH_TYPE_LABEL[b.branchType]}
                          </span>
                        ) : (
                          <span style={{ color: '#CBD5E1' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ color: '#374151' }}>{b.inchargeName ?? '—'}</div>
                        {b.email && <div className="text-xs" style={{ color: '#94A3B8' }}>{b.email}</div>}
                      </td>
                      <td>
                        <div style={{ color: '#374151' }}>{b.city}, {b.state}</div>
                        {b.pincode && <div className="text-xs font-mono" style={{ color: '#94A3B8' }}>{b.pincode}</div>}
                      </td>
                      <td style={{ color: '#374151' }}>{b.phone ?? '—'}</td>
                      <td>
                        {b.bankName ? (
                          <div>
                            <div style={{ color: '#374151' }}>{b.bankName}</div>
                            {b.ifscCode && (
                              <div className="text-xs font-mono" style={{ color: '#94A3B8' }}>{b.ifscCode}</div>
                            )}
                            {b.accountType && (
                              <div className="text-xs" style={{ color: '#94A3B8' }}>{b.accountType}</div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#CBD5E1' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={b.isActive ? 'fp-badge-active' : 'fp-badge-draft'}>
                          {b.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(b)}
                            className="fp-btn-secondary text-xs"
                            style={{ padding: '5px 12px' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeactivate(b.id, b.isActive)}
                            className="fp-btn-secondary text-xs"
                            style={{ padding: '5px 12px' }}
                          >
                            {b.isActive ? 'Deactivate' : 'Reactivate'}
                          </button>
                          <button
                            onClick={() => handleDelete(b.id, b.name)}
                            disabled={deleting === b.id}
                            className="fp-btn-danger text-xs disabled:opacity-50"
                            style={{ padding: '5px 12px' }}
                          >
                            {deleting === b.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

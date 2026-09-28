'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const ROLE_OPTIONS = [
  { label: 'Sales Executive',  value: 'sales' },
  { label: 'Accounts Manager', value: 'accounts' },
  { label: 'Service Manager',  value: 'services' },
  { label: 'Billing Staff',    value: 'billing' },
  { label: 'Auditor',          value: 'auditor' },
  { label: 'Sub Admin',        value: 'sub_admin' },
] as const

const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map(r => [r.value, r.label])
)

const ROLE_COLOR: Record<string, string> = {
  sales:     'fp-badge-confirmed',
  accounts:  'bg-[#F3E8FF] text-[#6B21A8]',
  services:  'bg-[#FEF3C7] text-[#92400E]',
  billing:   'fp-badge-trial',
  auditor:   'bg-[#F0FDFA] text-[#0F766E]',
  sub_admin: 'bg-[#FEE2E2] text-[#CC1133]',
}

type StaffRow = {
  id:          string
  userId:      string | null
  type:        'member' | 'invitation'
  name:        string
  email:       string
  faatproRole: string
  joinedAt:    string | null
  status:      'active' | 'pending'
}

const MODULE_OPTIONS = [
  { label: 'Sales',       value: 'sales' },
  { label: 'Service',     value: 'service' },
  { label: 'Accounts',    value: 'accounts' },
  { label: 'Billing',     value: 'billing' },
  { label: 'Reports',     value: 'reports' },
  { label: 'Master Data', value: 'master' },
]

const EMPTY_FORM = { name: '', email: '', role: '' }

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

function RoleBadge({ role }: { role: string }) {
  const cls = ROLE_COLOR[role] ?? 'fp-badge-draft'
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {ROLE_LABEL[role] ?? (role || 'Member')}
    </span>
  )
}

export default function StaffPage() {
  const [staff,    setStaff]    = useState<StaffRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [perms,    setPerms]    = useState<string[]>([])
  const [showForm, setShowForm] = useState(false)
  const [sending,  setSending]  = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [success,  setSuccess]  = useState('')
  const [error,    setError]    = useState('')

  const up = (k: keyof typeof EMPTY_FORM, v: string) => setForm(f => ({ ...f, [k]: v }))

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch('/api/staff').then(r => r.json()).catch(() => [])
    setStaff(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleInvite() {
    setError('')
    setSuccess('')
    if (!form.email.trim()) { setError('Email is required'); return }
    if (!form.role)          { setError('Role is required'); return }

    setSending(true)
    const res = await fetch('/api/staff/invite', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: form.name.trim(), email: form.email.trim(), role: form.role, permissions: perms }),
    })
    setSending(false)

    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setError(b?.error ?? 'Failed to send invitation')
      return
    }

    setSuccess(`Invite sent to ${form.email.trim()}. They will receive an email to join.`)
    setForm(EMPTY_FORM)
    setPerms([])
    setShowForm(false)
    load()
  }

  async function handleRemove(row: StaffRow) {
    const label = row.type === 'invitation'
      ? `Revoke invitation for ${row.email}?`
      : `Remove ${row.name || row.email} from the team? They will lose access immediately.`
    if (!confirm(label)) return

    setRemoving(row.id)
    setError('')

    const params = new URLSearchParams({ type: row.type })
    if (row.type === 'member' && row.userId) params.set('userId', row.userId)

    const res = await fetch(`/api/staff/${row.id}?${params}`, { method: 'DELETE' })
    setRemoving(null)

    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setError(b?.error ?? 'Failed to remove staff member')
      return
    }

    load()
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/master" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Master Data</Link>
          <span style={{ color: '#E2E8F0' }}>/</span>
          <h1 className="text-xl font-bold text-[#1E293B]">Staff Management</h1>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setError(''); setSuccess('') }}
          className="fp-btn-primary"
        >
          {showForm ? 'Cancel' : '+ Invite New Staff'}
        </button>
      </div>

      {success && (
        <div className="mb-4 px-4 py-3 bg-[#DCFCE7] border border-[#BBF7D0] text-[#15803D] text-sm rounded-xl flex items-center gap-2">
          <span>✓</span> {success}
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-sm rounded-xl">{error}</div>
      )}

      {showForm && (
        <div className="fp-card overflow-hidden mb-6">
          <div className="px-5 py-4" style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
            <h2 className="text-sm font-semibold text-[#1E293B]">Invite New Staff</h2>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Full Name">
              <input
                type="text"
                value={form.name}
                onChange={e => up('name', e.target.value)}
                placeholder="e.g. Rajesh Kumar"
                className="fp-input"
              />
            </Field>
            <Field label="Email Address" required>
              <input
                type="email"
                value={form.email}
                onChange={e => up('email', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
                placeholder="staff@dealership.com"
                className="fp-input"
              />
            </Field>
            <Field label="Role" required>
              <select value={form.role} onChange={e => up('role', e.target.value)} className="fp-input fp-select">
                <option value="">Select role…</option>
                {ROLE_OPTIONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="px-5 pb-4">
            <p className="fp-label mb-2">Module Access</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {MODULE_OPTIONS.map(m => (
                <label key={m.value} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={perms.includes(m.value)}
                    onChange={e =>
                      setPerms(prev =>
                        e.target.checked ? [...prev, m.value] : prev.filter(p => p !== m.value)
                      )
                    }
                    className="w-4 h-4 rounded accent-[#CC1133]"
                  />
                  <span className="text-sm" style={{ color: '#374151' }}>{m.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="px-5 pb-5">
            <button
              onClick={handleInvite}
              disabled={sending}
              className="fp-btn-primary disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </div>
      )}

      <div className="fp-card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h2 className="text-sm font-semibold text-[#1E293B]">
            Current Staff {!loading && `(${staff.length})`}
          </h2>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
        ) : staff.length === 0 ? (
          <div className="py-10 text-center text-sm" style={{ color: '#94A3B8' }}>
            No staff yet.{' '}
            <button onClick={() => setShowForm(true)} className="hover:underline" style={{ color: '#CC1133' }}>
              Invite someone →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left fp-table">
              <thead>
                <tr>
                  {['Name', 'Email', 'Role', 'Joined', 'Remove'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map(row => (
                  <tr key={row.id}>
                    <td className="font-medium text-[#374151]">
                      {row.name || '—'}
                      {row.status === 'pending' && (
                        <span className="ml-2 fp-badge-trial text-[10px]">
                          Pending
                        </span>
                      )}
                    </td>
                    <td style={{ color: '#374151' }}>{row.email}</td>
                    <td><RoleBadge role={row.faatproRole} /></td>
                    <td className="text-xs" style={{ color: '#94A3B8' }}>
                      {row.joinedAt
                        ? new Date(row.joinedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td>
                      <button
                        onClick={() => handleRemove(row)}
                        disabled={removing === row.id}
                        className="fp-btn-danger text-xs disabled:opacity-50"
                        style={{ padding: '5px 12px' }}
                      >
                        {removing === row.id ? '…' : row.type === 'invitation' ? 'Revoke' : 'Remove'}
                      </button>
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

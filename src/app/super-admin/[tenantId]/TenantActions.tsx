'use client'

import { useState } from 'react'

const PLANS    = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const
const STATUSES = ['TRIAL', 'ACTIVE', 'SUSPENDED'] as const

const STATUS_STYLE: Record<string, string> = {
  ACTIVE:    'fp-badge-active',
  SUSPENDED: 'fp-badge-suspended',
  TRIAL:     'fp-badge-trial',
}

type Props = {
  tenantId:      string
  currentPlan:   string
  currentStatus: string
}

export default function TenantActions({ tenantId, currentPlan, currentStatus }: Props) {
  const [plan,       setPlan]       = useState(currentPlan)
  const [status,     setStatus]     = useState(currentStatus)
  const [saving,     setSaving]     = useState<'plan' | 'status' | null>(null)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState('')

  async function patch(field: 'plan' | 'status', value: string) {
    setError('')
    setSuccess('')
    setSaving(field)

    const res = await fetch(`/api/super-admin/tenants/${tenantId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ [field]: value }),
    })

    setSaving(null)

    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setError(b?.error ?? 'Update failed')
      return
    }

    if (field === 'plan')   setPlan(value)
    if (field === 'status') setStatus(value)
    setSuccess(`${field === 'plan' ? 'Plan' : 'Status'} updated to ${value}`)
  }

  return (
    <div className="space-y-4">
      {success && (
        <div className="px-4 py-3 bg-[#DCFCE7] border border-[#BBF7D0] text-[#15803D] text-sm rounded-lg">
          ✓ {success}
        </div>
      )}
      {error && (
        <div className="px-4 py-3 bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Plan */}
        <div className="rounded-xl p-4" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <p className="fp-label mb-2">Plan</p>
          <div className="flex items-center gap-2">
            <select
              value={plan}
              onChange={e => setPlan(e.target.value)}
              className="fp-input fp-select flex-1"
            >
              {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button
              onClick={() => patch('plan', plan)}
              disabled={saving === 'plan' || plan === currentPlan}
              className="fp-btn-primary disabled:opacity-50 whitespace-nowrap"
              style={{ padding: '8px 14px', fontSize: '12px' }}
            >
              {saving === 'plan' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="rounded-xl p-4" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <p className="fp-label mb-2">Status</p>
          <div className="flex items-center gap-2">
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="fp-input fp-select flex-1"
            >
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={() => patch('status', status)}
              disabled={saving === 'status' || status === currentStatus}
              className="fp-btn-primary disabled:opacity-50 whitespace-nowrap"
              style={{ padding: '8px 14px', fontSize: '12px' }}
            >
              {saving === 'status' ? 'Saving…' : 'Save'}
            </button>
          </div>
          <div className="mt-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[status] ?? 'bg-[#F1F5F9] text-[#475569]'}`}>
              {status}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

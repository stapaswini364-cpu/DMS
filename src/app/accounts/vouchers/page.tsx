'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import LoadingSpinner from '@/app/components/ui/LoadingSpinner'

type Voucher = {
  id: string
  voucherNumber: string
  voucherType: string
  displayType: string
  date: string
  amount: string | number
  narration: string | null
  partyId: string | null
  pendingAmount: string | null
  frameOrJobCard: string | null
  location: { id: string; name: string } | null
  createdBy: { id: string; name: string } | null
}

const TYPE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  RECEIPT:     { bg: '#DCFCE7', color: '#15803D', label: 'Receipt' },
  SERVICE:     { bg: '#EFF6FF', color: '#1D4ED8', label: 'Service' },
  PAYMENT:     { bg: '#FEE2E2', color: '#B91C1C', label: 'Payment' },
  CONTRA:      { bg: '#DBEAFE', color: '#1D4ED8', label: 'Contra' },
  SALES:       { bg: '#F3E8FF', color: '#7E22CE', label: 'Sales' },
  JOURNAL:     { bg: '#FEF3C7', color: '#92400E', label: 'Journal' },
  PURCHASE:    { bg: '#FFF7ED', color: '#C2410C', label: 'Purchase' },
  DEBIT_NOTE:  { bg: '#FEF9C3', color: '#713F12', label: 'Debit Note' },
  CREDIT_NOTE: { bg: '#F0FDF4', color: '#15803D', label: 'Credit Note' },
  MANUAL:      { bg: '#F1F5F9', color: '#475569', label: 'Manual' },
}

const TYPE_OPTIONS = [
  'RECEIPT', 'SERVICE', 'PAYMENT', 'CONTRA', 'SALES', 'JOURNAL', 'PURCHASE',
]

const fmt = (n: string | number) =>
  `₹ ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

type Filters = { search: string; startDate: string; endDate: string; type: string }

const EMPTY_FILTERS: Filters = { search: '', startDate: '', endDate: '', type: '' }

export default function VouchersPage() {
  const [rows,     setRows]     = useState<Voucher[]>([])
  const [loading,  setLoading]  = useState(true)
  const [draft,    setDraft]    = useState<Filters>(EMPTY_FILTERS)
  const [applied,  setApplied]  = useState<Filters>(EMPTY_FILTERS)

  useEffect(() => {
    fetch('/api/accounts/vouchers')
      .then(r => r.ok ? r.json() : [])
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q       = applied.search.trim().toLowerCase()
    const start   = applied.startDate ? new Date(applied.startDate + 'T00:00:00').getTime() : null
    const end     = applied.endDate   ? new Date(applied.endDate   + 'T23:59:59').getTime() : null
    const type    = applied.type

    return rows.filter(v => {
      if (type && v.displayType !== type) return false
      if (start || end) {
        const t = new Date(v.date).getTime()
        if (start && t < start) return false
        if (end   && t > end)   return false
      }
      if (q) {
        const hay = [v.voucherNumber, v.narration, v.frameOrJobCard]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, applied])

  function onApply(e: React.FormEvent) {
    e.preventDefault()
    setApplied(draft)
  }
  function onReset() {
    setDraft(EMPTY_FILTERS)
    setApplied(EMPTY_FILTERS)
  }

  const hasFilters = applied.search || applied.startDate || applied.endDate || applied.type

  return (
    <div className="p-6" style={{ background: '#F5F7FA', minHeight: '100vh' }}>
      <div className="mb-6">
        <Link href="/accounts" className="text-sm hover:underline" style={{ color: '#94A3B8' }}>
          ← Accounts
        </Link>
        <h1 className="text-xl font-bold mt-2" style={{ color: '#1E293B' }}>Vouchers</h1>
        <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>All voucher entries</p>
      </div>

      <form
        onSubmit={onApply}
        className="fp-card mb-4 px-4 py-3 flex flex-wrap items-end gap-3"
        style={{ borderRadius: '12px' }}
      >
        <div className="flex-1 min-w-[200px]">
          <label className="fp-label">Search</label>
          <input
            className="fp-input"
            placeholder="Voucher #, narration, frame/job card"
            value={draft.search}
            onChange={e => setDraft({ ...draft, search: e.target.value })}
          />
        </div>
        <div>
          <label className="fp-label">From</label>
          <input
            type="date"
            className="fp-input"
            value={draft.startDate}
            onChange={e => setDraft({ ...draft, startDate: e.target.value })}
          />
        </div>
        <div>
          <label className="fp-label">To</label>
          <input
            type="date"
            className="fp-input"
            value={draft.endDate}
            onChange={e => setDraft({ ...draft, endDate: e.target.value })}
          />
        </div>
        <div>
          <label className="fp-label">Type</label>
          <select
            className="fp-select"
            value={draft.type}
            onChange={e => setDraft({ ...draft, type: e.target.value })}
          >
            <option value="">All types</option>
            {TYPE_OPTIONS.map(t => (
              <option key={t} value={t}>{TYPE_BADGE[t]?.label ?? t}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onReset} className="fp-btn-secondary">Reset</button>
          <button type="submit" className="fp-btn-primary">Filter</button>
        </div>
      </form>

      <div
        className="overflow-hidden"
        style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: '#94A3B8' }}>
            {hasFilters
              ? 'No vouchers match the current filters.'
              : <>No vouchers found. <Link href="/accounts/vouchers/new" className="underline" style={{ color: '#CC1133' }}>Create one</Link>.</>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Voucher #', 'Type', 'Frame / Job Card', 'Date', 'Amount', 'Outstanding', 'Narration', ''].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-xs font-semibold"
                      style={{ color: '#64748B' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((v, i) => {
                  const badge = TYPE_BADGE[v.displayType] ?? TYPE_BADGE[v.voucherType]
                  return (
                    <tr
                      key={v.id}
                      style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : undefined }}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: '#1E3A5F' }}>
                        {v.voucherNumber}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: badge?.bg ?? '#F1F5F9', color: badge?.color ?? '#475569' }}
                        >
                          {badge?.label ?? (v.displayType ?? v.voucherType).replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: '#475569' }}>
                        {v.frameOrJobCard ?? <span style={{ color: '#CBD5E1' }}>—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>
                        {new Date(v.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: '#1E293B' }}>
                        {fmt(v.amount)}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                        {v.pendingAmount === null ? (
                          <span style={{ color: '#CBD5E1' }}>—</span>
                        ) : Number(v.pendingAmount) > 0 ? (
                          <span style={{ color: '#DC2626' }}>{fmt(v.pendingAmount)}</span>
                        ) : (
                          <span style={{ color: '#16A34A' }}>Nil</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: '#64748B' }}>
                        {v.narration ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/accounts/vouchers/${v.id}`}
                          className="text-xs font-semibold hover:underline"
                          style={{ color: '#CC1133' }}
                        >
                          View →
                        </Link>
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

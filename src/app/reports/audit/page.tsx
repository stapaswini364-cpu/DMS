'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type AuditLog = {
  id:        string
  userId:    string
  userEmail: string | null
  action:    string
  module:    string
  recordId:  string | null
  details:   Record<string, unknown> | null
  createdAt: string
}

const MODULES = ['Sales', 'Service', 'Accounts', 'Master']

const ACTION_STYLE: Record<string, string> = {
  BOOKING_CREATED:        'bg-green-100 text-green-700',
  SERVICE_CREATED:        'bg-green-100 text-green-700',
  VOUCHER_CREATED:        'bg-green-100 text-green-700',
  BOOKING_STATUS_CHANGED: 'bg-orange-100 text-orange-700',
  CUSTOMER_DELETED:       'bg-red-100 text-red-700',
}

const ACTION_LABEL: Record<string, string> = {
  BOOKING_CREATED:        'Booking Created',
  SERVICE_CREATED:        'Service Created',
  VOUCHER_CREATED:        'Voucher Created',
  BOOKING_STATUS_CHANGED: 'Status Changed',
  CUSTOMER_DELETED:       'Customer Deleted',
}

const MODULE_COLOR: Record<string, string> = {
  Sales:    'bg-blue-50 text-blue-700',
  Service:  'bg-orange-50 text-orange-700',
  Accounts: 'bg-purple-50 text-purple-700',
  Master:   'bg-gray-100 text-gray-700',
}

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return '—'
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ')
}

function shortUserId(uid: string) {
  return uid.length > 16 ? uid.slice(0, 12) + '…' : uid
}

export default function AuditTrailPage() {
  const today = new Date().toISOString().slice(0, 10)

  const [logs,       setLogs]       = useState<AuditLog[]>([])
  const [loading,    setLoading]    = useState(true)
  const [startDate,  setStartDate]  = useState(today)
  const [endDate,    setEndDate]    = useState(today)
  const [module,     setModule]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams({ startDate, endDate })
    if (module) sp.set('module', module)
    const data = await fetch(`/api/audit?${sp}`).then(r => r.json()).catch(() => [])
    setLogs(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [startDate, endDate, module])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/reports" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Reports</Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <div>
          <h1 className="text-xl font-bold text-[#1E293B]">Audit Trail</h1>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Who did what and when</p>
        </div>
      </div>

      {/* Filters */}
      <div className="fp-card p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block fp-label mb-1">From</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="fp-input"
              style={{ width: 'auto' }}
            />
          </div>
          <div>
            <label className="block fp-label mb-1">To</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="fp-input"
              style={{ width: 'auto' }}
            />
          </div>
          <div>
            <label className="block fp-label mb-1">Module</label>
            <select
              value={module}
              onChange={e => setModule(e.target.value)}
              className="fp-input fp-select"
              style={{ width: 'auto' }}
            >
              <option value="">All Modules</option>
              {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <button onClick={load} className="fp-btn-primary">
            Apply
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="fp-card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h2 className="text-sm font-semibold text-[#1E293B]">Activity Log</h2>
          {!loading && (
            <span className="text-xs" style={{ color: '#94A3B8' }}>{logs.length} event{logs.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: '#94A3B8' }}>No activity found for the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left fp-table">
              <thead>
                <tr>
                  {['Date / Time', 'User', 'Module', 'Action', 'Record', 'Details'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="text-xs whitespace-nowrap font-mono" style={{ color: '#94A3B8' }}>
                      {new Date(log.createdAt).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: true,
                      })}
                    </td>
                    <td>
                      {log.userEmail ? (
                        <div className="text-xs font-medium text-[#374151]">{log.userEmail}</div>
                      ) : (
                        <span className="text-xs font-mono" style={{ color: '#94A3B8' }}>{shortUserId(log.userId)}</span>
                      )}
                    </td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MODULE_COLOR[log.module] ?? 'fp-badge-draft'}`}>
                        {log.module}
                      </span>
                    </td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_STYLE[log.action] ?? 'fp-badge-confirmed'}`}>
                        {ACTION_LABEL[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="text-xs font-mono" style={{ color: '#94A3B8' }}>
                      {log.recordId ? log.recordId.slice(0, 8) + '…' : '—'}
                    </td>
                    <td className="text-xs max-w-xs truncate" style={{ color: '#94A3B8' }}>
                      {formatDetails(log.details)}
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

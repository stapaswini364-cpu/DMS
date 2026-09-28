'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import LoadingSpinner from '@/app/components/ui/LoadingSpinner'

// ── Types ──────────────────────────────────────────────────────────────────────

type SubGroup = {
  id: string
  code: string
  name: string
  groupName: string
  majorHeadName: string
  accountTypeCode: string
  accountTypeName: string
}

type LedgerOption = {
  id: string
  ledgerCode: string
  ledgerName: string
  subGroupName: string
  accountTypeCode: string
  normalBalance: 'debit' | 'credit'
}

type Location = { id: string; name: string }

type TxRow = {
  date: string
  voucherNo: string
  voucherType: string
  narration: string | null
  reference: string | null
  locationName: string | null
  debit: string | null
  credit: string | null
  balance: string
  balanceSide: 'Dr' | 'Cr'
}

type LedgerReport = {
  ledger: {
    id: string
    ledgerCode: string
    ledgerName: string
    subGroupName: string
    groupName: string
    majorHeadName: string
    accountTypeCode: string
    accountTypeName: string
  }
  period: { startDate: string; endDate: string }
  openingBalance: string
  openingBalanceSide: 'Dr' | 'Cr'
  totalDebit: string
  totalCredit: string
  closingBalance: string
  closingBalanceSide: 'Dr' | 'Cr'
  transactions: TxRow[]
  _meta: { rowCount: number; locationFiltered: boolean; note?: string }
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

const VOUCHER_TYPE_BADGE: Record<string, { bg: string; color: string }> = {
  RECEIPT:     { bg: '#DCFCE7', color: '#15803D' },
  PAYMENT:     { bg: '#FEE2E2', color: '#B91C1C' },
  CONTRA:      { bg: '#DBEAFE', color: '#1D4ED8' },
  JOURNAL:     { bg: '#FEF3C7', color: '#92400E' },
  SALES:       { bg: '#F3E8FF', color: '#7E22CE' },
  PURCHASE:    { bg: '#FFF7ED', color: '#C2410C' },
  MANUAL:      { bg: '#F1F5F9', color: '#475569' },
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtAmt = (n: string | null | undefined) =>
  n ? `₹ ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

function BalancePill({ amount, side }: { amount: string; side: 'Dr' | 'Cr' }) {
  const isDr = side === 'Dr'
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{
        background: isDr ? 'rgba(37,99,235,0.10)' : 'rgba(220,38,38,0.10)',
        color:      isDr ? '#1D4ED8' : '#B91C1C',
      }}
    >
      {fmtAmt(amount)} <span className="opacity-70">{side}</span>
    </span>
  )
}

// ── CSV Export ─────────────────────────────────────────────────────────────────

function exportCsv(report: LedgerReport) {
  const header = ['Date', 'Voucher No', 'Type', 'Narration', 'Reference', 'Branch', 'Debit', 'Credit', 'Balance', 'Dr/Cr']
  const rows = report.transactions.map(t => [
    fmtDate(t.date),
    t.voucherNo,
    t.voucherType,
    t.narration ?? '',
    t.reference ?? '',
    t.locationName ?? '',
    t.debit ?? '',
    t.credit ?? '',
    t.balance,
    t.balanceSide,
  ])

  const summary = [
    [],
    ['', '', '', '', '', 'Opening Balance', '', '', report.openingBalance, report.openingBalanceSide],
    ['', '', '', '', '', 'Total Debit',     report.totalDebit,  '', '', ''],
    ['', '', '', '', '', 'Total Credit',    '', report.totalCredit, '', ''],
    ['', '', '', '', '', 'Closing Balance', '', '', report.closingBalance, report.closingBalanceSide],
  ]

  const csv = [header, ...rows, ...summary]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `ledger-${report.ledger.ledgerCode}-${report.period.startDate}-to-${report.period.endDate}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function LedgerReportPage() {
  const today      = new Date().toISOString().slice(0, 10)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().slice(0, 10)

  // Master data
  const [subGroups, setSubGroups] = useState<SubGroup[]>([])
  const [ledgers,   setLedgers]   = useState<LedgerOption[]>([])
  const [locations, setLocations] = useState<Location[]>([])

  // Filters
  const [subGroupId,  setSubGroupId]  = useState('')
  const [ledgerId,    setLedgerId]    = useState('')
  const [startDate,   setStartDate]   = useState(monthStart)
  const [endDate,     setEndDate]     = useState(today)
  const [locationId,  setLocationId]  = useState('')

  // Report state
  const [report,   setReport]   = useState<LedgerReport | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [page,     setPage]     = useState(1)

  const printRef = useRef<HTMLDivElement>(null)

  // Load master data once
  useEffect(() => {
    Promise.all([
      fetch('/api/master/sub-groups').then(r => r.json()).catch(() => []),
      fetch('/api/master/chart-of-accounts/flat').then(r => r.json()).catch(() => []),
      fetch('/api/locations').then(r => r.json()).catch(() => []),
    ]).then(([sg, la, locs]) => {
      setSubGroups(Array.isArray(sg) ? sg : [])
      setLedgers(Array.isArray(la) ? la : [])
      setLocations(Array.isArray(locs) ? locs : [])
    })
  }, [])

  // Ledgers filtered by sub-group selection (flat COA includes subGroupId per row)
  const visibleLedgers = subGroupId
    ? ledgers.filter(l => (l as LedgerOption & { subGroupId?: string }).subGroupId === subGroupId)
    : ledgers

  // When sub-group changes, clear ledger if it no longer belongs to this sub-group
  const handleSubGroupChange = (id: string) => {
    setSubGroupId(id)
    if (id && ledgerId) {
      const l = ledgers.find(l => (l as LedgerOption & { subGroupId?: string }).subGroupId === id
        ? l.id === ledgerId : false)
      if (!l) setLedgerId('')
    }
  }

  // When ledger changes, auto-populate its sub-group
  const handleLedgerChange = (id: string) => {
    setLedgerId(id)
    if (id) {
      const found = ledgers.find(l => l.id === id) as (LedgerOption & { subGroupId?: string }) | undefined
      if (found?.subGroupId) {
        setSubGroupId(found.subGroupId)
      }
    }
  }

  const load = useCallback(async () => {
    if (!ledgerId) { setError('Select a ledger to run the report.'); return }
    setLoading(true)
    setError('')
    setPage(1)
    const qs = new URLSearchParams({ ledgerId, startDate, endDate })
    if (locationId) qs.set('locationId', locationId)
    try {
      const res  = await fetch(`/api/reports/ledger?${qs}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to load report'); setLoading(false); return }
      setReport(data)
    } catch {
      setError('Failed to load report')
    }
    setLoading(false)
  }, [ledgerId, startDate, endDate, locationId])

  const handlePrint = () => window.print()

  // Pagination
  const totalPages = report ? Math.max(1, Math.ceil(report.transactions.length / PAGE_SIZE)) : 1
  const pageRows   = report
    ? report.transactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : []

  return (
    <div className="p-6 max-w-7xl">
      {/* Breadcrumb + title */}
      <div className="mb-6 print:hidden">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/accounts/reports" className="text-xs hover:underline" style={{ color: '#94A3B8' }}>
            ← Reports
          </Link>
          <span style={{ color: '#CBD5E1' }}>/</span>
          <span className="text-xs" style={{ color: '#64748B' }}>Ledger</span>
        </div>
        <h1 className="text-xl font-bold text-[#1E293B]">Ledger Report</h1>
        <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>
          Full transaction history and running balance for any ledger account
        </p>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-lg font-bold text-[#1E293B]">Ledger Report</h1>
        {report && (
          <p className="text-sm" style={{ color: '#374151' }}>
            {report.ledger.ledgerCode} — {report.ledger.ledgerName} &nbsp;·&nbsp;
            {fmtDate(report.period.startDate)} to {fmtDate(report.period.endDate)}
          </p>
        )}
      </div>

      {/* ── Filter controls ─────────────────────────────────────────────────── */}
      <div className="fp-card mb-5 print:hidden" style={{ padding: '16px 20px', borderRadius: '12px' }}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">

          {/* Sub Group */}
          <div>
            <label className="fp-label">Sub Group</label>
            <select
              value={subGroupId}
              onChange={e => handleSubGroupChange(e.target.value)}
              className="fp-input fp-select w-full"
            >
              <option value="">All Sub Groups</option>
              {subGroups.map(sg => (
                <option key={sg.id} value={sg.id}>
                  {sg.name}
                </option>
              ))}
            </select>
          </div>

          {/* Ledger */}
          <div className="xl:col-span-2">
            <label className="fp-label">Ledger <span style={{ color: '#CC1133' }}>*</span></label>
            <select
              value={ledgerId}
              onChange={e => handleLedgerChange(e.target.value)}
              className="fp-input fp-select w-full"
            >
              <option value="">Select ledger…</option>
              {visibleLedgers.map(l => (
                <option key={l.id} value={l.id}>
                  {l.ledgerCode} — {l.ledgerName}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="fp-label">From</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="fp-input w-full"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="fp-label">To</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="fp-input w-full"
            />
          </div>

          {/* Branch */}
          <div>
            <label className="fp-label">Branch</label>
            <select
              value={locationId}
              onChange={e => setLocationId(e.target.value)}
              className="fp-input fp-select w-full"
            >
              <option value="">All Branches</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 mt-4 pt-3" style={{ borderTop: '1px solid #F1F5F9' }}>
          <button
            onClick={load}
            disabled={loading || !ledgerId}
            className="fp-btn-primary disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Run Report'}
          </button>
          {report && (
            <>
              <button
                onClick={() => exportCsv(report)}
                className="fp-btn-secondary"
              >
                Export CSV
              </button>
              <button
                onClick={handlePrint}
                className="fp-btn-secondary"
              >
                Print
              </button>
            </>
          )}
        </div>

        {error && (
          <div className="mt-3 px-3 py-2 text-sm rounded-lg" style={{ background: '#FEF2F2', color: '#B91C1C' }}>
            {error}
          </div>
        )}
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size={32} />
        </div>
      )}

      {/* ── Report output ────────────────────────────────────────────────────── */}
      {!loading && report && (
        <div ref={printRef}>

          {/* Ledger identity */}
          <div className="fp-card mb-4" style={{ padding: '16px 20px', borderRadius: '12px' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-mono" style={{ color: '#94A3B8' }}>{report.ledger.ledgerCode}</p>
                <p className="text-base font-bold text-[#1E293B]">{report.ledger.ledgerName}</p>
                <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                  {report.ledger.subGroupName} · {report.ledger.groupName} · {report.ledger.majorHeadName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: '#94A3B8' }}>
                  {fmtDate(report.period.startDate)} — {fmtDate(report.period.endDate)}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                  {report._meta.rowCount} transaction{report._meta.rowCount !== 1 ? 's' : ''}
                  {report._meta.locationFiltered ? ' · branch filtered' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Summary strip — totals always from ALL transactions, never from current page */}
          <div
            className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4"
          >
            {[
              { label: 'Opening Balance', amount: report.openingBalance, side: report.openingBalanceSide as 'Dr' | 'Cr', color: '#475569' },
              { label: 'Total Debit',     amount: report.totalDebit,     side: 'Dr' as const,                             color: '#1D4ED8' },
              { label: 'Total Credit',    amount: report.totalCredit,    side: 'Cr' as const,                             color: '#B91C1C' },
              { label: 'Closing Balance', amount: report.closingBalance, side: report.closingBalanceSide as 'Dr' | 'Cr', color: '#15803D', bold: true },
            ].map(card => (
              <div
                key={card.label}
                className="fp-card"
                style={{ padding: '14px 18px', borderRadius: '12px', borderLeft: `3px solid ${card.color}` }}
              >
                <p className="text-xs mb-1" style={{ color: '#94A3B8' }}>{card.label}</p>
                <p
                  className={`text-sm ${card.bold ? 'font-bold' : 'font-semibold'} text-[#1E293B]`}
                  style={{ fontSize: card.bold ? '15px' : undefined }}
                >
                  {fmtAmt(card.amount)}{' '}
                  <span
                    className="text-xs font-normal"
                    style={{ color: card.side === 'Dr' ? '#1D4ED8' : '#B91C1C' }}
                  >
                    {card.side}
                  </span>
                </p>
              </div>
            ))}
          </div>

          {report._meta.note && (
            <div
              className="mb-4 px-3 py-2 text-xs rounded-lg print:hidden"
              style={{ background: '#FFF7ED', color: '#92400E', border: '1px solid #FED7AA' }}
            >
              ℹ {report._meta.note}
            </div>
          )}

          {/* Transaction table */}
          {report.transactions.length === 0 ? (
            <div
              className="fp-card py-16 text-center text-sm"
              style={{ color: '#94A3B8', borderRadius: '12px' }}
            >
              No transactions found for this ledger in the selected period.
            </div>
          ) : (
            <div className="fp-card overflow-hidden" style={{ borderRadius: '12px' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left fp-table">
                  <thead>
                    <tr>
                      {['Date', 'Voucher No', 'Type', 'Narration / Reference', 'Branch', 'Debit', 'Credit', 'Balance'].map(h => (
                        <th key={h} className={h === 'Debit' || h === 'Credit' || h === 'Balance' ? 'text-right' : ''}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Opening balance row */}
                    <tr style={{ background: '#F8FAFC' }}>
                      <td colSpan={5} className="text-xs font-semibold" style={{ color: '#64748B' }}>
                        Opening Balance
                      </td>
                      <td />
                      <td />
                      <td className="text-right">
                        <BalancePill amount={report.openingBalance} side={report.openingBalanceSide} />
                      </td>
                    </tr>

                    {pageRows.map((t, idx) => {
                      const badge = VOUCHER_TYPE_BADGE[t.voucherType]
                      return (
                        <tr key={idx}>
                          <td className="whitespace-nowrap text-xs" style={{ color: '#64748B' }}>
                            {fmtDate(t.date)}
                          </td>
                          <td className="font-mono text-xs font-semibold" style={{ color: '#CC1133' }}>
                            {t.voucherNo}
                          </td>
                          <td>
                            <span
                              className="px-1.5 py-0.5 rounded text-xs font-medium"
                              style={badge
                                ? { background: badge.bg, color: badge.color }
                                : { background: '#F1F5F9', color: '#475569' }
                              }
                            >
                              {t.voucherType}
                            </span>
                          </td>
                          <td className="max-w-xs">
                            <div className="text-xs truncate text-[#374151]">{t.narration ?? '—'}</div>
                            {t.reference && (
                              <div className="text-xs truncate" style={{ color: '#94A3B8' }}>{t.reference}</div>
                            )}
                          </td>
                          <td className="text-xs" style={{ color: '#94A3B8' }}>{t.locationName ?? '—'}</td>
                          <td className="text-right text-xs font-medium" style={{ color: '#1D4ED8' }}>
                            {t.debit ? fmtAmt(t.debit) : ''}
                          </td>
                          <td className="text-right text-xs font-medium" style={{ color: '#B91C1C' }}>
                            {t.credit ? fmtAmt(t.credit) : ''}
                          </td>
                          <td className="text-right">
                            <BalancePill amount={t.balance} side={t.balanceSide} />
                          </td>
                        </tr>
                      )
                    })}

                    {/* Closing balance row — only shown on last page */}
                    {page === totalPages && (
                      <tr style={{ background: '#F0FDF4', borderTop: '2px solid #86EFAC' }}>
                        <td colSpan={5} className="text-xs font-bold" style={{ color: '#15803D' }}>
                          Closing Balance
                        </td>
                        <td className="text-right text-xs font-semibold" style={{ color: '#1D4ED8' }}>
                          {fmtAmt(report.totalDebit)}
                        </td>
                        <td className="text-right text-xs font-semibold" style={{ color: '#B91C1C' }}>
                          {fmtAmt(report.totalCredit)}
                        </td>
                        <td className="text-right">
                          <BalancePill amount={report.closingBalance} side={report.closingBalanceSide} />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div
                  className="flex items-center justify-between px-5 py-3 print:hidden"
                  style={{ borderTop: '1px solid #F1F5F9' }}
                >
                  <span className="text-xs" style={{ color: '#94A3B8' }}>
                    Page {page} of {totalPages} &nbsp;·&nbsp; {report.transactions.length} rows total
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="fp-btn-secondary text-xs disabled:opacity-40"
                      style={{ padding: '4px 12px' }}
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="fp-btn-secondary text-xs disabled:opacity-40"
                      style={{ padding: '4px 12px' }}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state before first run */}
      {!loading && !report && !error && (
        <div
          className="fp-card py-20 text-center print:hidden"
          style={{ borderRadius: '12px', color: '#94A3B8' }}
        >
          <p className="text-sm">Select a ledger and date range, then click <strong>Run Report</strong>.</p>
        </div>
      )}

      {/* Print styles — must be inline in a style tag since Tailwind print: isn't fully available */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:block  { display: block !important; }
          body { font-size: 11px; }
          .fp-card { box-shadow: none; border: 1px solid #E2E8F0; }
          table { page-break-inside: auto; }
          tr    { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}

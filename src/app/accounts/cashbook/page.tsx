'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Transaction = {
  id: string
  voucherNumber: string
  voucherType: string
  date: string
  narration: string | null
  reference: string | null
  debit: number
  credit: number
  balance: number
}

type CashbookData = {
  openingBalance: string
  totalReceipts: string
  totalPayments: string
  closingBalance: string
  transactions: Transaction[]
}

const TYPE_BADGE: Record<string, { bg: string; color: string }> = {
  RECEIPT: { bg: '#DCFCE7', color: '#15803D' },
  PAYMENT: { bg: '#FEE2E2', color: '#B91C1C' },
  CONTRA:  { bg: '#DBEAFE', color: '#1D4ED8' },
}

const fmt = (n: string | number) =>
  `₹ ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

function firstOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function SummaryCard({
  label,
  value,
  accent,
  large,
}: {
  label: string
  value: string
  accent: string
  large?: boolean
}) {
  return (
    <div
      style={{
        background: 'white',
        border: `1px solid #E2E8F0`,
        borderRadius: '12px',
        padding: '20px 24px',
        borderLeft: `4px solid ${accent}`,
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>
        {label}
      </p>
      <p
        className={large ? 'text-2xl font-bold' : 'text-xl font-semibold'}
        style={{ color: '#1E293B' }}
      >
        {value}
      </p>
    </div>
  )
}

export default function CashbookPage() {
  const [startDate, setStartDate] = useState(firstOfMonth())
  const [endDate,   setEndDate]   = useState(today())
  const [data,      setData]      = useState<CashbookData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ startDate, endDate })
      const res = await fetch(`/api/accounts/cashbook?${params}`)
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        setError(b?.error ?? 'Failed to load cash book')
        setData(null)
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      setError('Failed to load cash book')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => { fetchData() }, [fetchData])

  const inputCls = [
    'px-3 py-2 text-sm rounded-lg',
    'border border-[#E2E8F0] bg-white text-[#1E293B]',
    'focus:outline-none focus:border-[#CC1133]',
    'transition-colors',
  ].join(' ')

  return (
    <div className="p-6" style={{ background: '#F5F7FA', minHeight: '100vh' }}>
      {/* Header */}
      <div className="mb-6">
        <Link href="/accounts" className="text-sm hover:underline" style={{ color: '#94A3B8' }}>
          ← Accounts
        </Link>
        <h1 className="text-xl font-bold mt-2" style={{ color: '#1E293B' }}>Cash Book</h1>
        <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>Day-wise cash transactions</p>
      </div>

      {/* Date range filter */}
      <div
        className="flex flex-wrap items-end gap-4 mb-6"
        style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px 20px' }}
      >
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {error && (
        <div
          className="mb-4 px-4 py-3 text-sm rounded-lg"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}
        >
          {error}
        </div>
      )}

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
          <SummaryCard label="Opening Balance" value={fmt(data.openingBalance)} accent="#2563EB" />
          <SummaryCard label="Total Receipts"  value={fmt(data.totalReceipts)}  accent="#16A34A" />
          <SummaryCard label="Total Payments"  value={fmt(data.totalPayments)}  accent="#DC2626" />
          <SummaryCard label="Closing Balance" value={fmt(data.closingBalance)} accent="#1E3A5F" large />
        </div>
      )}

      {/* Transactions table */}
      <div
        className="overflow-hidden"
        style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px' }}
      >
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#1E293B' }}>Transactions</h2>
          {data && (
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
              {data.transactions.length} transaction{data.transactions.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
        ) : !data || data.transactions.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: '#94A3B8' }}>
            No cash transactions for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  {['Date', 'Voucher #', 'Type', 'Particulars', 'Receipts', 'Payments', 'Balance'].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: '#94A3B8' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Opening balance row */}
                <tr style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
                  <td className="px-4 py-3 text-xs" style={{ color: '#94A3B8' }}>—</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#94A3B8' }}>—</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: '#64748B' }}>Opening Balance</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#1E293B' }}>
                    {fmt(data.openingBalance)}
                  </td>
                </tr>

                {data.transactions.map((tx, i) => {
                  const badge = TYPE_BADGE[tx.voucherType]
                  return (
                    <tr
                      key={tx.id}
                      style={{ borderBottom: i < data.transactions.length - 1 ? '1px solid #F1F5F9' : undefined }}
                    >
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>
                        {new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: '#1E3A5F' }}>
                        {tx.voucherNumber}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: badge?.bg ?? '#F1F5F9', color: badge?.color ?? '#475569' }}
                        >
                          {tx.voucherType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs max-w-xs" style={{ color: '#374151' }}>
                        <div>{tx.narration ?? '—'}</div>
                        {tx.reference && (
                          <div className="mt-0.5" style={{ color: '#94A3B8' }}>Ref: {tx.reference}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: tx.debit > 0 ? '#16A34A' : '#CBD5E1' }}>
                        {tx.debit > 0 ? fmt(tx.debit) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: tx.credit > 0 ? '#DC2626' : '#CBD5E1' }}>
                        {tx.credit > 0 ? fmt(tx.credit) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#1E293B' }}>
                        {fmt(tx.balance)}
                      </td>
                    </tr>
                  )
                })}

                {/* Closing balance row */}
                <tr style={{ background: '#F8FAFC', borderTop: '2px solid #E2E8F0' }}>
                  <td className="px-4 py-3" colSpan={3} />
                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#1E3A5F' }}>Closing Balance</td>
                  <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#16A34A' }}>
                    {fmt(data.totalReceipts)}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#DC2626' }}>
                    {fmt(data.totalPayments)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold" style={{ color: '#1E3A5F' }}>
                    {fmt(data.closingBalance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

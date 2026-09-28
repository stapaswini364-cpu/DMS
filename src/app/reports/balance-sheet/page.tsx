'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type BSLine = { ledgerCode: string; ledgerName: string; amount: string }
type BSSection = { key: string; title: string; lines: BSLine[]; subtotal: string }

type BSData = {
  asAt:                    string
  fyStart:                 string
  sections: {
    assets:              BSSection[]
    equityAndLiabilities: BSSection[]
  }
  netProfit:               string
  isProfitable:            boolean
  totalAssets:             string
  totalLiabilities:        string
  totalEquity:             string
  liabilitiesEquityProfit: string
  balanced:                boolean
}

const fmt = (n: string | number) =>
  `₹ ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function StatutorySection({
  section, open, onToggle, accent,
}: {
  section: BSSection
  open: boolean
  onToggle: () => void
  accent: string
}) {
  return (
    <div className="fp-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3 border-b border-gray-100"
        style={{ background: `${accent}0A` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: accent }}>{open ? '▾' : '▸'}</span>
          <h3 className="text-sm font-semibold" style={{ color: accent }}>{section.title}</h3>
          <span className="text-xs" style={{ color: '#94A3B8' }}>
            ({section.lines.length} {section.lines.length === 1 ? 'ledger' : 'ledgers'})
          </span>
        </div>
        <span className="text-sm font-bold" style={{ color: accent }}>{fmt(section.subtotal)}</span>
      </button>
      {open && (
        <>
          {section.lines.length === 0 ? (
            <p className="px-5 py-3 text-xs" style={{ color: '#94A3B8' }}>No balances.</p>
          ) : (
            <table className="w-full text-sm text-left">
              <tbody>
                {section.lines.map(l => (
                  <tr key={l.ledgerCode} style={{ borderTop: '1px solid #F1F5F9' }}>
                    <td className="px-5 py-2.5 text-xs font-mono w-24" style={{ color: '#94A3B8' }}>{l.ledgerCode}</td>
                    <td className="px-4 py-2.5" style={{ color: '#64748B' }}>{l.ledgerName}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-[#1E293B]">{fmt(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex justify-between px-5 py-2.5" style={{ background: `${accent}08`, borderTop: '1px solid #F1F5F9' }}>
            <span className="text-xs font-semibold" style={{ color: accent }}>Subtotal — {section.title}</span>
            <span className="text-xs font-bold" style={{ color: accent }}>{fmt(section.subtotal)}</span>
          </div>
        </>
      )}
    </div>
  )
}

function SideColumn({
  label, sections, total, totalLabel, accent, openMap, toggle,
}: {
  label: string
  sections: BSSection[]
  total: string
  totalLabel: string
  accent: string
  openMap: Record<string, boolean>
  toggle: (key: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="px-1 py-2">
        <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: accent }}>{label}</h2>
      </div>
      {sections.length === 0 ? (
        <div className="fp-card px-5 py-6 text-sm text-center" style={{ color: '#94A3B8' }}>No balances.</div>
      ) : (
        sections.map(s => (
          <StatutorySection
            key={s.key}
            section={s}
            open={openMap[s.key] ?? true}
            onToggle={() => toggle(s.key)}
            accent={accent}
          />
        ))
      )}
      <div className="fp-card flex items-center justify-between px-5 py-4"
        style={{ background: `${accent}12`, borderTop: `2px solid ${accent}` }}>
        <span className="font-bold text-[#1E293B]">{totalLabel}</span>
        <span className="font-bold font-mono" style={{ color: accent }}>{fmt(total)}</span>
      </div>
    </div>
  )
}

export default function BalanceSheetPage() {
  const [asAt,    setAsAt]    = useState(new Date().toISOString().slice(0, 10))
  const [data,    setData]    = useState<BSData | null>(null)
  const [loading, setLoading] = useState(true)
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/reports/balance-sheet?asAt=${asAt}`)
    const d   = await res.json().catch(() => null)
    setData(d)
    setLoading(false)
  }, [asAt])

  useEffect(() => { load() }, [load])

  const toggle = (key: string) =>
    setOpenMap(prev => ({ ...prev, [key]: !(prev[key] ?? true) }))

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/reports" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Reports</Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">Balance Sheet</h1>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm font-medium" style={{ color: '#64748B' }}>As At</label>
        <input
          type="date"
          value={asAt}
          onChange={e => setAsAt(e.target.value)}
          className="fp-input"
          style={{ width: 'auto' }}
        />
        <span className="text-xs" style={{ color: '#94A3B8' }}>
          {new Date(asAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
        </span>
      </div>

      {loading ? (
        <div className="text-center py-16 text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
      ) : !data ? (
        <div className="text-center py-16 text-sm" style={{ color: '#94A3B8' }}>Failed to load balance sheet.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SideColumn
            label="Equity and Liabilities"
            sections={data.sections.equityAndLiabilities}
            total={data.liabilitiesEquityProfit}
            totalLabel="TOTAL EQUITY + LIABILITIES (incl. FY Profit)"
            accent="#DC2626"
            openMap={openMap}
            toggle={toggle}
          />
          <SideColumn
            label="Assets"
            sections={data.sections.assets}
            total={data.totalAssets}
            totalLabel="TOTAL ASSETS"
            accent="#2563EB"
            openMap={openMap}
            toggle={toggle}
          />

          {/* FY Net Profit line — surfaced under equity side */}
          <div className="fp-card px-5 py-3 flex items-center justify-between lg:col-start-1">
            <span className="text-sm text-[#374151]">
              Net {data.isProfitable ? 'Profit' : 'Loss'} — current FY (from {new Date(data.fyStart).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})
            </span>
            <span className="font-mono text-sm font-semibold" style={{ color: data.isProfitable ? '#16A34A' : '#DC2626' }}>
              {fmt(Math.abs(Number(data.netProfit)))}
            </span>
          </div>

          {/* Balanced check spans both columns */}
          <div className="fp-card overflow-hidden lg:col-span-2">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <h2 className="text-sm font-semibold text-[#1E293B]">Accounting Equation Check</h2>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              <div className="flex justify-between text-sm">
                <span style={{ color: '#64748B' }}>Total Assets</span>
                <span className="font-semibold text-blue-700">{fmt(data.totalAssets)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: '#64748B' }}>Liabilities + Equity + Net Profit</span>
                <span className="font-semibold text-red-700">{fmt(data.liabilitiesEquityProfit)}</span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg border ${data.balanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{data.balanced ? '✅' : '❌'}</span>
                  <span className={`text-sm font-semibold ${data.balanced ? 'text-green-700' : 'text-red-700'}`}>
                    {data.balanced ? 'Balance sheet is balanced' : 'Balance sheet does not balance'}
                  </span>
                </div>
                <span className="text-xs text-gray-400">Assets = Liabilities + Equity + Profit</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

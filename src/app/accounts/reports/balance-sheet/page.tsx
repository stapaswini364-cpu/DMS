'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import LoadingSpinner from '@/app/components/ui/LoadingSpinner'

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
  _warning?:               string
}

const fmt = (n: string | number) =>
  `₹ ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

function StatutorySection({
  section, open, onToggle, accent,
}: {
  section: BSSection
  open: boolean
  onToggle: () => void
  accent: string
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-2.5 border-b border-[#F1F5F9]"
        style={{ background: `${accent}0C` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: accent }}>{open ? '▾' : '▸'}</span>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>{section.title}</span>
          <span className="text-[10px]" style={{ color: '#94A3B8' }}>
            ({section.lines.length})
          </span>
        </div>
        <span className="font-mono text-sm font-semibold" style={{ color: accent }}>{fmt(section.subtotal)}</span>
      </button>
      {open && (
        <>
          {section.lines.length === 0 ? (
            <p className="px-5 py-3 text-xs" style={{ color: '#94A3B8' }}>No balances.</p>
          ) : (
            section.lines.map(l => (
              <div key={l.ledgerCode} className="flex justify-between items-center px-5 py-2.5 border-b border-[#F8FAFC]">
                <div>
                  <span className="text-sm text-[#374151]">{l.ledgerName}</span>
                  <span className="text-xs ml-2 font-mono" style={{ color: '#94A3B8' }}>{l.ledgerCode}</span>
                </div>
                <span className="font-mono text-sm text-[#1E293B]">{fmt(l.amount)}</span>
              </div>
            ))
          )}
          <div className="flex justify-between items-center px-5 py-2" style={{ background: `${accent}08` }}>
            <span className="text-xs font-semibold" style={{ color: accent }}>Subtotal — {section.title}</span>
            <span className="font-mono text-xs font-bold" style={{ color: accent }}>{fmt(section.subtotal)}</span>
          </div>
        </>
      )}
    </div>
  )
}

export default function BalanceSheetPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [asAt,    setAsAt]    = useState(today)
  const [data,    setData]    = useState<BSData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({})

  function load(date: string) {
    setLoading(true)
    setError('')
    fetch(`/api/reports/balance-sheet?asAt=${date}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load report'); setLoading(false) })
  }

  useEffect(() => { load(today) }, [today])

  const toggle = (key: string) =>
    setOpenMap(prev => ({ ...prev, [key]: !(prev[key] ?? true) }))

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/accounts/reports" className="text-xs hover:underline" style={{ color: '#94A3B8' }}>
          ← Reports
        </Link>
        <span style={{ color: '#CBD5E1' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">Balance Sheet</h1>
      </div>

      <div className="fp-card mb-6 flex flex-wrap items-end gap-4" style={{ padding: '16px 20px', borderRadius: '12px' }}>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>As at date</label>
          <input type="date" value={asAt} onChange={e => setAsAt(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-[#E2E8F0] bg-white text-[#1E293B] focus:outline-none focus:border-[#CC1133]" />
        </div>
        <button onClick={() => load(asAt)}
          className="px-5 py-2 text-sm font-semibold text-white rounded-lg" style={{ background: '#CC1133' }}>
          Generate
        </button>
        {data && (
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${data.balanced ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEF2F2] text-[#B91C1C]'}`}>
            {data.balanced ? '✓ Equation balanced' : '✗ IMBALANCE — data integrity warning'}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 text-sm rounded-lg" style={{ background: '#FEF2F2', color: '#B91C1C' }}>{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><LoadingSpinner size={32} /></div>
      ) : data && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Equity and Liabilities (Schedule III convention) */}
          <div className="fp-card overflow-hidden" style={{ borderRadius: '12px' }}>
            <div className="px-5 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC]">
              <p className="text-sm font-semibold text-[#1E293B]">Equity and Liabilities</p>
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                FY Net Profit from {new Date(data.fyStart).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
            {data.sections.equityAndLiabilities.map(s => (
              <StatutorySection
                key={s.key}
                section={s}
                open={openMap[s.key] ?? true}
                onToggle={() => toggle(s.key)}
                accent={s.key === 'shareholders_funds' ? '#7C3AED' : '#DC2626'}
              />
            ))}

            <div className="flex justify-between items-center px-5 py-2.5 border-b border-[#F8FAFC]">
              <span className="text-sm text-[#374151]">Net {data.isProfitable ? 'Profit' : 'Loss'} (current FY)</span>
              <span className="font-mono text-sm" style={{ color: data.isProfitable ? '#16A34A' : '#DC2626' }}>
                {fmt(Math.abs(Number(data.netProfit)))}
              </span>
            </div>

            <div className="flex justify-between items-center px-5 py-4"
              style={{ background: '#FDF4FF', borderTop: '2px solid #E9D5FF' }}>
              <span className="font-bold text-[#1E293B]">TOTAL E + L + PROFIT</span>
              <span className="font-bold font-mono text-[#7C3AED]">{fmt(data.liabilitiesEquityProfit)}</span>
            </div>
          </div>

          {/* Right: Assets */}
          <div className="fp-card overflow-hidden" style={{ borderRadius: '12px' }}>
            <div className="px-5 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC]">
              <p className="text-sm font-semibold text-[#1E293B]">Assets</p>
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                As at {new Date(data.asAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
            {data.sections.assets.map(s => (
              <StatutorySection
                key={s.key}
                section={s}
                open={openMap[s.key] ?? true}
                onToggle={() => toggle(s.key)}
                accent="#2563EB"
              />
            ))}
            <div className="flex justify-between items-center px-5 py-4"
              style={{ background: '#EFF6FF', borderTop: '2px solid #BFDBFE' }}>
              <span className="font-bold text-[#1E293B]">TOTAL ASSETS</span>
              <span className="font-bold font-mono text-[#2563EB]">{fmt(data.totalAssets)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

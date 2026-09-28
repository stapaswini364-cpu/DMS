'use client'

import { useState } from 'react'

type RawRow = {
  frameNumber?: string
  engineNumber?: string
  model?: string
  variant?: string
  color?: string
  location?: string
  purchaseDate?: string
  expectedDeliveryDate?: string
}

type ValidRow = { rowNumber: number; raw: RawRow; resolved: { modelLabel: string; variantLabel: string; colorLabel: string; locationLabel: string; frameNumber: string; engineNumber: string } }
type InvalidRow = { rowNumber: number; raw: RawRow; reason: string }

type ValidationResult = {
  totalCount: number
  validCount: number
  invalidCount: number
  valid: ValidRow[]
  invalid: InvalidRow[]
}

type ImportResult = {
  imported: number
  skipped: InvalidRow[]
  totalCount: number
}

const TEMPLATE_HEADERS = [
  'Frame Number', 'Engine Number', 'Model', 'Variant', 'Color',
  'Location', 'Purchase Date', 'Expected Delivery Date',
]

const TEMPLATE_EXAMPLE = [
  'MD2A1ABY000001', 'ENG000001', 'Activa 6G', 'STD', 'Pearl White',
  'Main Showroom', '2026-01-15', '',
]

function downloadTemplate() {
  const csv = [TEMPLATE_HEADERS, TEMPLATE_EXAMPLE]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'vehicle-inventory-template.csv'; a.click()
  URL.revokeObjectURL(url)
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  let i = 0
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  while (i < src.length) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += ch; i++; continue
    }
    if (ch === '"') { inQuotes = true; i++; continue }
    if (ch === ',') { row.push(field); field = ''; i++; continue }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue }
    field += ch; i++
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

const HEADER_MAP: Record<string, keyof RawRow> = {
  'frame number': 'frameNumber',
  'engine number': 'engineNumber',
  'model': 'model',
  'variant': 'variant',
  'color': 'color',
  'colour': 'color',
  'location': 'location',
  'purchase date': 'purchaseDate',
  'expected delivery date': 'expectedDeliveryDate',
  'expected delivery': 'expectedDeliveryDate',
}

function rowsFromCsv(matrix: string[][]): { rows: RawRow[]; error?: string } {
  if (matrix.length === 0) return { rows: [], error: 'CSV is empty' }
  const header = matrix[0].map(h => h.trim().toLowerCase())
  const mapping = header.map(h => HEADER_MAP[h])
  const requiredHeaders: (keyof RawRow)[] = ['frameNumber', 'engineNumber', 'model', 'variant', 'color', 'location']
  for (const req of requiredHeaders) {
    if (!mapping.includes(req)) {
      return { rows: [], error: `Missing required column: ${req.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()}` }
    }
  }
  const rows: RawRow[] = []
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r]
    const row: RawRow = {}
    mapping.forEach((key, colIdx) => {
      if (!key) return
      const val = (cells[colIdx] ?? '').trim()
      if (val) row[key] = val
    })
    rows.push(row)
  }
  return { rows }
}

type Phase = 'upload' | 'preview' | 'result'

export default function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [phase, setPhase] = useState<Phase>('upload')
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<RawRow[]>([])
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  async function handleFile(file: File) {
    setError('')
    setBusy(true)
    try {
      const text = await file.text()
      const matrix = parseCsv(text)
      const { rows: parsed, error: parseErr } = rowsFromCsv(matrix)
      if (parseErr) {
        setError(parseErr)
        setBusy(false)
        return
      }
      if (parsed.length === 0) {
        setError('CSV has headers but no data rows')
        setBusy(false)
        return
      }
      setFileName(file.name)
      setRows(parsed)

      const res = await fetch('/api/inventory/import-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body?.error ?? 'Validation failed')
        setBusy(false)
        return
      }
      setValidation(body as ValidationResult)
      setPhase('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read file')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/inventory/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body?.error ?? 'Import failed')
        setBusy(false)
        return
      }
      setResult(body as ImportResult)
      setPhase('result')
      if ((body as ImportResult).imported > 0) onImported()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setPhase('upload')
    setFileName('')
    setError('')
    setRows([])
    setValidation(null)
    setResult(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
      <div className="fp-card w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-xl">
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: '#E2E8F0' }}>
          <h2 className="text-base font-semibold text-[#1E293B]">Import Vehicles from CSV</h2>
          <button onClick={onClose} className="text-sm font-medium" style={{ color: '#64748B' }}>✕</button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 px-3 py-2 text-xs rounded-lg bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C]">{error}</div>
          )}

          {phase === 'upload' && (
            <div className="space-y-4">
              <div className="text-sm" style={{ color: '#475569' }}>
                Upload a CSV to bulk-add vehicles. Every imported vehicle will be created with status <strong>Available</strong>.
              </div>
              <div>
                <button
                  onClick={downloadTemplate}
                  className="text-sm font-medium underline"
                  style={{ color: '#2563EB' }}
                >
                  Download template
                </button>
                <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                  Includes the exact column headers and one example row.
                </p>
              </div>
              <div className="border border-dashed rounded-lg p-6 text-center" style={{ borderColor: '#CBD5E1' }}>
                <label className="fp-btn-primary text-sm cursor-pointer inline-block">
                  {busy ? 'Validating…' : 'Choose CSV file'}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    disabled={busy}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                  />
                </label>
                <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>
                  Model, Variant, Color and Location must already exist in Master Data.
                </p>
              </div>
            </div>
          )}

          {phase === 'preview' && validation && (
            <div className="space-y-4">
              <div className="text-xs" style={{ color: '#94A3B8' }}>{fileName}</div>
              <div className="grid grid-cols-3 gap-3">
                <div className="fp-card px-4 py-3 flex flex-col gap-0.5">
                  <span className="text-xs" style={{ color: '#94A3B8' }}>Total rows</span>
                  <span className="text-xl font-bold text-[#1E293B]">{validation.totalCount}</span>
                </div>
                <div className="fp-card px-4 py-3 flex flex-col gap-0.5">
                  <span className="text-xs" style={{ color: '#94A3B8' }}>Valid</span>
                  <span className="text-xl font-bold" style={{ color: '#16A34A' }}>{validation.validCount}</span>
                </div>
                <div className="fp-card px-4 py-3 flex flex-col gap-0.5">
                  <span className="text-xs" style={{ color: '#94A3B8' }}>Invalid</span>
                  <span className="text-xl font-bold" style={{ color: '#DC2626' }}>{validation.invalidCount}</span>
                </div>
              </div>

              {validation.invalid.length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-2 text-[#1E293B]">Invalid rows (will be skipped)</div>
                  <div className="border rounded-lg max-h-56 overflow-y-auto" style={{ borderColor: '#E2E8F0' }}>
                    <table className="w-full text-xs">
                      <tbody>
                        {validation.invalid.map(r => (
                          <tr key={r.rowNumber} className="border-b last:border-b-0" style={{ borderColor: '#F1F5F9' }}>
                            <td className="px-3 py-2 font-medium" style={{ color: '#DC2626', width: 90 }}>Row {r.rowNumber}</td>
                            <td className="px-3 py-2" style={{ color: '#374151' }}>{r.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {validation.valid.length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-2 text-[#1E293B]">Ready to import ({validation.valid.length})</div>
                  <div className="border rounded-lg max-h-40 overflow-y-auto" style={{ borderColor: '#E2E8F0' }}>
                    <table className="w-full text-xs">
                      <tbody>
                        {validation.valid.slice(0, 50).map(r => (
                          <tr key={r.rowNumber} className="border-b last:border-b-0" style={{ borderColor: '#F1F5F9' }}>
                            <td className="px-3 py-1.5 font-mono" style={{ color: '#1E3A5F', width: 140 }}>{r.resolved.frameNumber}</td>
                            <td className="px-3 py-1.5" style={{ color: '#374151' }}>{r.resolved.modelLabel} — {r.resolved.variantLabel}</td>
                            <td className="px-3 py-1.5" style={{ color: '#64748B' }}>{r.resolved.colorLabel}</td>
                            <td className="px-3 py-1.5" style={{ color: '#64748B' }}>{r.resolved.locationLabel}</td>
                          </tr>
                        ))}
                        {validation.valid.length > 50 && (
                          <tr><td colSpan={4} className="px-3 py-1.5 text-center" style={{ color: '#94A3B8' }}>…and {validation.valid.length - 50} more</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {phase === 'result' && result && (
            <div className="space-y-4">
              <div className="px-4 py-3 rounded-lg" style={{ background: '#DCFCE7', color: '#166534' }}>
                <div className="text-sm font-semibold">
                  Imported {result.imported} of {result.totalCount} vehicle{result.totalCount !== 1 ? 's' : ''}
                </div>
                {result.skipped.length > 0 && (
                  <div className="text-xs mt-1">{result.skipped.length} row{result.skipped.length !== 1 ? 's' : ''} skipped — see below.</div>
                )}
              </div>

              {result.skipped.length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-2 text-[#1E293B]">Skipped rows</div>
                  <div className="border rounded-lg max-h-72 overflow-y-auto" style={{ borderColor: '#E2E8F0' }}>
                    <table className="w-full text-xs">
                      <tbody>
                        {result.skipped.map(r => (
                          <tr key={r.rowNumber} className="border-b last:border-b-0" style={{ borderColor: '#F1F5F9' }}>
                            <td className="px-3 py-2 font-medium" style={{ color: '#DC2626', width: 90 }}>Row {r.rowNumber}</td>
                            <td className="px-3 py-2" style={{ color: '#374151' }}>{r.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t flex justify-end gap-2" style={{ borderColor: '#E2E8F0' }}>
          {phase === 'upload' && (
            <button onClick={onClose} className="fp-btn-secondary text-sm">Cancel</button>
          )}
          {phase === 'preview' && (
            <>
              <button onClick={reset} disabled={busy} className="fp-btn-secondary text-sm disabled:opacity-50">
                Choose different file
              </button>
              <button
                onClick={handleConfirm}
                disabled={busy || !validation || validation.validCount === 0}
                className="fp-btn-primary text-sm disabled:opacity-50"
              >
                {busy
                  ? 'Importing…'
                  : validation && validation.validCount === 0
                    ? 'No valid rows to import'
                    : `Confirm Import (${validation?.validCount})`}
              </button>
            </>
          )}
          {phase === 'result' && (
            <button onClick={onClose} className="fp-btn-primary text-sm">Done</button>
          )}
        </div>
      </div>
    </div>
  )
}

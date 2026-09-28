'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type Location = { id: string; name: string }

type Ledger = {
  id: string
  ledgerCode: string
  ledgerName: string
  accountTypeName: string
  accountTypeCode: string
  groupName: string
}

type FlatLedger = Ledger & {
  subGroupName:  string
  majorHeadName: string
  groupCode:     string
  isActive:      boolean
  allowManualEntry: boolean
}

type ReceiptsAgainst = 'Sale' | 'Service' | 'Advance' | 'Debtors' | 'Other'

type ExtraRow = {
  rowId:    string
  ledgerId: string
  side:     'Dr' | 'Cr'
  amount:   string
}

type PaymentAgainst = 'Creditor' | 'Other'

type DrRow = {
  rowId:    string
  ledgerId: string
  amount:   string
}

const CASHBOOK_TYPES = ['RECEIPT', 'PAYMENT', 'CONTRA'] as const
const VOUCHER_TYPES  = [...CASHBOOK_TYPES, 'JOURNAL'] as const
type VoucherType = typeof VOUCHER_TYPES[number]

const PAYMENT_AGAINST_OPTIONS: PaymentAgainst[] = ['Creditor', 'Other']

const TYPE_LABELS: Record<VoucherType, string> = {
  RECEIPT: 'Receipt Voucher',
  PAYMENT: 'Payment Voucher',
  CONTRA:  'Contra Voucher',
  JOURNAL: 'Journal Voucher',
}

const TYPE_HINT: Record<VoucherType, string> = {
  RECEIPT: 'Record cash/bank received — debit your cash/bank ledger, credit the source.',
  PAYMENT: 'Record cash/bank paid out — debit the expense/payable, credit your cash/bank ledger.',
  CONTRA:  'Transfer between cash and bank — debit destination, credit source.',
  JOURNAL: 'General ledger adjustment — multi-row Dr and Cr, total debits must equal total credits.',
}


const RECEIPTS_AGAINST: ReceiptsAgainst[] = ['Sale', 'Service', 'Advance', 'Debtors', 'Other']

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputCls = [
  'w-full px-3 py-2.5 text-sm rounded-lg',
  'border border-[#E2E8F0] bg-white text-[#1E293B]',
  'placeholder:text-[#94A3B8]',
  'focus:outline-none focus:border-[#CC1133]',
  'transition-colors',
].join(' ')
const selectCls = inputCls

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>
        {label}{required && <span className="text-[#DC2626] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Ledger select (groups by accountTypeName) ────────────────────────────────

function LedgerSelect({
  label, value, onChange, ledgers, placeholder, required, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void
  ledgers: Array<{ id: string; ledgerCode: string; ledgerName: string; accountTypeName: string }>
  placeholder?: string; required?: boolean; disabled?: boolean
}) {
  const groups = ledgers.reduce<Record<string, typeof ledgers>>((acc, l) => {
    const key = l.accountTypeName
    if (!acc[key]) acc[key] = []
    acc[key].push(l)
    return acc
  }, {})

  return (
    <Field label={label} required={required}>
      <select value={value} onChange={e => onChange(e.target.value)} className={selectCls} disabled={disabled}>
        <option value="">{placeholder ?? '— Select ledger —'}</option>
        {Object.entries(groups).map(([typeName, items]) => (
          <optgroup key={typeName} label={typeName}>
            {items.map(l => (
              <option key={l.id} value={l.id}>
                {l.ledgerName} ({l.ledgerCode})
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </Field>
  )
}

// ─── Payment Voucher Form ─────────────────────────────────────────────────────

function PaymentVoucherForm({
  date,
  locations,
  onSuccess,
}: {
  date: string
  locations: Location[]
  onSuccess: () => void
}) {
  const [paymentAgainst, setPaymentAgainst] = useState<PaymentAgainst>('Creditor')
  const [crLedgerId,     setCrLedgerId]     = useState('')
  const [crAmount,       setCrAmount]       = useState('')
  const [drRows,         setDrRows]         = useState<DrRow[]>([
    { rowId: crypto.randomUUID(), ledgerId: '', amount: '' },
  ])
  const [narration,  setNarration]  = useState('')
  const [locationId, setLocationId] = useState('')
  const [flatLedgers, setFlatLedgers] = useState<FlatLedger[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    fetch('/api/master/chart-of-accounts/flat')
      .then(r => r.json())
      .then((d: unknown) => { if (Array.isArray(d)) setFlatLedgers(d as FlatLedger[]) })
      .catch(() => {})
  }, [])

  // Cash / Bank (Cr) — ledgers in the Cash & Bank group (A-CA-CB)
  const cashBankLedgers = flatLedgers.filter(l => l.groupCode === 'A-CA-CB' && l.isActive)

  // Dr (Paid To / Expense) — filtered by Payment Against
  const drLedgers = paymentAgainst === 'Creditor'
    ? flatLedgers.filter(l => l.groupCode === 'L-CL-TP' && l.isActive && l.allowManualEntry)
    : flatLedgers.filter(l => l.isActive && l.allowManualEntry)

  // Reset Dr row selections when Payment Against changes
  useEffect(() => {
    setDrRows([{ rowId: crypto.randomUUID(), ledgerId: '', amount: '' }])
  }, [paymentAgainst])

  const totalDr   = drRows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const crAmt     = Number(crAmount) || 0
  const diff      = Math.abs(totalDr - crAmt)
  const isBalanced = diff < 0.01 && totalDr > 0

  const fmt = (n: number) => `₹ ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

  function addRow() {
    setDrRows(prev => [...prev, { rowId: crypto.randomUUID(), ledgerId: '', amount: '' }])
  }

  function removeRow(rowId: string) {
    if (drRows.length === 1) return
    setDrRows(prev => prev.filter(r => r.rowId !== rowId))
  }

  function updateRow(rowId: string, field: 'ledgerId' | 'amount', value: string) {
    setDrRows(prev => prev.map(r => r.rowId === rowId ? { ...r, [field]: value } : r))
  }

  async function handleSubmit() {
    setError('')
    if (!crLedgerId) { setError('Cash / Bank Account (Cr) is required'); return }
    if (!crAmount || crAmt <= 0) { setError('Credit amount must be > 0'); return }

    for (let i = 0; i < drRows.length; i++) {
      const r = drRows[i]
      if (!r.ledgerId) { setError(`Row ${i + 1}: select a ledger`); return }
      if (!r.amount || Number(r.amount) <= 0) { setError(`Row ${i + 1}: amount must be > 0`); return }
    }

    if (!isBalanced) {
      setError(`Entry is not balanced — Dr ${fmt(totalDr)} ≠ Cr ${fmt(crAmt)}`)
      return
    }

    setSubmitting(true)
    const res = await fetch('/api/accounts/cashbook-vouchers', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voucherType:    'PAYMENT',
        date:           new Date(date).toISOString(),
        creditLedgerId: crLedgerId,
        creditAmount:   crAmt,
        paymentLines:   drRows.map(r => ({ ledgerId: r.ledgerId, amount: Number(r.amount) })),
        narration:      narration.trim() || undefined,
        locationId:     locationId       || undefined,
      }),
    })
    setSubmitting(false)

    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setError((b as { error?: string }).error ?? 'Failed to save voucher')
      return
    }

    onSuccess()
  }

  const crLedgerName = cashBankLedgers.find(l => l.id === crLedgerId)?.ledgerName

  return (
    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px' }}>
      <div className="flex flex-col gap-4">

        {/* Payment Against */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Payment Against *">
            <select
              value={paymentAgainst}
              onChange={e => setPaymentAgainst(e.target.value as PaymentAgainst)}
              className={selectCls}
            >
              {PAYMENT_AGAINST_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          {/* Cash / Bank Account (Cr) — voucher-level, single field */}
          <LedgerSelect
            label="Cash / Bank Account (Cr) *"
            value={crLedgerId}
            onChange={v => { setCrLedgerId(v); setCrAmount('') }}
            ledgers={cashBankLedgers.length > 0 ? cashBankLedgers : flatLedgers.filter(l => l.isActive && l.allowManualEntry)}
            placeholder="— Select cash/bank ledger —"
            required
          />
        </div>

        {/* Ledger entries — Dr rows */}
        <div>
          <div className="text-xs font-semibold mb-3 flex items-center gap-2" style={{ color: '#374151' }}>
            <span style={{ width: 2, height: 14, background: '#CC1133', display: 'inline-block', borderRadius: 1 }} />
            Ledger Entries
            {paymentAgainst === 'Creditor' && (
              <span className="text-xs font-normal px-2 py-0.5 rounded-full ml-1" style={{ background: '#FEF3C7', color: '#92400E' }}>
                Filtered to Trade Payables
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {drRows.map((row, idx) => (
              <div
                key={row.rowId}
                className="grid gap-3 items-end"
                style={{ gridTemplateColumns: '1fr 160px auto' }}
              >
                <LedgerSelect
                  label={`Paid To / Expense (Dr) — Row ${idx + 1} *`}
                  value={row.ledgerId}
                  onChange={v => updateRow(row.rowId, 'ledgerId', v)}
                  ledgers={drLedgers}
                  placeholder={paymentAgainst === 'Creditor' ? '— Select creditor —' : '— Select ledger —'}
                  required
                />
                <Field label="Amount *">
                  <input
                    type="number" min="0" step="0.01"
                    value={row.amount}
                    onChange={e => updateRow(row.rowId, 'amount', e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </Field>
                <div style={{ paddingBottom: '1px' }}>
                  <button
                    type="button"
                    onClick={() => removeRow(row.rowId)}
                    disabled={drRows.length === 1}
                    className="w-full px-2 py-2.5 text-xs rounded-lg transition-colors disabled:opacity-30"
                    style={{ border: '1px solid #FECACA', color: '#DC2626', background: 'white' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addRow}
              className="self-start text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
              style={{ border: '1.5px dashed #CBD5E1', color: '#475569', background: 'white' }}
            >
              + Add More Ledger
            </button>
          </div>
        </div>

        {/* Credit Amount */}
        <Field label="Total Amount to Pay (Cr) *">
          <input
            type="number" min="0" step="0.01"
            value={crAmount}
            onChange={e => setCrAmount(e.target.value)}
            placeholder="0.00"
            className={inputCls}
          />
        </Field>

        {/* Totals bar */}
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
          <div className="grid grid-cols-3 text-center text-xs">
            <div className="px-4 py-3" style={{ borderRight: '1px solid #E2E8F0' }}>
              <div className="font-medium mb-0.5" style={{ color: '#94A3B8' }}>Total Debit</div>
              <div className="font-bold" style={{ color: '#1D4ED8' }}>{fmt(totalDr)}</div>
            </div>
            <div className="px-4 py-3" style={{ borderRight: '1px solid #E2E8F0' }}>
              <div className="font-medium mb-0.5" style={{ color: '#94A3B8' }}>Total Credit</div>
              <div className="font-bold" style={{ color: '#B91C1C' }}>{fmt(crAmt)}</div>
            </div>
            <div className="px-4 py-3" style={{ background: isBalanced ? '#F0FDF4' : '#FEF2F2' }}>
              <div className="font-medium mb-0.5" style={{ color: '#94A3B8' }}>
                {isBalanced ? 'Status' : 'Difference'}
              </div>
              <div className="font-bold" style={{ color: isBalanced ? '#15803D' : '#DC2626' }}>
                {isBalanced ? '✓ Balanced' : fmt(diff)}
              </div>
            </div>
          </div>
        </div>

        {/* Journal entry preview */}
        {isBalanced && crLedgerName && (
          <div className="rounded-lg px-4 py-3 text-xs" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <p className="font-semibold mb-2" style={{ color: '#64748B' }}>Journal entry preview</p>
            <div className="font-mono space-y-1">
              {drRows.map(r => {
                const name = drLedgers.find(l => l.id === r.ledgerId)?.ledgerName ?? '—'
                return (
                  <div key={r.rowId} className="flex justify-between">
                    <span style={{ color: '#1D4ED8' }}>Dr&nbsp;&nbsp;{name}</span>
                    <span style={{ color: '#1D4ED8' }}>
                      ₹ {Number(r.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )
              })}
              <div className="flex justify-between pl-6">
                <span style={{ color: '#B91C1C' }}>Cr&nbsp;&nbsp;{crLedgerName}</span>
                <span style={{ color: '#B91C1C' }}>{fmt(crAmt)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Narration + Location */}
        <Field label="Narration">
          <input
            value={narration}
            onChange={e => setNarration(e.target.value)}
            placeholder="Brief description of the payment"
            className={inputCls}
          />
        </Field>
        <Field label="Location / Branch">
          <select value={locationId} onChange={e => setLocationId(e.target.value)} className={selectCls}>
            <option value="">All locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
      </div>

      {error && (
        <div className="mt-4 px-4 py-3 text-sm rounded-lg"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <Link
          href="/accounts"
          className="px-5 py-2.5 text-sm font-medium rounded-lg transition-colors"
          style={{ border: '1.5px solid #E2E8F0', color: '#374151', background: 'white' }}
        >
          Cancel
        </Link>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ background: '#CC1133' }}
        >
          {submitting ? 'Saving…' : 'Save Payment Voucher'}
        </button>
      </div>
    </div>
  )
}

// ─── Receipt Voucher Form ─────────────────────────────────────────────────────

function ReceiptVoucherForm({
  date,
  locations,
  onSuccess,
}: {
  date: string
  locations: Location[]
  onSuccess: () => void
}) {
  const [receiptsAgainst, setReceiptsAgainst] = useState<ReceiptsAgainst>('Sale')
  const [reference,       setReference]       = useState('')
  const [mrnNumber,       setMrnNumber]       = useState('')
  const [drLedgerId,      setDrLedgerId]      = useState('')
  const [drAmount,        setDrAmount]        = useState('')
  const [crLedgerId,      setCrLedgerId]      = useState('')
  const [crAmount,        setCrAmount]        = useState('')
  const [extraRows,       setExtraRows]       = useState<ExtraRow[]>([])
  const [narration,       setNarration]       = useState('')
  const [locationId,      setLocationId]      = useState('')
  const [flatLedgers,     setFlatLedgers]     = useState<FlatLedger[]>([])
  const [submitting,      setSubmitting]      = useState(false)
  const [error,           setError]           = useState('')
  const [lookupStatus,    setLookupStatus]    = useState<'idle' | 'loading' | 'found' | 'not-found'>('idle')
  const [foundCustomer,   setFoundCustomer]   = useState('')

  // Linked booking (set by frame/job card lookup OR manual search)
  const [linkedBookingId,    setLinkedBookingId]    = useState<string | null>(null)
  const [linkedBookingType,  setLinkedBookingType]  = useState<'sale' | 'service' | null>(null)
  const [linkedBookingLabel, setLinkedBookingLabel] = useState('')
  const [bookingQuery,       setBookingQuery]       = useState('')
  const [bookingResults,     setBookingResults]     = useState<{
    id: string; bookingNumber: string; status: string
    customerName: string | null; customerPhone: string | null
    bookingType: 'sale' | 'service'
  }[]>([])
  const [bookingSearching,   setBookingSearching]   = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Advance mode: customer + payment mode for MRN receipt creation
  const [allCustomers,       setAllCustomers]       = useState<{ id: string; name: string; phone: string }[]>([])
  const [advanceCustId,      setAdvanceCustId]      = useState('')
  const [advanceCustLabel,   setAdvanceCustLabel]   = useState('')
  const [advanceCustQuery,   setAdvanceCustQuery]   = useState('')
  const [advanceCustResults, setAdvanceCustResults] = useState<{ id: string; name: string; phone: string }[]>([])
  const [advancePayMode,     setAdvancePayMode]     = useState('CASH')
  const advCustTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/master/chart-of-accounts/flat')
      .then(r => r.json())
      .then((d: unknown) => {
        if (Array.isArray(d)) setFlatLedgers(d as FlatLedger[])
      })
      .catch(() => {})
  }, [])

  // Filtered ledger sets
  const cashEquivLedgers = flatLedgers.filter(l => {
    const sg = l.subGroupName.toLowerCase()
    return sg.includes('cash') || sg.includes('bank')
  })
  const tradeRecLedgers = flatLedgers.filter(l => {
    const sg = l.subGroupName.toLowerCase()
    return sg.includes('trade receivable') || sg.includes('accounts receivable')
  })
  const advanceLedgers = flatLedgers.filter(l =>
    l.subGroupName.toLowerCase().includes('other current liabilit') ||
    l.ledgerName.toLowerCase().includes('advance from customer')
  )
  const allLedgers = flatLedgers.filter(l => l.allowManualEntry && l.isActive)

  const crLedgers: FlatLedger[] =
    receiptsAgainst === 'Advance'  ? advanceLedgers :
    receiptsAgainst === 'Other'    ? allLedgers :
    tradeRecLedgers  // Sale / Service / Debtors

  // When Receipts Against changes, reset credit ledger, lookup state, and linked booking
  useEffect(() => {
    setCrLedgerId('')
    setLookupStatus('idle')
    setFoundCustomer('')
    setLinkedBookingId(null)
    setLinkedBookingType(null)
    setLinkedBookingLabel('')
    setBookingQuery('')
    setBookingResults([])
    setAdvanceCustId('')
    setAdvanceCustLabel('')
    setAdvanceCustQuery('')
    setAdvanceCustResults([])
    setAdvancePayMode('CASH')
    // Auto-select first advance ledger when switching to Advance
    if (receiptsAgainst === 'Advance' && advanceLedgers.length === 1) {
      setCrLedgerId(advanceLedgers[0].id)
    }
    // Lazy-load customers when switching to Advance mode
    if (receiptsAgainst === 'Advance' && allCustomers.length === 0) {
      fetch('/api/customers')
        .then(r => r.json())
        .then((d: unknown) => {
          if (Array.isArray(d)) {
            setAllCustomers((d as { id: string; name?: string; phone?: string }[]).map(c => ({
              id:    c.id,
              name:  c.name  ?? '',
              phone: c.phone ?? '',
            })))
          }
        })
        .catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptsAgainst])

  // Reference field placeholder
  const refPlaceholder =
    receiptsAgainst === 'Sale'    ? 'Enter Frame No.' :
    receiptsAgainst === 'Service' ? 'Enter Job Card No.' :
    'Optional'

  const refLabel =
    receiptsAgainst === 'Sale'    ? 'Frame No.' :
    receiptsAgainst === 'Service' ? 'Job Card No.' :
    'Reference'

  // Lookup customer when frame/job card entered
  async function onReferenceLookup() {
    const val = reference.trim().toUpperCase()
    if (!val || (receiptsAgainst !== 'Sale' && receiptsAgainst !== 'Service')) return

    setLookupStatus('loading')
    try {
      const endpoint = receiptsAgainst === 'Sale'
        ? `/api/bookings/frame/${encodeURIComponent(val)}`
        : `/api/services/jobcard/${encodeURIComponent(val)}`

      const res = await fetch(endpoint)
      if (!res.ok) { setLookupStatus('not-found'); return }

      const data = await res.json() as { id?: string; customer?: { name?: string } }
      const name = data.customer?.name ?? ''
      setFoundCustomer(name)
      setLookupStatus('found')

      // Capture booking id for booking amount update on submit
      if (data.id) {
        setLinkedBookingId(data.id)
        setLinkedBookingType(receiptsAgainst === 'Sale' ? 'sale' : 'service')
        setLinkedBookingLabel(`${val}${name ? ` · ${name}` : ''}`)
      }
      // auto-select credit ledger happens in the effect below
    } catch {
      setLookupStatus('not-found')
    }
  }

  function handleBookingQueryChange(val: string) {
    setBookingQuery(val)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (val.trim().length < 2) { setBookingResults([]); return }
    searchTimerRef.current = setTimeout(async () => {
      setBookingSearching(true)
      try {
        const res = await fetch(`/api/bookings/search?q=${encodeURIComponent(val.trim())}`)
        if (res.ok) setBookingResults(await res.json())
        else setBookingResults([])
      } catch {
        setBookingResults([])
      } finally {
        setBookingSearching(false)
      }
    }, 300)
  }

  function selectBookingResult(r: { id: string; bookingNumber: string; customerName: string | null; customerPhone: string | null; bookingType: 'sale' | 'service' }) {
    setLinkedBookingId(r.id)
    setLinkedBookingType(r.bookingType)
    setLinkedBookingLabel(`${r.bookingNumber}${r.customerName ? ` · ${r.customerName}` : ''}`)
    setBookingQuery('')
    setBookingResults([])
  }

  function clearLinkedBooking() {
    setLinkedBookingId(null)
    setLinkedBookingType(null)
    setLinkedBookingLabel('')
    setBookingQuery('')
    setBookingResults([])
  }

  function handleAdvanceCustQuery(val: string) {
    setAdvanceCustQuery(val)
    setAdvanceCustId('')
    setAdvanceCustLabel('')
    if (advCustTimerRef.current) clearTimeout(advCustTimerRef.current)
    if (val.trim().length < 2) { setAdvanceCustResults([]); return }
    advCustTimerRef.current = setTimeout(() => {
      const q = val.trim().toLowerCase()
      setAdvanceCustResults(
        allCustomers
          .filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q))
          .slice(0, 8)
      )
    }, 200)
  }

  function selectAdvanceCustomer(c: { id: string; name: string; phone: string }) {
    setAdvanceCustId(c.id)
    setAdvanceCustLabel(`${c.name}${c.phone ? ` · ${c.phone}` : ''}`)
    setAdvanceCustQuery('')
    setAdvanceCustResults([])
  }

  function clearAdvanceCustomer() {
    setAdvanceCustId('')
    setAdvanceCustLabel('')
    setAdvanceCustQuery('')
    setAdvanceCustResults([])
  }

  // Auto-select credit ledger once both the lookup has succeeded AND flatLedgers are loaded.
  // Using an effect instead of inline code in onReferenceLookup handles the race where
  // the COA fetch completes after the user's blur event fires.
  useEffect(() => {
    if (lookupStatus !== 'found' || flatLedgers.length === 0 || crLedgerId) return
    const trl = flatLedgers.filter(l => {
      const sg = l.subGroupName.toLowerCase()
      return sg.includes('trade receivable') || sg.includes('accounts receivable')
    })
    if (trl.length === 0) return
    const match =
      trl.find(l => l.ledgerName.toLowerCase().includes(foundCustomer.toLowerCase())) ?? trl[0]
    setCrLedgerId(match.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookupStatus, flatLedgers, foundCustomer])

  // Totals
  const totalDr =
    (Number(drAmount) || 0) +
    extraRows.filter(r => r.side === 'Dr').reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const totalCr =
    (Number(crAmount) || 0) +
    extraRows.filter(r => r.side === 'Cr').reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const diff      = Math.abs(totalDr - totalCr)
  const isBalanced = diff < 0.01 && totalDr > 0

  const fmt = (n: number) => `₹ ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

  function addRow() {
    setExtraRows(prev => [...prev, {
      rowId: crypto.randomUUID(),
      ledgerId: '',
      side: 'Cr',
      amount: '',
    }])
  }

  function removeRow(rowId: string) {
    setExtraRows(prev => prev.filter(r => r.rowId !== rowId))
  }

  function updateRow(rowId: string, field: keyof ExtraRow, value: string) {
    setExtraRows(prev => prev.map(r => r.rowId === rowId ? { ...r, [field]: value } : r))
  }

  async function handleSubmit() {
    setError('')

    if (!drLedgerId)        { setError('Cash / Bank Account (Dr) is required'); return }
    if (!drAmount || Number(drAmount) <= 0) { setError('Debit amount must be > 0'); return }
    if (!crLedgerId)        { setError('Received From (Cr) is required'); return }
    if (!crAmount || Number(crAmount) <= 0) { setError('Credit amount must be > 0'); return }

    for (let i = 0; i < extraRows.length; i++) {
      const r = extraRows[i]
      if (!r.ledgerId) { setError(`Row ${i + 1}: select a ledger`); return }
      if (!r.amount || Number(r.amount) <= 0) { setError(`Row ${i + 1}: amount must be > 0`); return }
    }

    if (!isBalanced) {
      setError(`Entry is not balanced — difference: ${fmt(diff)}`)
      return
    }

    if (receiptsAgainst === 'Advance' && mrnNumber.trim() && !advanceCustId) {
      setError('Select a customer to link this advance MRN receipt')
      return
    }

    setSubmitting(true)
    const res = await fetch('/api/accounts/cashbook-vouchers', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voucherType:    'RECEIPT',
        date:           new Date(date).toISOString(),
        debitLedgerId:  drLedgerId,
        debitAmount:    Number(drAmount),
        creditLedgerId: crLedgerId,
        creditAmount:   Number(crAmount),
        additionalLines: extraRows.map(r => ({
          ledgerId:    r.ledgerId,
          debitAmount:  r.side === 'Dr' ? Number(r.amount) : 0,
          creditAmount: r.side === 'Cr' ? Number(r.amount) : 0,
        })),
        narration:   narration.trim() || `Receipt against ${receiptsAgainst}${mrnNumber ? ` · MRN: ${mrnNumber}` : ''}`,
        reference:   reference.trim() || undefined,
        locationId:  locationId || undefined,
        bookingId:          linkedBookingId   || undefined,
        bookingType:        linkedBookingType || undefined,
        mrnNumber:          mrnNumber.trim().toUpperCase() || undefined,
        advanceCustomerId:  receiptsAgainst === 'Advance' ? (advanceCustId || undefined) : undefined,
        advancePaymentMode: receiptsAgainst === 'Advance' ? advancePayMode : undefined,
      }),
    })
    setSubmitting(false)

    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setError((b as { error?: string }).error ?? 'Failed to save voucher')
      return
    }

    onSuccess()
  }

  return (
    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px' }}>
      <div className="flex flex-col gap-4">

        {/* Row 1: Receipts Against + Reference */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Receipts Against *">
            <select value={receiptsAgainst} onChange={e => setReceiptsAgainst(e.target.value as ReceiptsAgainst)} className={selectCls}>
              {RECEIPTS_AGAINST.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label={refLabel}>
            <input
              value={reference}
              onChange={e => {
                setReference(e.target.value)
                setLookupStatus('idle')
                setLinkedBookingId(null)
                setLinkedBookingType(null)
                setLinkedBookingLabel('')
              }}
              onBlur={onReferenceLookup}
              placeholder={refPlaceholder}
              className={inputCls}
            />
          </Field>
        </div>

        {/* Lookup status banner */}
        {lookupStatus === 'loading' && (
          <div className="text-xs px-3 py-2 rounded-lg" style={{ background: '#F1F5F9', color: '#64748B' }}>
            Looking up customer…
          </div>
        )}
        {lookupStatus === 'found' && foundCustomer && (
          <div className="text-xs px-3 py-2 rounded-lg" style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #86EFAC' }}>
            Customer found: <strong>{foundCustomer}</strong> — credit ledger auto-selected
          </div>
        )}
        {lookupStatus === 'not-found' && (
          <div className="text-xs px-3 py-2 rounded-lg" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
            No booking found for this {receiptsAgainst === 'Sale' ? 'frame number' : 'job card'} — select ledger manually
          </div>
        )}

        {/* Manual booking link — available for all types except Advance */}
        {receiptsAgainst !== 'Advance' && (
          <Field label="Link to Booking (optional)">
            {linkedBookingId ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#F0FDF4', border: '1px solid #86EFAC' }}>
                <span className="text-xs font-mono font-medium" style={{ color: '#15803D' }}>{linkedBookingLabel}</span>
                <button
                  type="button"
                  onClick={clearLinkedBooking}
                  className="ml-auto text-xs px-2 py-0.5 rounded"
                  style={{ color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA' }}
                >
                  Unlink
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={bookingQuery}
                  onChange={e => handleBookingQueryChange(e.target.value)}
                  placeholder="Search by booking no., customer name, or phone…"
                  className={inputCls}
                />
                {bookingSearching && (
                  <span className="absolute right-3 top-2.5 text-xs" style={{ color: '#94A3B8' }}>…</span>
                )}
                {bookingResults.length > 0 && (
                  <div
                    className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg overflow-hidden"
                    style={{ border: '1px solid #E2E8F0' }}
                  >
                    {bookingResults.map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => selectBookingResult(r)}
                        className="w-full px-3 py-2.5 text-left text-xs hover:bg-gray-50 flex items-center gap-3"
                        style={{ borderBottom: '1px solid #F1F5F9' }}
                      >
                        <span className="font-mono font-semibold" style={{ color: '#CC1133' }}>{r.bookingNumber}</span>
                        <span className="flex-1" style={{ color: '#374151' }}>{r.customerName ?? ''}</span>
                        <span style={{ color: '#94A3B8' }}>{r.customerPhone ?? ''}</span>
                        <span className="px-1.5 py-0.5 rounded" style={{ background: '#F1F5F9', color: '#64748B' }}>{r.status}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Field>
        )}

        {/* Row 2: MRN No. */}
        <Field label="MRN No.">
          <input
            value={mrnNumber}
            onChange={e => setMrnNumber(e.target.value)}
            placeholder="Enter MRN No."
            className={inputCls}
          />
        </Field>

        {/* Advance mode: customer + payment mode (required when MRN is set) */}
        {receiptsAgainst === 'Advance' && mrnNumber.trim() && (
          <div className="grid grid-cols-2 gap-4 px-4 py-4 rounded-xl" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <Field label="Customer *">
              {advanceCustId ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#F0FDF4', border: '1px solid #86EFAC' }}>
                  <span className="flex-1 font-medium" style={{ color: '#15803D' }}>{advanceCustLabel}</span>
                  <button type="button" onClick={clearAdvanceCustomer} className="text-xs px-2 py-0.5 rounded" style={{ color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA' }}>
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    value={advanceCustQuery}
                    onChange={e => handleAdvanceCustQuery(e.target.value)}
                    placeholder="Search by name or phone…"
                    className={inputCls}
                  />
                  {advanceCustResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                      {advanceCustResults.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectAdvanceCustomer(c)}
                          className="w-full px-3 py-2.5 text-left text-xs hover:bg-gray-50 flex items-center gap-3"
                          style={{ borderBottom: '1px solid #F1F5F9' }}
                        >
                          <span className="font-semibold" style={{ color: '#1E293B' }}>{c.name}</span>
                          <span style={{ color: '#94A3B8' }}>{c.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Field>
            <Field label="Payment Mode *">
              <select value={advancePayMode} onChange={e => setAdvancePayMode(e.target.value)} className={selectCls}>
                {['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'NEFT', 'RTGS', 'DD'].map(m => (
                  <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {/* Ledger rows section */}
        <div>
          <div className="text-xs font-semibold mb-3 flex items-center gap-2" style={{ color: '#374151' }}>
            <span style={{ width: 2, height: 14, background: '#CC1133', display: 'inline-block', borderRadius: 1 }} />
            Ledger Accounts
          </div>

          <div className="flex flex-col gap-3">
            {/* Main Dr row */}
            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 160px' }}>
              <LedgerSelect
                label="Cash / Bank Account (Dr) *"
                value={drLedgerId}
                onChange={setDrLedgerId}
                ledgers={cashEquivLedgers.length > 0 ? cashEquivLedgers : allLedgers}
                placeholder="— Select cash/bank ledger —"
                required
              />
              <Field label="Amount (Dr) *">
                <input
                  type="number" min="0" step="0.01"
                  value={drAmount}
                  onChange={e => setDrAmount(e.target.value)}
                  placeholder="0.00"
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Main Cr row */}
            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 160px' }}>
              <LedgerSelect
                label="Received From (Cr) *"
                value={crLedgerId}
                onChange={setCrLedgerId}
                ledgers={crLedgers.length > 0 ? crLedgers : allLedgers}
                placeholder="— Select ledger —"
                required
              />
              <Field label="Amount (Cr) *">
                <input
                  type="number" min="0" step="0.01"
                  value={crAmount}
                  onChange={e => setCrAmount(e.target.value)}
                  placeholder="0.00"
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Extra rows */}
            {extraRows.map((row, idx) => (
              <div key={row.rowId} className="grid gap-2 items-end" style={{ gridTemplateColumns: '1fr 80px 140px auto' }}>
                <LedgerSelect
                  label={`Ledger ${idx + 3}`}
                  value={row.ledgerId}
                  onChange={v => updateRow(row.rowId, 'ledgerId', v)}
                  ledgers={allLedgers}
                  placeholder="— Select ledger —"
                />
                <Field label="Dr / Cr">
                  <select value={row.side} onChange={e => updateRow(row.rowId, 'side', e.target.value)} className={selectCls}>
                    <option value="Dr">Dr</option>
                    <option value="Cr">Cr</option>
                  </select>
                </Field>
                <Field label="Amount">
                  <input
                    type="number" min="0" step="0.01"
                    value={row.amount}
                    onChange={e => updateRow(row.rowId, 'amount', e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </Field>
                <div className="mb-0.5">
                  <button
                    type="button"
                    onClick={() => removeRow(row.rowId)}
                    className="w-full px-2 py-2.5 text-xs rounded-lg transition-colors"
                    style={{ border: '1px solid #FECACA', color: '#DC2626', background: 'white' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}

            {/* Add row button */}
            <button
              type="button"
              onClick={addRow}
              className="self-start text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
              style={{ border: '1.5px dashed #CBD5E1', color: '#475569', background: 'white' }}
            >
              + Add More Ledger
            </button>
          </div>
        </div>

        {/* Totals bar */}
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
          <div className="grid grid-cols-3 text-center text-xs">
            <div className="px-4 py-3" style={{ borderRight: '1px solid #E2E8F0' }}>
              <div className="font-medium mb-0.5" style={{ color: '#94A3B8' }}>Total Debit</div>
              <div className="font-bold" style={{ color: '#1D4ED8' }}>{fmt(totalDr)}</div>
            </div>
            <div className="px-4 py-3" style={{ borderRight: '1px solid #E2E8F0' }}>
              <div className="font-medium mb-0.5" style={{ color: '#94A3B8' }}>Total Credit</div>
              <div className="font-bold" style={{ color: '#B91C1C' }}>{fmt(totalCr)}</div>
            </div>
            <div className="px-4 py-3" style={{ background: isBalanced ? '#F0FDF4' : '#FEF2F2' }}>
              <div className="font-medium mb-0.5" style={{ color: '#94A3B8' }}>
                {isBalanced ? 'Status' : 'Difference'}
              </div>
              <div className="font-bold" style={{ color: isBalanced ? '#15803D' : '#DC2626' }}>
                {isBalanced ? '✓ Balanced' : fmt(diff)}
              </div>
            </div>
          </div>
        </div>

        {/* Narration + Location */}
        <Field label="Narration">
          <input
            value={narration}
            onChange={e => setNarration(e.target.value)}
            placeholder={`Receipt against ${receiptsAgainst}${mrnNumber ? ` · MRN: ${mrnNumber}` : ''}`}
            className={inputCls}
          />
        </Field>
        <Field label="Location / Branch">
          <select value={locationId} onChange={e => setLocationId(e.target.value)} className={selectCls}>
            <option value="">All locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
      </div>

      {error && (
        <div className="mt-4 px-4 py-3 text-sm rounded-lg"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <Link href="/accounts"
          className="px-5 py-2.5 text-sm font-medium rounded-lg transition-colors"
          style={{ border: '1.5px solid #E2E8F0', color: '#374151', background: 'white' }}>
          Cancel
        </Link>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ background: '#CC1133', borderRadius: '8px' }}>
          {submitting ? 'Saving…' : 'Save Receipt Voucher'}
        </button>
      </div>
    </div>
  )
}

// ─── Contra Voucher Form ──────────────────────────────────────────────────────

function ContraVoucherForm({
  date,
  locations,
  onSuccess,
}: {
  date: string
  locations: Location[]
  onSuccess: () => void
}) {
  const [drLedgerId,  setDrLedgerId]  = useState('')
  const [crLedgerId,  setCrLedgerId]  = useState('')
  const [amount,      setAmount]      = useState('')
  const [narration,   setNarration]   = useState('')
  const [locationId,  setLocationId]  = useState('')
  const [flatLedgers, setFlatLedgers] = useState<FlatLedger[]>([])
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState('')

  useEffect(() => {
    fetch('/api/master/chart-of-accounts/flat')
      .then(r => r.json())
      .then((d: unknown) => { if (Array.isArray(d)) setFlatLedgers(d as FlatLedger[]) })
      .catch(() => {})
  }, [])

  const cashBankLedgers = flatLedgers.filter(l => l.groupCode === 'A-CA-CB' && l.isActive)

  const parsedAmt  = Number(amount) || 0
  const drName     = cashBankLedgers.find(l => l.id === drLedgerId)?.ledgerName
  const crName     = cashBankLedgers.find(l => l.id === crLedgerId)?.ledgerName
  const showPreview = drLedgerId && crLedgerId && drLedgerId !== crLedgerId && parsedAmt > 0 && drName && crName

  async function handleSubmit() {
    setError('')
    if (!drLedgerId)  { setError('To Account (Dr) is required');  return }
    if (!crLedgerId)  { setError('From Account (Cr) is required'); return }
    if (drLedgerId === crLedgerId) { setError('To and From accounts must be different'); return }
    if (!amount || parsedAmt <= 0) { setError('Amount must be greater than 0'); return }

    setSubmitting(true)
    const res = await fetch('/api/accounts/cashbook-vouchers', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voucherType:    'CONTRA',
        date:           new Date(date).toISOString(),
        amount:         parsedAmt,
        debitLedgerId:  drLedgerId,
        creditLedgerId: crLedgerId,
        narration:      narration.trim() || undefined,
        locationId:     locationId || undefined,
      }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setError((b as { error?: string }).error ?? 'Failed to save voucher')
      return
    }
    onSuccess()
  }

  return (
    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px' }}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <LedgerSelect
            label="To Account (Dr) *"
            value={drLedgerId}
            onChange={setDrLedgerId}
            ledgers={cashBankLedgers}
            placeholder="— Select cash/bank —"
            required
          />
          <LedgerSelect
            label="From Account (Cr) *"
            value={crLedgerId}
            onChange={setCrLedgerId}
            ledgers={cashBankLedgers.filter(l => l.id !== drLedgerId)}
            placeholder="— Select cash/bank —"
            required
          />
        </div>

        <Field label="Amount (₹) *">
          <input
            type="number" min="0" step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className={inputCls}
          />
        </Field>

        {showPreview && (
          <div className="rounded-lg px-4 py-3 text-xs" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <p className="font-semibold mb-2" style={{ color: '#64748B' }}>Journal entry preview</p>
            <div className="font-mono space-y-1">
              <div className="flex justify-between">
                <span style={{ color: '#1D4ED8' }}>Dr&nbsp;&nbsp;{drName}</span>
                <span style={{ color: '#1D4ED8' }}>₹ {parsedAmt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between pl-6">
                <span style={{ color: '#B91C1C' }}>Cr&nbsp;&nbsp;{crName}</span>
                <span style={{ color: '#B91C1C' }}>₹ {parsedAmt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        )}

        <Field label="Narration">
          <input
            value={narration}
            onChange={e => setNarration(e.target.value)}
            placeholder="Brief description of the transfer"
            className={inputCls}
          />
        </Field>
        <Field label="Location / Branch">
          <select value={locationId} onChange={e => setLocationId(e.target.value)} className={selectCls}>
            <option value="">All locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
      </div>

      {error && (
        <div className="mt-4 px-4 py-3 text-sm rounded-lg"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <Link href="/accounts"
          className="px-5 py-2.5 text-sm font-medium rounded-lg transition-colors"
          style={{ border: '1.5px solid #E2E8F0', color: '#374151', background: 'white' }}>
          Cancel
        </Link>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ background: '#CC1133' }}
        >
          {submitting ? 'Saving…' : 'Save Contra Voucher'}
        </button>
      </div>
    </div>
  )
}

// ─── Journal Voucher Form ─────────────────────────────────────────────────────

function JournalVoucherForm({
  date,
  locations,
  onSuccess,
}: {
  date: string
  locations: Location[]
  onSuccess: () => void
}) {
  const [drRows,      setDrRows]      = useState<DrRow[]>([{ rowId: crypto.randomUUID(), ledgerId: '', amount: '' }])
  const [crRows,      setCrRows]      = useState<DrRow[]>([{ rowId: crypto.randomUUID(), ledgerId: '', amount: '' }])
  const [narration,   setNarration]   = useState('')
  const [locationId,  setLocationId]  = useState('')
  const [flatLedgers, setFlatLedgers] = useState<FlatLedger[]>([])
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState('')

  useEffect(() => {
    fetch('/api/master/chart-of-accounts/flat')
      .then(r => r.json())
      .then((d: unknown) => { if (Array.isArray(d)) setFlatLedgers(d as FlatLedger[]) })
      .catch(() => {})
  }, [])

  const allLedgers = flatLedgers.filter(l => l.isActive && l.allowManualEntry)

  const totalDr    = drRows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const totalCr    = crRows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const diff       = Math.abs(totalDr - totalCr)
  const isBalanced = diff < 0.01 && totalDr > 0

  const fmt = (n: number) => `₹ ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

  function addDr()    { setDrRows(p => [...p, { rowId: crypto.randomUUID(), ledgerId: '', amount: '' }]) }
  function removeDr(id: string) { if (drRows.length > 1) setDrRows(p => p.filter(r => r.rowId !== id)) }
  function updateDr(id: string, field: 'ledgerId' | 'amount', v: string) {
    setDrRows(p => p.map(r => r.rowId === id ? { ...r, [field]: v } : r))
  }

  function addCr()    { setCrRows(p => [...p, { rowId: crypto.randomUUID(), ledgerId: '', amount: '' }]) }
  function removeCr(id: string) { if (crRows.length > 1) setCrRows(p => p.filter(r => r.rowId !== id)) }
  function updateCr(id: string, field: 'ledgerId' | 'amount', v: string) {
    setCrRows(p => p.map(r => r.rowId === id ? { ...r, [field]: v } : r))
  }

  async function handleSubmit() {
    setError('')
    for (let i = 0; i < drRows.length; i++) {
      const r = drRows[i]
      if (!r.ledgerId) { setError(`Dr row ${i + 1}: select a ledger`); return }
      if (!r.amount || Number(r.amount) <= 0) { setError(`Dr row ${i + 1}: amount must be > 0`); return }
    }
    for (let i = 0; i < crRows.length; i++) {
      const r = crRows[i]
      if (!r.ledgerId) { setError(`Cr row ${i + 1}: select a ledger`); return }
      if (!r.amount || Number(r.amount) <= 0) { setError(`Cr row ${i + 1}: amount must be > 0`); return }
    }
    if (!isBalanced) {
      setError(`Entry is not balanced — Dr ${fmt(totalDr)} ≠ Cr ${fmt(totalCr)}`)
      return
    }

    const journalLines = [
      ...drRows.map(r => ({ ledgerId: r.ledgerId, debit: Number(r.amount), credit: 0 })),
      ...crRows.map(r => ({ ledgerId: r.ledgerId, debit: 0, credit: Number(r.amount) })),
    ]

    setSubmitting(true)
    const res = await fetch('/api/accounts/cashbook-vouchers', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voucherType:  'JOURNAL',
        date:         new Date(date).toISOString(),
        journalLines,
        narration:    narration.trim() || undefined,
        locationId:   locationId || undefined,
      }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setError((b as { error?: string }).error ?? 'Failed to save voucher')
      return
    }
    onSuccess()
  }

  function renderSide(
    label: string,
    accentColor: string,
    rows: DrRow[],
    updateRow: (id: string, field: 'ledgerId' | 'amount', v: string) => void,
    removeRow: (id: string) => void,
    addRow: () => void,
  ) {
    return (
      <div>
        <div className="text-xs font-semibold mb-3 flex items-center gap-2" style={{ color: '#374151' }}>
          <span style={{ width: 2, height: 14, background: accentColor, display: 'inline-block', borderRadius: 1 }} />
          {label}
        </div>
        <div className="flex flex-col gap-3">
          {rows.map((row, idx) => (
            <div key={row.rowId} className="grid gap-3 items-end" style={{ gridTemplateColumns: '1fr 160px auto' }}>
              <LedgerSelect
                label={`Ledger Account — Row ${idx + 1} *`}
                value={row.ledgerId}
                onChange={v => updateRow(row.rowId, 'ledgerId', v)}
                ledgers={allLedgers}
                placeholder="— Select ledger —"
                required
              />
              <Field label="Amount *">
                <input
                  type="number" min="0" step="0.01"
                  value={row.amount}
                  onChange={e => updateRow(row.rowId, 'amount', e.target.value)}
                  placeholder="0.00"
                  className={inputCls}
                />
              </Field>
              <div style={{ paddingBottom: '1px' }}>
                <button
                  type="button"
                  onClick={() => removeRow(row.rowId)}
                  disabled={rows.length === 1}
                  className="w-full px-2 py-2.5 text-xs rounded-lg transition-colors disabled:opacity-30"
                  style={{ border: '1px solid #FECACA', color: '#DC2626', background: 'white' }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="self-start text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            style={{ border: '1.5px dashed #CBD5E1', color: '#475569', background: 'white' }}
          >
            + Add More Ledger
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px' }}>
      <div className="flex flex-col gap-6">
        {renderSide('Debit Entries', '#1D4ED8', drRows, updateDr, removeDr, addDr)}

        <div style={{ borderTop: '1px dashed #E2E8F0' }} />

        {renderSide('Credit Entries', '#B91C1C', crRows, updateCr, removeCr, addCr)}

        {/* Totals bar */}
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
          <div className="grid grid-cols-3 text-center text-xs">
            <div className="px-4 py-3" style={{ borderRight: '1px solid #E2E8F0' }}>
              <div className="font-medium mb-0.5" style={{ color: '#94A3B8' }}>Total Debit</div>
              <div className="font-bold" style={{ color: '#1D4ED8' }}>{fmt(totalDr)}</div>
            </div>
            <div className="px-4 py-3" style={{ borderRight: '1px solid #E2E8F0' }}>
              <div className="font-medium mb-0.5" style={{ color: '#94A3B8' }}>Total Credit</div>
              <div className="font-bold" style={{ color: '#B91C1C' }}>{fmt(totalCr)}</div>
            </div>
            <div className="px-4 py-3" style={{ background: isBalanced ? '#F0FDF4' : '#FEF2F2' }}>
              <div className="font-medium mb-0.5" style={{ color: '#94A3B8' }}>
                {isBalanced ? 'Status' : 'Difference'}
              </div>
              <div className="font-bold" style={{ color: isBalanced ? '#15803D' : '#DC2626' }}>
                {isBalanced ? '✓ Balanced' : fmt(diff)}
              </div>
            </div>
          </div>
        </div>

        {isBalanced && (
          <div className="rounded-lg px-4 py-3 text-xs" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <p className="font-semibold mb-2" style={{ color: '#64748B' }}>Journal entry preview</p>
            <div className="font-mono space-y-1">
              {drRows.map(r => (
                <div key={r.rowId} className="flex justify-between">
                  <span style={{ color: '#1D4ED8' }}>Dr&nbsp;&nbsp;{allLedgers.find(l => l.id === r.ledgerId)?.ledgerName ?? '—'}</span>
                  <span style={{ color: '#1D4ED8' }}>₹ {Number(r.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
              ))}
              {crRows.map(r => (
                <div key={r.rowId} className="flex justify-between pl-6">
                  <span style={{ color: '#B91C1C' }}>Cr&nbsp;&nbsp;{allLedgers.find(l => l.id === r.ledgerId)?.ledgerName ?? '—'}</span>
                  <span style={{ color: '#B91C1C' }}>₹ {Number(r.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Field label="Narration">
          <input
            value={narration}
            onChange={e => setNarration(e.target.value)}
            placeholder="Brief description of the journal entry"
            className={inputCls}
          />
        </Field>
        <Field label="Location / Branch">
          <select value={locationId} onChange={e => setLocationId(e.target.value)} className={selectCls}>
            <option value="">All locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
      </div>

      {error && (
        <div className="mt-4 px-4 py-3 text-sm rounded-lg"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <Link href="/accounts"
          className="px-5 py-2.5 text-sm font-medium rounded-lg transition-colors"
          style={{ border: '1.5px solid #E2E8F0', color: '#374151', background: 'white' }}>
          Cancel
        </Link>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ background: '#CC1133' }}
        >
          {submitting ? 'Saving…' : 'Save Journal Voucher'}
        </button>
      </div>
    </div>
  )
}

// ─── Main form ────────────────────────────────────────────────────────────────

function VoucherFormInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const initialType = (searchParams.get('type') ?? 'RECEIPT') as VoucherType
  const safeType: VoucherType = (VOUCHER_TYPES as readonly string[]).includes(initialType)
    ? initialType
    : 'RECEIPT'

  const [voucherType, setVoucherType] = useState<VoucherType>(safeType)
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10))
  const [locations,   setLocations]   = useState<Location[]>([])

  useEffect(() => {
    fetch('/api/locations').then(r => r.json()).then(d => {
      setLocations(Array.isArray(d) ? d : [])
    }).catch(() => {})
  }, [])

  return (
    <div className="p-6 max-w-xl" style={{ background: '#F5F7FA', minHeight: '100vh' }}>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/accounts" className="text-sm hover:underline" style={{ color: '#94A3B8' }}>← Accounts</Link>
        <span style={{ color: '#CBD5E1' }}>/</span>
        <h1 className="text-xl font-bold" style={{ color: '#1E293B' }}>New Voucher</h1>
      </div>

      {/* Voucher type selector */}
      <div className="mb-4 overflow-hidden"
        style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
        <p className="text-xs font-semibold mb-3" style={{ color: '#374151' }}>Voucher Type</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {VOUCHER_TYPES.map(t => (
            <button key={t} type="button" onClick={() => setVoucherType(t)}
              style={voucherType === t
                ? { background: '#CC1133', color: 'white', border: '1.5px solid #CC1133', borderRadius: '8px', padding: '10px 12px' }
                : { background: 'white',   color: '#374151', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px' }}
              className="text-xs font-semibold transition-colors">
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <p className="text-xs mt-3" style={{ color: '#94A3B8' }}>{TYPE_HINT[voucherType]}</p>
      </div>

      {/* Date — common to all types */}
      <div className="mb-4 overflow-hidden"
        style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
        <Field label="Date *">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
        </Field>
      </div>

      {voucherType === 'RECEIPT' && (
        <ReceiptVoucherForm date={date} locations={locations} onSuccess={() => router.push('/accounts')} />
      )}
      {voucherType === 'PAYMENT' && (
        <PaymentVoucherForm date={date} locations={locations} onSuccess={() => router.push('/accounts')} />
      )}
      {voucherType === 'CONTRA' && (
        <ContraVoucherForm date={date} locations={locations} onSuccess={() => router.push('/accounts')} />
      )}
      {voucherType === 'JOURNAL' && (
        <JournalVoucherForm date={date} locations={locations} onSuccess={() => router.push('/accounts')} />
      )}
    </div>
  )
}

export default function NewVoucherPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm" style={{ color: '#94A3B8' }}>Loading…</div>}>
      <VoucherFormInner />
    </Suspense>
  )
}

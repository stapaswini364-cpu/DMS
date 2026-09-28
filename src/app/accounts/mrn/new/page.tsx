'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Location = { id: string; name: string }

const PAYMENT_MODES = ['CASH', 'UPI', 'BANK_TRANSFER', 'DD', 'CHEQUE', 'NEFT', 'RTGS'] as const

const inputCls = [
  'w-full px-3 py-2.5 text-sm rounded-lg',
  'border border-[#E2E8F0] bg-white text-[#1E293B]',
  'placeholder:text-[#94A3B8]',
  'focus:outline-none focus:border-[#CC1133]',
  'transition-colors',
].join(' ')

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: '#374151' }}>
        {label}{required && <span className="text-[#CC1133] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

type FormState = {
  mrnNumber:       string
  customerName:    string
  customerPhone:   string
  locationId:      string
  amount:          string
  paymentMode:     string
  referenceNumber: string
}

const INIT: FormState = {
  mrnNumber:       '',
  customerName:    '',
  customerPhone:   '',
  locationId:      '',
  amount:          '',
  paymentMode:     'CASH',
  referenceNumber: '',
}

export default function StandaloneMrnPage() {
  const [form, setForm]       = useState<FormState>(INIT)
  const [locations, setLocs]  = useState<Location[]>([])
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [created, setCreated] = useState<{ mrnNumber: string; amount: string; customerName: string } | null>(null)

  const up = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }))

  const load = useCallback(async () => {
    const l = await fetch('/api/locations').then(r => r.json()).catch(() => [])
    setLocs(Array.isArray(l) ? l : [])
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const amt = Number(form.amount)
    if (!form.mrnNumber.trim())     return setError('MRN number is required.')
    if (!form.customerName.trim())  return setError('Customer name is required.')
    if (!form.customerPhone.trim()) return setError('Customer phone is required.')
    if (!form.locationId)           return setError('Select a branch.')
    if (isNaN(amt) || amt <= 0)     return setError('Enter a valid amount.')

    setSaving(true)
    try {
      // Step 1: create customer (same as booking form)
      const custRes = await fetch('/api/customers', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: form.customerName.trim(), phone: form.customerPhone.trim() }),
      })
      const custData = await custRes.json()
      if (!custRes.ok) throw new Error(custData.error ?? 'Could not save customer.')

      // Step 2: create MRN
      const mrnRes = await fetch('/api/mrn/standalone', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          mrnNumber:       form.mrnNumber.trim().toUpperCase(),
          customerId:      custData.id,
          locationId:      form.locationId,
          amount:          String(amt),
          paymentMode:     form.paymentMode,
          referenceNumber: form.referenceNumber.trim() || undefined,
        }),
      })
      const mrnData = await mrnRes.json()
      if (!mrnRes.ok) throw new Error(mrnData.error ?? 'Failed to create MRN.')

      setCreated({ mrnNumber: mrnData.mrnNumber, amount: mrnData.amount, customerName: form.customerName.trim() })
      setForm(INIT)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    }
    setSaving(false)
  }

  return (
    <div className="p-6 max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/accounts" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Accounts</Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">New Standalone MRN</h1>
      </div>

      {created && (
        <div className="fp-card mb-6 px-6 py-6 text-center" style={{ border: '2px solid #86EFAC', background: '#F0FDF4' }}>
          <div className="text-sm font-medium mb-1" style={{ color: '#15803D' }}>MRN Created Successfully</div>
          <div className="text-3xl font-mono font-bold tracking-wider mb-2" style={{ color: '#1E293B' }}>{created.mrnNumber}</div>
          <div className="text-sm mb-0.5" style={{ color: '#4B5563' }}>
            ₹ {Number(created.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} received
          </div>
          <div className="text-xs" style={{ color: '#94A3B8' }}>Customer: {created.customerName}</div>
          <p className="text-xs mt-3" style={{ color: '#6B7280' }}>
            Note this MRN — it can be entered on the booking form to link this advance to a booking.
          </p>
          <div className="flex gap-3 justify-center mt-4">
            <button
              onClick={() => setCreated(null)}
              className="px-4 py-2 text-sm rounded-lg font-medium"
              style={{ background: '#F1F5F9', color: '#374151', border: '1px solid #E2E8F0' }}
            >
              Create Another
            </button>
            <Link
              href="/accounts"
              className="px-4 py-2 text-sm rounded-lg font-medium"
              style={{ background: '#CC1133', color: '#fff', display: 'inline-block' }}
            >
              Done
            </Link>
          </div>
        </div>
      )}

      {!created && (
        <form onSubmit={submit} className="fp-card p-6 flex flex-col gap-5">
          <p className="text-xs" style={{ color: '#94A3B8' }}>
            Record a customer advance before a booking exists. The MRN number can be entered on the booking form later to link this payment.
          </p>

          <Field label="MRN Number" required>
            <input
              type="text"
              value={form.mrnNumber}
              onChange={e => up('mrnNumber', e.target.value.toUpperCase())}
              placeholder="e.g. MRN-20260822-0001"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Customer Name" required>
              <input
                type="text"
                value={form.customerName}
                onChange={e => up('customerName', e.target.value)}
                placeholder="Full name"
                className={inputCls}
              />
            </Field>
            <Field label="Phone" required>
              <input
                type="tel"
                value={form.customerPhone}
                onChange={e => up('customerPhone', e.target.value)}
                placeholder="10-digit mobile"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Branch / Location" required>
            <select
              value={form.locationId}
              onChange={e => up('locationId', e.target.value)}
              className={inputCls}
            >
              <option value="">Select branch…</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount Received (₹)" required>
              <input
                type="number"
                min="1"
                step="0.01"
                value={form.amount}
                onChange={e => up('amount', e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </Field>
            <Field label="Payment Mode" required>
              <select
                value={form.paymentMode}
                onChange={e => up('paymentMode', e.target.value)}
                className={inputCls}
              >
                {PAYMENT_MODES.map(m => (
                  <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Reference Number">
            <input
              type="text"
              value={form.referenceNumber}
              onChange={e => up('referenceNumber', e.target.value)}
              placeholder="Cheque no., UTR, transaction ID…"
              className={inputCls}
            />
          </Field>

          {error && (
            <div className="px-3 py-2 text-sm rounded-lg" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 text-sm font-semibold rounded-lg transition-opacity"
            style={{ background: '#CC1133', color: '#fff', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Creating…' : 'Create MRN'}
          </button>
        </form>
      )}
    </div>
  )
}

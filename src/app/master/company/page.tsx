'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

const CATEGORIES = [
  'Individual', 'HUF', 'Pvt Ltd', 'Ltd', 'Foreign', 'OPC',
  'Firm', 'LLP', 'AOP-BOI', 'Local Authority', 'AJP',
]

const MONTHS = [
  { label: 'January',   value: 1 },
  { label: 'February',  value: 2 },
  { label: 'March',     value: 3 },
  { label: 'April',     value: 4 },
  { label: 'May',       value: 5 },
  { label: 'June',      value: 6 },
  { label: 'July',      value: 7 },
  { label: 'August',    value: 8 },
  { label: 'September', value: 9 },
  { label: 'October',   value: 10 },
  { label: 'November',  value: 11 },
  { label: 'December',  value: 12 },
]

const ACCOUNT_TYPES = ['Savings', 'Current', 'Cash Credit', 'Overdraft']

type Form = {
  companyName:        string
  companyCategory:    string
  email:              string
  phone:              string
  website:            string
  address:            string
  state:              string
  country:            string
  pincode:            string
  mailingName:        string
  fyStartMonth:       number
  booksBeginningFrom: string
  gstin:              string
  pan:                string
  msme:               string
  tan:                string
  cin:                string
  bankName:           string
  accountNumber:      string
  ifscCode:           string
  accountType:        string
  currencySymbol:     string
  currencyFormalName: string
}

const EMPTY: Form = {
  companyName:        '',
  companyCategory:    '',
  email:              '',
  phone:              '',
  website:            '',
  address:            '',
  state:              '',
  country:            'India',
  pincode:            '',
  mailingName:        '',
  fyStartMonth:       4,
  booksBeginningFrom: '',
  gstin:              '',
  pan:                '',
  msme:               '',
  tan:                '',
  cin:                '',
  bankName:           '',
  accountNumber:      '',
  ifscCode:           '',
  accountType:        '',
  currencySymbol:     '₹',
  currencyFormalName: 'INR - Indian Rupee',
}

function Field({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: '#64748B' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="fp-input text-sm"
      style={{ minHeight: 36 }}
    />
  )
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select {...props} className="fp-input text-sm" style={{ minHeight: 36 }}>
      {props.children}
    </select>
  )
}

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-[#1E293B]">{title}</h2>
      <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{desc}</p>
    </div>
  )
}

export default function CompanyDetailsPage() {
  const [form,    setForm]    = useState<Form>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState('')

  // Logo state — managed independently of the main form save cycle.
  const [logoUrl,      setLogoUrl]      = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError,    setLogoError]    = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const set = useCallback(<K extends keyof Form>(k: K, v: Form[K]) => {
    setSaved(false)
    setError('')
    setForm(f => ({ ...f, [k]: v }))
  }, [])

  useEffect(() => {
    fetch('/api/company-settings')
      .then(r => r.json())
      .then((d: Partial<Form> & { fyStartMonth?: number; logoUrl?: string | null }) => {
        setLogoUrl(d.logoUrl ?? null)
        setForm({
          companyName:        d.companyName        ?? '',
          companyCategory:    d.companyCategory    ?? '',
          email:              d.email              ?? '',
          phone:              d.phone              ?? '',
          website:            d.website            ?? '',
          address:            d.address            ?? '',
          state:              d.state              ?? '',
          country:            d.country            ?? 'India',
          pincode:            d.pincode            ?? '',
          mailingName:        d.mailingName        ?? '',
          fyStartMonth:       d.fyStartMonth       ?? 4,
          booksBeginningFrom: d.booksBeginningFrom ?? '',
          gstin:              d.gstin              ?? '',
          pan:                d.pan                ?? '',
          msme:               d.msme               ?? '',
          tan:                d.tan                ?? '',
          cin:                d.cin                ?? '',
          bankName:           d.bankName           ?? '',
          accountNumber:      d.accountNumber      ?? '',
          ifscCode:           d.ifscCode           ?? '',
          accountType:        d.accountType        ?? '',
          currencySymbol:     d.currencySymbol     ?? '₹',
          currencyFormalName: d.currencyFormalName ?? 'INR - Indian Rupee',
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleLogoFile(file: File) {
    setLogoError('')
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('File must be under 2 MB')
      return
    }
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type.toLowerCase())) {
      setLogoError('Only PNG, JPG or WebP images are allowed')
      return
    }
    setLogoUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/company-settings/logo', { method: 'POST', body })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLogoError((data as { error?: string }).error ?? 'Upload failed')
        return
      }
      setLogoUrl((data as { logoUrl: string }).logoUrl)
    } catch {
      setLogoError('Network error — please try again')
    } finally {
      setLogoUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleLogoRemove() {
    setLogoError('')
    setLogoUploading(true)
    try {
      const res = await fetch('/api/company-settings/logo', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setLogoError((data as { error?: string }).error ?? 'Failed to remove logo')
        return
      }
      setLogoUrl(null)
    } catch {
      setLogoError('Network error — please try again')
    } finally {
      setLogoUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.companyName.trim())      { setError('Company Name is required');          return }
    if (!form.companyCategory.trim())  { setError('Company Category is required');      return }
    if (!form.email.trim())            { setError('Email is required');                 return }
    if (!form.phone.trim())            { setError('Phone Number is required');          return }
    if (!form.address.trim())          { setError('Address is required');               return }
    if (!form.state.trim())            { setError('State is required');                 return }
    if (!form.country.trim())          { setError('Country is required');               return }
    if (!form.pincode.trim())          { setError('PIN Code is required');              return }
    if (!form.mailingName.trim())      { setError('Mailing Name is required');          return }
    if (!form.booksBeginningFrom)      { setError('Books Beginning From is required');  return }
    if (!form.pan.trim())              { setError('PAN Card is required');              return }
    if (!form.bankName.trim())         { setError('Bank Name is required');             return }
    if (!form.accountNumber.trim())    { setError('Account Number is required');        return }
    if (!form.ifscCode.trim())         { setError('IFSC Code is required');             return }
    if (!form.accountType.trim())      { setError('Account Type is required');          return }
    if (!form.currencySymbol.trim())   { setError('Currency Symbol is required');       return }
    if (!form.currencyFormalName.trim()){ setError('Currency Formal Name is required'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/company-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to save'); return }
      setSaved(true)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#3B82F6', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/master" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Master Data</Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">Company Details</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── 0. Company Logo ─────────────────────────────────────────────── */}
        <div className="fp-card p-5 rounded-xl space-y-4">
          <SectionHeader
            title="Company Logo"
            desc="Shown in the app header for your users. PNG, JPG or WebP; 2 MB max."
          />
          <div className="flex items-center gap-5 flex-wrap">
            <div
              className="w-24 h-24 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Current logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs" style={{ color: '#94A3B8' }}>No logo</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleLogoFile(f)
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoUploading}
                  className="fp-btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {logoUploading ? 'Uploading…' : logoUrl ? 'Replace Logo' : 'Upload Logo'}
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={handleLogoRemove}
                    disabled={logoUploading}
                    className="fp-btn-secondary px-4 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
              {logoError && (
                <p className="text-xs" style={{ color: '#DC2626' }}>{logoError}</p>
              )}
              <p className="text-xs" style={{ color: '#94A3B8' }}>
                Recommended: transparent PNG, roughly 3:1 aspect ratio (e.g. 300×100).
              </p>
            </div>
          </div>
        </div>

        {/* ── 1. Basic Company Information ────────────────────────────────── */}
        <div className="fp-card p-5 rounded-xl space-y-4">
          <SectionHeader
            title="Basic Company Information"
            desc="Company identity and contact details."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Company Name" required>
              <Input value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="e.g. Sunrise Motors Pvt Ltd" />
            </Field>
            <Field label="Company Category" required>
              <Select value={form.companyCategory} onChange={e => set('companyCategory', e.target.value)}>
                <option value="">Select category…</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Email ID" required>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="company@example.com" />
            </Field>
            <Field label="Phone Number" required>
              <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 99999 99999" />
            </Field>
            <Field label="Website">
              <Input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://example.com" />
            </Field>
          </div>
        </div>

        {/* ── 2. Address Details ───────────────────────────────────────────── */}
        <div className="fp-card p-5 rounded-xl space-y-4">
          <SectionHeader
            title="Address Details"
            desc="Registered address used on documents and reports."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Address" required>
                <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street, area, locality" />
              </Field>
            </div>
            <Field label="State" required>
              <Input value={form.state} onChange={e => set('state', e.target.value)} placeholder="e.g. Maharashtra" />
            </Field>
            <Field label="Country" required>
              <Input value={form.country} onChange={e => set('country', e.target.value)} placeholder="India" />
            </Field>
            <Field label="PIN Code" required>
              <Input value={form.pincode} onChange={e => set('pincode', e.target.value)} placeholder="400001" maxLength={6} />
            </Field>
          </div>
        </div>

        {/* ── 3. Accounting Details ────────────────────────────────────────── */}
        <div className="fp-card p-5 rounded-xl space-y-4">
          <SectionHeader
            title="Accounting Details"
            desc="Financial year and books start dates. Changing the FY month affects P&amp;L, Balance Sheet and invoice numbering."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Mailing Name" required>
              <Input value={form.mailingName} onChange={e => set('mailingName', e.target.value)} placeholder="Name on outgoing documents" />
            </Field>
            <Field label="Financial Year Beginning From" required>
              <Select value={form.fyStartMonth} onChange={e => set('fyStartMonth', Number(e.target.value))}>
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
            </Field>
            <Field label="Books Beginning From" required>
              <Input type="date" value={form.booksBeginningFrom} onChange={e => set('booksBeginningFrom', e.target.value)} />
            </Field>
          </div>
        </div>

        {/* ── 4. Statutory Information ─────────────────────────────────────── */}
        <div className="fp-card p-5 rounded-xl space-y-4">
          <SectionHeader
            title="Statutory Information"
            desc="Tax and regulatory identifiers."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="GSTIN">
              <Input value={form.gstin} onChange={e => set('gstin', e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" maxLength={15} />
            </Field>
            <Field label="PAN Card" required>
              <Input value={form.pan} onChange={e => set('pan', e.target.value.toUpperCase())} placeholder="AAAAA9999A" maxLength={10} />
            </Field>
            <Field label="MSME">
              <Input value={form.msme} onChange={e => set('msme', e.target.value)} placeholder="MSME registration number" />
            </Field>
            <Field label="TAN">
              <Input value={form.tan} onChange={e => set('tan', e.target.value.toUpperCase())} placeholder="AAAA99999A" maxLength={10} />
            </Field>
            <Field label="CIN No.">
              <Input value={form.cin} onChange={e => set('cin', e.target.value.toUpperCase())} placeholder="U12345MH2000PTC123456" maxLength={21} />
            </Field>
          </div>
        </div>

        {/* ── 5. Bank Account Details ──────────────────────────────────────── */}
        <div className="fp-card p-5 rounded-xl space-y-4">
          <SectionHeader
            title="Bank Account Details"
            desc="Primary bank account for the company."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Bank Name" required>
              <Input value={form.bankName} onChange={e => set('bankName', e.target.value)} placeholder="e.g. State Bank of India" />
            </Field>
            <Field label="Account Number" required>
              <Input value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)} placeholder="Account number" />
            </Field>
            <Field label="IFSC Code" required>
              <Input value={form.ifscCode} onChange={e => set('ifscCode', e.target.value.toUpperCase())} placeholder="SBIN0001234" maxLength={11} />
            </Field>
            <Field label="Account Type" required>
              <Select value={form.accountType} onChange={e => set('accountType', e.target.value)}>
                <option value="">Select type…</option>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
          </div>
        </div>

        {/* ── 6. Currency Information ──────────────────────────────────────── */}
        <div className="fp-card p-5 rounded-xl space-y-4">
          <SectionHeader
            title="Currency Information"
            desc="Base currency used across all reports and invoices."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Base Currency Symbol" required>
              <Input value={form.currencySymbol} onChange={e => set('currencySymbol', e.target.value)} placeholder="₹" maxLength={5} />
            </Field>
            <Field label="Formal Name" required>
              <Input value={form.currencyFormalName} onChange={e => set('currencyFormalName', e.target.value)} placeholder="INR - Indian Rupee" />
            </Field>
          </div>
        </div>

        {/* ── Error / Success / Submit ─────────────────────────────────────── */}
        {error && (
          <div className="fp-card border rounded-lg px-4 py-3 text-sm" style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#DC2626' }}>
            {error}
          </div>
        )}
        {saved && (
          <div className="fp-card border rounded-lg px-4 py-3 text-sm" style={{ background: '#F0FDF4', borderColor: '#BBF7D0', color: '#16A34A' }}>
            Company details saved successfully.
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="fp-btn-primary px-6 py-2 text-sm font-medium"
          >
            {saving ? 'Saving…' : 'Save Company Details'}
          </button>
        </div>

      </form>
    </div>
  )
}

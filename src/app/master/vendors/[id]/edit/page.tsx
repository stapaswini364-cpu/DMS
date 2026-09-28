'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'

const VENDOR_TYPES = [
  { value: 'INDIVIDUAL',     label: 'Individual' },
  { value: 'PROPRIETORSHIP', label: 'Proprietorship' },
  { value: 'PARTNERSHIP',    label: 'Partnership' },
  { value: 'LLP',            label: 'LLP' },
  { value: 'COMPANY',        label: 'Company' },
  { value: 'TRUST',          label: 'Trust' },
  { value: 'GOVT',           label: 'Govt / PSU' },
  { value: 'OTHER',          label: 'Other' },
]

const VENDOR_CATEGORIES = [
  { value: 'VEHICLE',       label: 'Vehicle' },
  { value: 'PARTS',         label: 'Parts & Spares' },
  { value: 'SERVICES',      label: 'Services' },
  { value: 'CAPITAL_GOODS', label: 'Capital Goods' },
  { value: 'TRANSPORT',     label: 'Transport' },
  { value: 'PROFESSIONAL',  label: 'Professional' },
  { value: 'UTILITY',       label: 'Utility' },
  { value: 'OTHER',         label: 'Other' },
]

const MSME_OPTIONS = ['Not Registered', 'Registered (Active)', 'Registered (Inactive)']

type Form = {
  vendorType: string; vendorCategory: string
  name: string; tradeName: string; contactPerson: string
  phone: string; email: string; website: string
  pan: string; gstin: string; msmeStatus: string; udyamNo: string
  addressLine1: string; addressLine2: string
  city: string; state: string; pincode: string; country: string
  bankName: string; bankAccountName: string; accountNumber: string
  ifscCode: string; bankBranch: string
  openingBalance: string; openingBalanceType: string; openingBalanceRemarks: string
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="fp-label">
      {children}{required && <span style={{ color: '#EF4444' }}> *</span>}
    </label>
  )
}

export default function EditVendorPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [vendorCode, setVendorCode] = useState('')
  const [form,    setForm]    = useState<Form | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const set = useCallback(<K extends keyof Form>(k: K, v: Form[K]) => {
    setError('')
    setForm(f => f ? { ...f, [k]: v } : f)
  }, [])

  useEffect(() => {
    fetch(`/api/vendors/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setVendorCode(d.vendorCode ?? '')
        setForm({
          vendorType:            d.vendorType            ?? '',
          vendorCategory:        d.vendorCategory        ?? '',
          name:                  d.name                  ?? '',
          tradeName:             d.tradeName             ?? '',
          contactPerson:         d.contactPerson         ?? '',
          phone:                 d.phone                 ?? '',
          email:                 d.email                 ?? '',
          website:               d.website               ?? '',
          pan:                   d.pan                   ?? '',
          gstin:                 d.gstin                 ?? '',
          msmeStatus:            d.msmeStatus            ?? '',
          udyamNo:               d.udyamNo               ?? '',
          addressLine1:          d.addressLine1          ?? '',
          addressLine2:          d.addressLine2          ?? '',
          city:                  d.city                  ?? '',
          state:                 d.state                 ?? '',
          pincode:               d.pincode               ?? '',
          country:               d.country               ?? 'India',
          bankName:              d.bankName              ?? '',
          bankAccountName:       d.bankAccountName       ?? '',
          accountNumber:         d.accountNumber         ?? '',
          ifscCode:              d.ifscCode              ?? '',
          bankBranch:            d.bankBranch            ?? '',
          openingBalance:        d.openingBalance        ?? '',
          openingBalanceType:    d.openingBalanceType    ?? 'CREDIT',
          openingBalanceRemarks: d.openingBalanceRemarks ?? '',
        })
      })
      .catch(() => setError('Failed to load vendor'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setError('')

    if (!form.vendorType)          { setError('Vendor Type is required');    return }
    if (!form.vendorCategory)      { setError('Vendor Category is required'); return }
    if (!form.name.trim())         { setError('Vendor Name is required');     return }
    if (!form.phone.trim())        { setError('Mobile No. is required');      return }
    if (!form.addressLine1.trim()) { setError('Address Line 1 is required');  return }
    if (!form.city.trim())         { setError('City is required');            return }
    if (!form.state.trim())        { setError('State is required');           return }
    if (!form.pincode.trim())      { setError('PIN is required');             return }

    setSaving(true)
    try {
      const res = await fetch(`/api/vendors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to save vendor'); return }
      router.push('/master/vendors')
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: '#3B82F6', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!form) {
    return (
      <div className="p-6">
        <div className="text-sm" style={{ color: '#EF4444' }}>{error || 'Vendor not found.'}</div>
        <Link href="/master/vendors" className="fp-btn-secondary mt-4 inline-block">← Back to list</Link>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/master/vendors" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Vendor Master</Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">Edit Vendor</h1>
        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: '#F1F5F9', color: '#64748B' }}>{vendorCode}</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── 1. Basic Information ─────────────────────────────────────────── */}
        <div className="fp-card p-5 rounded-xl space-y-4">
          <div className="mb-1">
            <h2 className="text-sm font-semibold text-[#1E293B]">Basic Information</h2>
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <div>
              <Label required>Vendor Type</Label>
              <select value={form.vendorType} onChange={e => set('vendorType', e.target.value)} className="fp-input">
                <option value="">Select type…</option>
                {VENDOR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <Label required>Vendor Category</Label>
              <select value={form.vendorCategory} onChange={e => set('vendorCategory', e.target.value)} className="fp-input">
                <option value="">Select category…</option>
                {VENDOR_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <Label required>Vendor Name</Label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="fp-input" placeholder="Legal / registered name" />
            </div>
            <div>
              <Label>Trade Name</Label>
              <input value={form.tradeName} onChange={e => set('tradeName', e.target.value)} className="fp-input" />
            </div>
            <div>
              <Label>Contact Person</Label>
              <input value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} className="fp-input" />
            </div>
            <div>
              <Label required>Mobile No.</Label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} className="fp-input" />
            </div>
            <div>
              <Label>Email ID</Label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="fp-input" />
            </div>
            <div>
              <Label>Website</Label>
              <input value={form.website} onChange={e => set('website', e.target.value)} className="fp-input" />
            </div>
            <div>
              <Label>PAN</Label>
              <input value={form.pan} onChange={e => set('pan', e.target.value.toUpperCase())} className="fp-input" maxLength={10} />
            </div>
            <div>
              <Label>GSTIN</Label>
              <input value={form.gstin} onChange={e => set('gstin', e.target.value.toUpperCase())} className="fp-input" maxLength={15} />
            </div>
            <div>
              <Label>MSME / Udyam Status</Label>
              <select value={form.msmeStatus} onChange={e => set('msmeStatus', e.target.value)} className="fp-input">
                <option value="">Select…</option>
                {MSME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <Label>Udyam Registration No.</Label>
              <input value={form.udyamNo} onChange={e => set('udyamNo', e.target.value.toUpperCase())} className="fp-input" />
            </div>
          </div>
        </div>

        {/* ── 2. Billing Address ───────────────────────────────────────────── */}
        <div className="fp-card p-5 rounded-xl space-y-4">
          <div className="mb-1">
            <h2 className="text-sm font-semibold text-[#1E293B]">Billing Address</h2>
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label required>Address Line 1</Label>
              <input value={form.addressLine1} onChange={e => set('addressLine1', e.target.value)} className="fp-input" />
            </div>
            <div className="sm:col-span-2">
              <Label>Address Line 2</Label>
              <input value={form.addressLine2} onChange={e => set('addressLine2', e.target.value)} className="fp-input" />
            </div>
            <div>
              <Label required>City</Label>
              <input value={form.city} onChange={e => set('city', e.target.value)} className="fp-input" />
            </div>
            <div>
              <Label required>State</Label>
              <input value={form.state} onChange={e => set('state', e.target.value)} className="fp-input" />
            </div>
            <div>
              <Label required>PIN</Label>
              <input value={form.pincode} onChange={e => set('pincode', e.target.value)} className="fp-input" maxLength={6} />
            </div>
            <div>
              <Label>Country</Label>
              <input value={form.country} onChange={e => set('country', e.target.value)} className="fp-input" />
            </div>
          </div>
        </div>

        {/* ── 3. Bank Details ──────────────────────────────────────────────── */}
        <div className="fp-card p-5 rounded-xl space-y-4">
          <div className="mb-1">
            <h2 className="text-sm font-semibold text-[#1E293B]">Bank Details</h2>
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <div>
              <Label>Bank Name</Label>
              <input value={form.bankName} onChange={e => set('bankName', e.target.value)} className="fp-input" />
            </div>
            <div>
              <Label>Bank Account Name</Label>
              <input value={form.bankAccountName} onChange={e => set('bankAccountName', e.target.value)} className="fp-input" />
            </div>
            <div>
              <Label>Account Number</Label>
              <input value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)} className="fp-input" />
            </div>
            <div>
              <Label>IFSC Code</Label>
              <input value={form.ifscCode} onChange={e => set('ifscCode', e.target.value.toUpperCase())} className="fp-input" maxLength={11} />
            </div>
            <div>
              <Label>Branch</Label>
              <input value={form.bankBranch} onChange={e => set('bankBranch', e.target.value)} className="fp-input" />
            </div>
          </div>
        </div>

        {/* ── 4. Opening Balance ───────────────────────────────────────────── */}
        <div className="fp-card p-5 rounded-xl space-y-4" style={{ borderLeft: '3px solid #F59E0B' }}>
          <div className="mb-1">
            <h2 className="text-sm font-semibold text-[#1E293B]">Opening Balance</h2>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
              Pending posting — will be journalised to Accounts Payable (L0001) in a future step.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <div>
              <Label>Opening Payable Balance (₹)</Label>
              <input
                type="number" min="0" step="0.01"
                value={form.openingBalance}
                onChange={e => set('openingBalance', e.target.value)}
                className="fp-input"
              />
            </div>
            <div>
              <Label>Opening Balance Type</Label>
              <select value={form.openingBalanceType} onChange={e => set('openingBalanceType', e.target.value)} className="fp-input">
                <option value="CREDIT">Credit (amount owed to vendor)</option>
                <option value="DEBIT">Debit (advance paid to vendor)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label>Remarks</Label>
              <input value={form.openingBalanceRemarks} onChange={e => set('openingBalanceRemarks', e.target.value)} className="fp-input" />
            </div>
          </div>
        </div>

        {/* ── Error + Actions ──────────────────────────────────────────────── */}
        {error && (
          <div className="px-4 py-3 text-sm rounded-lg border" style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#DC2626' }}>
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="fp-btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Vendor'}
          </button>
          <Link href="/master/vendors" className="fp-btn-secondary">Back to List</Link>
        </div>

      </form>
    </div>
  )
}

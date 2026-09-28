'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'

// ─── Style constants ──────────────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2.5 text-sm rounded-lg border border-[#E2E8F0] bg-white text-[#1E293B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#CC1133] transition-colors'

const selectCls =
  'w-full px-3 py-2.5 text-sm rounded-lg border border-[#E2E8F0] bg-white text-[#1E293B] focus:outline-none focus:border-[#CC1133] transition-colors'

// ─── Tree View Types ──────────────────────────────────────────────────────────

type TreeLedger = {
  id: string
  ledgerCode: string
  ledgerName: string
  openingBalance: string
  runningBalance: string
  balanceType: 'debit' | 'credit'
  isActive: boolean
  allowManualEntry: boolean
  gstApplicable: boolean
  tdsApplicable: boolean
}

type SubGroup = {
  id: string
  name: string
  code: string
  ledgers: TreeLedger[]
}

type Group = {
  id: string
  name: string
  code: string
  subGroups: SubGroup[]
}

type MajorHead = {
  id: string
  name: string
  code: string
  groups: Group[]
}

type AccountType = {
  id: string
  name: string
  code: string
  normalBalance: 'debit' | 'credit'
  majorHeads: MajorHead[]
}

// ─── Flat List Types ──────────────────────────────────────────────────────────

type FlatLedger = {
  id: string
  ledgerCode: string
  ledgerName: string
  balanceType: 'debit' | 'credit'
  isActive: boolean
  allowManualEntry: boolean
  gstApplicable: boolean
  tdsApplicable: boolean
  runningBalance: string
  openingBalance: string
  subGroupId: string
  subGroupCode: string
  subGroupName: string
  groupId: string
  groupCode: string
  groupName: string
  majorHeadId: string
  majorHeadCode: string
  majorHeadName: string
  accountTypeId: string
  accountTypeCode: string
  accountTypeName: string
  normalBalance: 'debit' | 'credit'
}

// ─── Tree View Helpers ────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  A:  { bg: '#EFF6FF', text: '#1D4ED8', badge: '#BFDBFE' },
  L:  { bg: '#FEF2F2', text: '#B91C1C', badge: '#FECACA' },
  EQ: { bg: '#F0FDF4', text: '#15803D', badge: '#BBF7D0' },
  I:  { bg: '#F0FDF4', text: '#047857', badge: '#A7F3D0' },
  EX: { bg: '#FFF7ED', text: '#C2410C', badge: '#FED7AA' },
}

function countLedgers(at: AccountType) {
  return at.majorHeads.reduce(
    (a, mh) => a + mh.groups.reduce(
      (b, g) => b + g.subGroups.reduce((c, sg) => c + sg.ledgers.length, 0),
      0
    ),
    0
  )
}

// ─── Tree Sub-components ──────────────────────────────────────────────────────

function LedgerRow({ l }: { l: TreeLedger }) {
  const tags = [
    l.gstApplicable && 'GST',
    l.tdsApplicable && 'TDS',
    !l.allowManualEntry && 'Auto',
  ].filter(Boolean) as string[]

  return (
    <div className="flex items-center gap-3 px-4 py-2 text-xs" style={{ borderBottom: '1px solid #F8FAFC' }}>
      <span className="w-20 font-mono text-[#94A3B8]">{l.ledgerCode}</span>
      <span className="flex-1 text-[#374151]">{l.ledgerName}</span>
      <div className="flex gap-1">
        {tags.map(t => (
          <span key={t} className="px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{ background: '#F1F5F9', color: '#64748B' }}>
            {t}
          </span>
        ))}
      </div>
      <span className="text-[#94A3B8] capitalize">{l.balanceType}</span>
      <span className="font-mono text-xs font-semibold" style={{ color: Number(l.runningBalance) !== 0 ? '#1E293B' : '#CBD5E1' }}>
        ₹ {Number(l.runningBalance).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
      </span>
      {!l.isActive && (
        <span className="px-1.5 py-0.5 rounded text-[10px]"
          style={{ background: '#FEE2E2', color: '#B91C1C' }}>Inactive</span>
      )}
    </div>
  )
}

function SubGroupRow({ sg, depth }: { sg: SubGroup; depth: number }) {
  const [open, setOpen] = useState(true)
  const pl = 16 + depth * 20

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 py-1.5 text-xs hover:bg-[#F8FAFC] transition-colors"
        style={{ paddingLeft: pl, borderBottom: '1px solid #F1F5F9' }}
      >
        <span style={{ color: '#CBD5E1', fontSize: 10 }}>{open ? '▼' : '▶'}</span>
        <span className="font-mono text-[#94A3B8] w-28">{sg.code}</span>
        <span className="text-[#4B5563]">{sg.name}</span>
        <span className="ml-auto text-[#CBD5E1] pr-4">{sg.ledgers.length} ledger{sg.ledgers.length !== 1 ? 's' : ''}</span>
      </button>
      {open && sg.ledgers.map(l => (
        <div key={l.id} style={{ paddingLeft: pl + 12 }}>
          <LedgerRow l={l} />
        </div>
      ))}
    </div>
  )
}

function GroupRow({ g, depth }: { g: Group; depth: number }) {
  const [open, setOpen] = useState(true)
  const pl = 12 + depth * 20

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 py-2 text-xs font-medium hover:bg-[#F8FAFC] transition-colors"
        style={{ paddingLeft: pl, borderBottom: '1px solid #F1F5F9', color: '#374151' }}
      >
        <span style={{ color: '#CBD5E1', fontSize: 10 }}>{open ? '▼' : '▶'}</span>
        <span className="font-mono text-[#94A3B8] w-28">{g.code}</span>
        <span>{g.name}</span>
        <span className="ml-auto text-[#CBD5E1] pr-4 font-normal">{g.subGroups.length} sub-group{g.subGroups.length !== 1 ? 's' : ''}</span>
      </button>
      {open && g.subGroups.map(sg => (
        <SubGroupRow key={sg.id} sg={sg} depth={depth + 1} />
      ))}
    </div>
  )
}

function MajorHeadRow({ mh }: { mh: MajorHead }) {
  const [open, setOpen] = useState(true)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold hover:bg-[#F1F5F9] transition-colors"
        style={{ borderBottom: '1px solid #E2E8F0', color: '#1E293B', background: '#F8FAFC' }}
      >
        <span style={{ color: '#94A3B8', fontSize: 11 }}>{open ? '▼' : '▶'}</span>
        <span className="font-mono text-[#94A3B8] text-xs w-24">{mh.code}</span>
        <span>{mh.name}</span>
        <span className="ml-auto text-xs text-[#94A3B8] font-normal">{mh.groups.length} group{mh.groups.length !== 1 ? 's' : ''}</span>
      </button>
      {open && mh.groups.map(g => (
        <GroupRow key={g.id} g={g} depth={0} />
      ))}
    </div>
  )
}

function AccountTypeCard({ at }: { at: AccountType }) {
  const [open, setOpen] = useState(true)
  const colors = TYPE_COLORS[at.code] ?? { bg: '#F8FAFC', text: '#1E293B', badge: '#E2E8F0' }
  const ledgerCount = countLedgers(at)

  return (
    <div className="fp-card overflow-hidden mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
        style={{ background: colors.bg, borderBottom: open ? `1px solid ${colors.badge}` : undefined }}
      >
        <span className="text-base font-bold" style={{ color: colors.text }}>{open ? '▼' : '▶'}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold" style={{ color: colors.text }}>{at.name}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold"
              style={{ background: colors.badge, color: colors.text }}>
              {at.code}
            </span>
            <span className="text-xs capitalize px-2 py-0.5 rounded"
              style={{ background: '#F1F5F9', color: '#64748B' }}>
              Normal: {at.normalBalance}
            </span>
          </div>
        </div>
        <div className="text-right text-xs" style={{ color: colors.text }}>
          <div className="font-semibold">{ledgerCount} ledgers</div>
          <div style={{ color: '#94A3B8' }}>{at.majorHeads.length} major heads</div>
        </div>
      </button>
      {open && (
        <div>
          {at.majorHeads.map(mh => (
            <MajorHeadRow key={mh.id} mh={mh} />
          ))}
          {at.majorHeads.length === 0 && (
            <div className="py-6 text-center text-xs" style={{ color: '#94A3B8' }}>No accounts yet.</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Create Ledger Dialog ─────────────────────────────────────────────────────

type CreateDialogProps = {
  tree: AccountType[]
  onClose: () => void
  onSuccess: () => void
}

function CreateLedgerDialog({ tree, onClose, onSuccess }: CreateDialogProps) {
  const [selectedTypeId, setSelectedTypeId] = useState('')
  const [selectedMajorHeadId, setSelectedMajorHeadId] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [selectedSubGroupId, setSelectedSubGroupId] = useState('')
  const [ledgerName, setLedgerName] = useState('')
  const [balanceType, setBalanceType] = useState<'debit' | 'credit'>('debit')
  const [allowManualEntry, setAllowManualEntry] = useState(true)
  const [gstApplicable, setGstApplicable] = useState(false)
  const [tdsApplicable, setTdsApplicable] = useState(false)
  const [openingBalance, setOpeningBalance] = useState('0')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const selectedType = tree.find(t => t.id === selectedTypeId)
  const majorHeads = selectedType?.majorHeads ?? []
  const selectedMajorHead = majorHeads.find(mh => mh.id === selectedMajorHeadId)
  const groups = selectedMajorHead?.groups ?? []
  const selectedGroup = groups.find(g => g.id === selectedGroupId)
  const subGroups = selectedGroup?.subGroups ?? []

  // When account type changes, reset cascade and set default balanceType
  const handleTypeChange = (typeId: string) => {
    setSelectedTypeId(typeId)
    setSelectedMajorHeadId('')
    setSelectedGroupId('')
    setSelectedSubGroupId('')
    const t = tree.find(x => x.id === typeId)
    if (t) setBalanceType(t.normalBalance)
  }

  const handleMajorHeadChange = (mhId: string) => {
    setSelectedMajorHeadId(mhId)
    setSelectedGroupId('')
    setSelectedSubGroupId('')
  }

  const handleGroupChange = (gId: string) => {
    setSelectedGroupId(gId)
    setSelectedSubGroupId('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSubGroupId) { setError('Please select a sub-group.'); return }
    if (!ledgerName.trim()) { setError('Ledger name is required.'); return }

    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/master/chart-of-accounts/flat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subGroupId: selectedSubGroupId,
          ledgerName: ledgerName.trim(),
          balanceType,
          allowManualEntry,
          gstApplicable,
          tdsApplicable,
          openingBalance: parseFloat(openingBalance) || 0,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to create ledger')
      }
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create ledger')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <h2 className="text-base font-semibold text-[#1E293B]">Create Ledger</h2>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#374151] transition-colors text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2.5 rounded-lg bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-sm">{error}</div>
          )}

          {/* Cascading selects */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">Account Type <span className="text-[#CC1133]">*</span></label>
              <select className={selectCls} value={selectedTypeId} onChange={e => handleTypeChange(e.target.value)} required>
                <option value="">Select type…</option>
                {tree.map(t => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">Major Head <span className="text-[#CC1133]">*</span></label>
              <select className={selectCls} value={selectedMajorHeadId} onChange={e => handleMajorHeadChange(e.target.value)} required disabled={!selectedTypeId}>
                <option value="">Select major head…</option>
                {majorHeads.map(mh => <option key={mh.id} value={mh.id}>{mh.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">Group <span className="text-[#CC1133]">*</span></label>
              <select className={selectCls} value={selectedGroupId} onChange={e => handleGroupChange(e.target.value)} required disabled={!selectedMajorHeadId}>
                <option value="">Select group…</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">Sub Group <span className="text-[#CC1133]">*</span></label>
              <select className={selectCls} value={selectedSubGroupId} onChange={e => setSelectedSubGroupId(e.target.value)} required disabled={!selectedGroupId}>
                <option value="">Select sub-group…</option>
                {subGroups.map(sg => <option key={sg.id} value={sg.id}>{sg.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Ledger Name <span className="text-[#CC1133]">*</span></label>
            <input
              type="text"
              className={inputCls}
              placeholder="e.g. Cash in Hand"
              value={ledgerName}
              onChange={e => setLedgerName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">Balance Type</label>
              <select className={selectCls} value={balanceType} onChange={e => setBalanceType(e.target.value as 'debit' | 'credit')}>
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">Opening Balance</label>
              <input
                type="number"
                className={inputCls}
                value={openingBalance}
                onChange={e => setOpeningBalance(e.target.value)}
                step="0.01"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-[#374151] cursor-pointer select-none">
              <input type="checkbox" checked={allowManualEntry} onChange={e => setAllowManualEntry(e.target.checked)}
                className="w-4 h-4 rounded border-[#E2E8F0] accent-[#CC1133]" />
              Allow Manual Entry
            </label>
            <label className="flex items-center gap-2 text-sm text-[#374151] cursor-pointer select-none">
              <input type="checkbox" checked={gstApplicable} onChange={e => setGstApplicable(e.target.checked)}
                className="w-4 h-4 rounded border-[#E2E8F0] accent-[#CC1133]" />
              GST Applicable
            </label>
            <label className="flex items-center gap-2 text-sm text-[#374151] cursor-pointer select-none">
              <input type="checkbox" checked={tdsApplicable} onChange={e => setTdsApplicable(e.target.checked)}
                className="w-4 h-4 rounded border-[#E2E8F0] accent-[#CC1133]" />
              TDS Applicable
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2" style={{ borderTop: '1px solid #E2E8F0' }}>
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg font-medium bg-[#F1F5F9] text-[#374151] border border-[#E2E8F0] hover:bg-[#E2E8F0] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="px-5 py-2 text-sm rounded-lg font-medium bg-[#CC1133] text-white hover:bg-[#A50F28] transition-colors disabled:opacity-50">
              {submitting ? 'Creating…' : 'Create Ledger'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Edit Ledger Dialog ───────────────────────────────────────────────────────

type EditDialogProps = {
  ledger: FlatLedger
  onClose: () => void
  onSuccess: () => void
}

function EditLedgerDialog({ ledger, onClose, onSuccess }: EditDialogProps) {
  const [ledgerName, setLedgerName] = useState(ledger.ledgerName)
  const [isActive, setIsActive] = useState(ledger.isActive)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ledgerName.trim()) { setError('Ledger name is required.'); return }

    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/master/chart-of-accounts/${ledger.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ledgerName: ledgerName.trim(), isActive }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to update ledger')
      }
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update ledger')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <h2 className="text-base font-semibold text-[#1E293B]">Edit Ledger</h2>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#374151] transition-colors text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2.5 rounded-lg bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-sm">{error}</div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Ledger Code</label>
            <div className="px-3 py-2.5 text-sm rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8] font-mono">
              {ledger.ledgerCode}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Sub Group</label>
            <div className="px-3 py-2.5 text-sm rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8]">
              {ledger.subGroupName} / {ledger.groupName} / {ledger.accountTypeName}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Ledger Name <span className="text-[#CC1133]">*</span></label>
            <input
              type="text"
              className={inputCls}
              value={ledgerName}
              onChange={e => setLedgerName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-2">Status</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsActive(true)}
                className={`px-4 py-2 text-sm rounded-lg font-medium border transition-colors ${
                  isActive
                    ? 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]'
                    : 'bg-[#F1F5F9] text-[#374151] border-[#E2E8F0] hover:bg-[#E2E8F0]'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setIsActive(false)}
                className={`px-4 py-2 text-sm rounded-lg font-medium border transition-colors ${
                  !isActive
                    ? 'bg-[#F1F5F9] text-[#374151] border-[#94A3B8]'
                    : 'bg-[#F1F5F9] text-[#94A3B8] border-[#E2E8F0] hover:bg-[#E2E8F0]'
                }`}
              >
                Inactive
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2" style={{ borderTop: '1px solid #E2E8F0' }}>
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg font-medium bg-[#F1F5F9] text-[#374151] border border-[#E2E8F0] hover:bg-[#E2E8F0] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="px-5 py-2 text-sm rounded-lg font-medium bg-[#CC1133] text-white hover:bg-[#A50F28] transition-colors disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Table View ───────────────────────────────────────────────────────────────

type TableViewProps = {
  ledgers: FlatLedger[]
  loading: boolean
  tree: AccountType[]
  onRefresh: () => void
}

function TableView({ ledgers, loading, tree, onRefresh }: TableViewProps) {
  const [search, setSearch] = useState('')
  const [filterTypeCode, setFilterTypeCode] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editLedger, setEditLedger] = useState<FlatLedger | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  // Collect unique account types from ledgers
  const accountTypes = useMemo(() => {
    const seen = new Map<string, string>()
    for (const l of ledgers) {
      if (!seen.has(l.accountTypeCode)) seen.set(l.accountTypeCode, l.accountTypeName)
    }
    return Array.from(seen.entries()).map(([code, name]) => ({ code, name }))
  }, [ledgers])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return ledgers.filter(l => {
      if (q && !l.ledgerName.toLowerCase().includes(q) && !l.ledgerCode.toLowerCase().includes(q)) return false
      if (filterTypeCode && l.accountTypeCode !== filterTypeCode) return false
      if (filterStatus === 'active' && !l.isActive) return false
      if (filterStatus === 'inactive' && l.isActive) return false
      return true
    })
  }, [ledgers, search, filterTypeCode, filterStatus])

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const handleCreateSuccess = () => {
    setShowCreate(false)
    onRefresh()
    showSuccess('Ledger created successfully.')
  }

  const handleEditSuccess = () => {
    setEditLedger(null)
    onRefresh()
    showSuccess('Ledger updated successfully.')
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <input
            type="search"
            className={inputCls}
            placeholder="Search by name or code…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2.5 text-sm rounded-lg border border-[#E2E8F0] bg-white text-[#1E293B] focus:outline-none focus:border-[#CC1133] transition-colors"
          value={filterTypeCode}
          onChange={e => setFilterTypeCode(e.target.value)}
        >
          <option value="">All Types</option>
          {accountTypes.map(t => (
            <option key={t.code} value={t.code}>{t.name}</option>
          ))}
        </select>
        <select
          className="px-3 py-2.5 text-sm rounded-lg border border-[#E2E8F0] bg-white text-[#1E293B] focus:outline-none focus:border-[#CC1133] transition-colors"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 text-sm rounded-lg font-medium bg-[#CC1133] text-white hover:bg-[#A50F28] transition-colors whitespace-nowrap"
        >
          + Create Ledger
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-[#DCFCE7] border border-[#86EFAC] text-[#15803D] text-sm">{successMsg}</div>
      )}

      {/* Table */}
      <div className="fp-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Ledger Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Ledger Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Sub Group</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Group</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Account Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748B]">Bal. Type</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748B]">Balance</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#64748B]">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#64748B]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-[#94A3B8]">Loading…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-[#94A3B8]">No ledgers found.</td>
                </tr>
              ) : filtered.map((l, idx) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #F1F5F9', background: idx % 2 === 0 ? '#fff' : '#FAFAFA' }}
                  className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-[#94A3B8]">{l.ledgerCode}</td>
                  <td className="px-4 py-3 text-[#1E293B] font-medium">{l.ledgerName}</td>
                  <td className="px-4 py-3 text-[#374151]">{l.subGroupName}</td>
                  <td className="px-4 py-3 text-[#374151]">{l.groupName}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        background: TYPE_COLORS[l.accountTypeCode]?.badge ?? '#F1F5F9',
                        color: TYPE_COLORS[l.accountTypeCode]?.text ?? '#374151',
                      }}>
                      {l.accountTypeCode}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize text-xs text-[#64748B]">{l.balanceType}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-semibold"
                    style={{ color: Number(l.runningBalance) !== 0 ? '#1E293B' : '#CBD5E1' }}>
                    ₹ {Number(l.runningBalance).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {l.isActive ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#DCFCE7] text-[#15803D]">Active</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#F1F5F9] text-[#64748B]">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setEditLedger(l)}
                      title="Edit ledger"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[#F1F5F9] transition-colors text-[#64748B] hover:text-[#CC1133]"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-2.5 text-xs text-[#94A3B8]" style={{ borderTop: '1px solid #F1F5F9' }}>
            Showing {filtered.length} of {ledgers.length} ledgers
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateLedgerDialog
          tree={tree}
          onClose={() => setShowCreate(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
      {editLedger && (
        <EditLedgerDialog
          ledger={editLedger}
          onClose={() => setEditLedger(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChartOfAccountsPage() {
  const [activeTab, setActiveTab] = useState<'table' | 'tree'>('table')

  // Flat ledger data (for table view)
  const [ledgers, setLedgers] = useState<FlatLedger[]>([])
  const [ledgersLoading, setLedgersLoading] = useState(true)
  const [ledgersError, setLedgersError] = useState('')

  // Tree data (for tree view + create dialog cascade)
  const [tree, setTree] = useState<AccountType[]>([])
  const [treeLoading, setTreeLoading] = useState(true)
  const [treeError, setTreeError] = useState('')

  const loadLedgers = useCallback(async () => {
    setLedgersLoading(true)
    setLedgersError('')
    try {
      const data = await fetch('/api/master/chart-of-accounts/flat').then(r => {
        if (!r.ok) throw new Error('Failed to load ledgers')
        return r.json()
      })
      setLedgers(Array.isArray(data) ? data : [])
    } catch {
      setLedgersError('Failed to load ledgers.')
    }
    setLedgersLoading(false)
  }, [])

  const loadTree = useCallback(async () => {
    setTreeLoading(true)
    setTreeError('')
    try {
      const data = await fetch('/api/master/chart-of-accounts').then(r => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      setTree(Array.isArray(data) ? data : [])
    } catch {
      setTreeError('Failed to load Chart of Accounts.')
    }
    setTreeLoading(false)
  }, [])

  useEffect(() => {
    loadLedgers()
    loadTree()
  }, [loadLedgers, loadTree])

  const totalLedgers = ledgers.length
  const activeCount = ledgers.filter(l => l.isActive).length

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <Link href="/master" className="text-sm hover:underline" style={{ color: '#64748B' }}>← Master Data</Link>
        <span style={{ color: '#E2E8F0' }}>/</span>
        <h1 className="text-xl font-bold text-[#1E293B]">Chart of Accounts</h1>
      </div>
      <p className="text-sm mb-5" style={{ color: '#94A3B8' }}>
        Manage your account hierarchy, create ledgers, and configure account settings.
      </p>

      {/* Stats */}
      {!ledgersLoading && !ledgersError && (
        <div className="flex gap-4 mb-6">
          {[
            { label: 'Total Ledgers', value: totalLedgers },
            { label: 'Active', value: activeCount },
            { label: 'Inactive', value: totalLedgers - activeCount },
          ].map(s => (
            <div key={s.label} className="fp-card px-5 py-3 flex flex-col gap-0.5">
              <span className="text-xl font-bold text-[#1E293B]">{s.value}</span>
              <span className="text-xs" style={{ color: '#94A3B8' }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5" style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: 0 }}>
        {(['table', 'tree'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2.5 text-sm font-medium transition-colors capitalize"
            style={{
              borderBottom: activeTab === tab ? '2px solid #CC1133' : '2px solid transparent',
              color: activeTab === tab ? '#CC1133' : '#64748B',
              marginBottom: -1,
            }}
          >
            {tab === 'table' ? 'Table View' : 'Tree View'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'table' && (
        <>
          {ledgersError && (
            <div className="mb-4 px-4 py-3 bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-sm rounded-xl">{ledgersError}</div>
          )}
          <TableView
            ledgers={ledgers}
            loading={ledgersLoading}
            tree={tree}
            onRefresh={loadLedgers}
          />
        </>
      )}

      {activeTab === 'tree' && (
        <>
          {treeError && (
            <div className="mb-4 px-4 py-3 bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-sm rounded-xl">{treeError}</div>
          )}
          {treeLoading ? (
            <div className="py-16 text-center text-sm" style={{ color: '#94A3B8' }}>Loading…</div>
          ) : tree.length === 0 && !treeError ? (
            <div className="fp-card py-16 text-center text-sm" style={{ color: '#94A3B8' }}>
              No accounts seeded yet. Run <code className="font-mono bg-[#F1F5F9] px-1 rounded">npm run seed:coa</code> to populate.
            </div>
          ) : (
            tree.map(at => <AccountTypeCard key={at.id} at={at} />)
          )}
        </>
      )}
    </div>
  )
}

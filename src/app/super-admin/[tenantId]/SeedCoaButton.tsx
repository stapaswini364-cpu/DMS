'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SeedCoaButton({ tenantId }: { tenantId: string }) {
  const router = useRouter()
  const [seeding, setSeeding] = useState(false)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')

  async function handleClick() {
    setError('')
    setSuccess('')
    setSeeding(true)

    const res = await fetch(`/api/super-admin/tenants/${tenantId}/seed-coa`, { method: 'POST' })
    const body = await res.json().catch(() => ({})) as {
      error?: string
      seeded?: boolean
      alreadySeeded?: boolean
      ledgerCount?: number
    }
    setSeeding(false)

    if (!res.ok) {
      setError(body.error ?? 'Failed to seed Chart of Accounts')
      return
    }

    if (body.alreadySeeded) {
      setSuccess(`Chart of Accounts was already seeded (${body.ledgerCount} ledgers).`)
    } else {
      setSuccess(`Chart of Accounts seeded — ${body.ledgerCount} ledgers created.`)
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          onClick={handleClick}
          disabled={seeding}
          className="fp-btn-primary disabled:opacity-50"
          style={{ padding: '8px 14px', fontSize: '12px' }}
        >
          {seeding ? 'Seeding…' : 'Seed Chart of Accounts'}
        </button>
        <span className="text-xs" style={{ color: '#94A3B8' }}>
          Creates the 16 default ledgers required for sales, service, MRN and voucher posting.
        </span>
      </div>
      {success && (
        <div className="px-3 py-2 bg-[#DCFCE7] border border-[#BBF7D0] text-[#15803D] text-xs rounded-lg">
          ✓ {success}
        </div>
      )}
      {error && (
        <div className="px-3 py-2 bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-xs rounded-lg">
          {error}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/app/components/ui/Button'
import Input from '@/app/components/ui/Input'

export default function AddDealershipForm() {
  const router = useRouter()

  const [open,       setOpen]       = useState(false)
  const [name,       setName]       = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminName,  setAdminName]  = useState('')
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState('')
  const [saving,     setSaving]     = useState(false)

  function reset() {
    setName('')
    setAdminEmail('')
    setAdminName('')
    setError('')
    setSuccess('')
  }

  function handleClose() {
    setOpen(false)
    reset()
  }

  async function handleSave() {
    setError('')
    setSuccess('')

    if (!name.trim())       { setError('Dealership name is required.'); return }
    if (!adminEmail.trim()) { setError('Admin email is required.');     return }

    setSaving(true)
    try {
      const res = await fetch('/api/super-admin/tenants', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:       name.trim(),
          adminEmail: adminEmail.trim(),
          adminName:  adminName.trim(),
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error ?? 'Failed to create dealership.')
        return
      }

      setSuccess(
        `Dealership created. Invite sent to ${data.adminEmail}.` +
        (!data.inviteSent ? ' (Note: invitation email could not be delivered.)' : ''),
      )
      router.refresh()
      // Auto-close after a short delay so the user can read the success message
      setTimeout(() => handleClose(), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {!open && (
        <Button label="Add New Dealership" variant="primary" onClick={() => setOpen(true)} />
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Add New Dealership</h2>
            <p className="text-sm text-gray-500 -mt-2">
              A Clerk organisation will be created automatically and an invite
              sent to the admin email.
            </p>

            <Input
              label="Dealership Name *"
              placeholder="e.g. Sunrise Motors"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Admin Email *"
              placeholder="dealer@example.com"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
            />
            <Input
              label="Admin Name (optional)"
              placeholder="Full name of the admin"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
            />

            {error   && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            {success && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{success}</p>}

            <div className="flex gap-3 justify-end pt-2">
              <Button
                label="Cancel"
                variant="secondary"
                onClick={handleClose}
              />
              <Button
                label={saving ? 'Creating…' : 'Create & Invite'}
                variant="primary"
                onClick={handleSave}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { companySettings } from '@/db/schema/auth'
import { requireTenant } from '@/lib/api-auth'
import { uploadTenantLogo, ALLOWED_MIMES, MAX_BYTES, mimeToExt } from '@/lib/tenant-logo-storage'

// POST /api/company-settings/logo
// Body: multipart/form-data with field "file"
// Uploads the tenant's logo to Supabase Storage and persists the public URL
// on company_settings.logoUrl. Only admins (via requireTenant) can call this.
export async function POST(req: NextRequest) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  try {
    const form = await req.formData()
    const file = form.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Upload must include a "file" field' }, { status: 400 })
    }
    if (!ALLOWED_MIMES.includes(file.type.toLowerCase())) {
      return NextResponse.json(
        { error: `Unsupported image type "${file.type}". Allowed: PNG, JPG, WebP.` },
        { status: 400 },
      )
    }
    if (!mimeToExt(file.type)) {
      return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File is ${(file.size / 1024 / 1024).toFixed(2)} MB — must be under 2 MB` },
        { status: 400 },
      )
    }

    const bytes = await file.arrayBuffer()
    const publicUrl = await uploadTenantLogo({
      tenantId: tenant.id,
      mime:     file.type,
      bytes,
    })

    const now = new Date()
    await db
      .insert(companySettings)
      .values({
        tenantId:     tenant.id,
        logoUrl:      publicUrl,
        fyStartMonth: 4,
        fyStartDay:   1,
        updatedAt:    now,
      })
      .onConflictDoUpdate({
        target: companySettings.tenantId,
        set:    { logoUrl: publicUrl, updatedAt: now },
      })

    return NextResponse.json({ logoUrl: publicUrl }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[company-settings/logo] upload failed:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/company-settings/logo
// Clears logo_url only (leaves the file in storage; a later upload with the
// same extension will overwrite it via x-upsert).
export async function DELETE() {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const now = new Date()
  await db
    .update(companySettings)
    .set({ logoUrl: null, updatedAt: now })
    .where(eq(companySettings.tenantId, tenant.id))

  return NextResponse.json({ ok: true })
}

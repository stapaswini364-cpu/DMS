/**
 * Uploads a tenant logo to Supabase Storage via the REST API and returns the
 * public URL. Used server-side only — the service-role key must never reach
 * the client.
 *
 * Requires the following environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL       — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY      — service-role key (secret; server-only)
 *
 * Assumes a bucket named `tenant-logos` exists with public-read access.
 */

const BUCKET = 'tenant-logos'

const MIME_TO_EXT: Record<string, string> = {
  'image/png':  'png',
  'image/jpeg': 'jpg',
  'image/jpg':  'jpg',
  'image/webp': 'webp',
}

export const ALLOWED_MIMES = Object.keys(MIME_TO_EXT)
export const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

export function mimeToExt(mime: string): string | null {
  return MIME_TO_EXT[mime.toLowerCase()] ?? null
}

function requireEnv(): { supabaseUrl: string; serviceKey: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  if (!serviceKey)  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return { supabaseUrl, serviceKey }
}

export async function uploadTenantLogo(params: {
  tenantId: string
  mime:     string
  bytes:    ArrayBuffer
}): Promise<string> {
  const { tenantId, mime, bytes } = params
  const { supabaseUrl, serviceKey } = requireEnv()

  const ext  = mimeToExt(mime)
  if (!ext) throw new Error(`Unsupported image type: ${mime}`)

  const path = `${tenantId}/logo.${ext}`
  const url  = `${supabaseUrl}/storage/v1/object/${BUCKET}/${path}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': mime,
      'x-upsert':     'true',
      'cache-control': 'public, max-age=60',
    },
    body: bytes,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Supabase upload failed (${res.status}): ${detail || res.statusText}`)
  }

  // Cache-buster: file path is stable per tenant (logo.png), so browsers cache
  // it. Appending a version query on the URL forces a refetch after replace.
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}?v=${Date.now()}`
}

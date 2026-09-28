import type { NextRequest } from 'next/server'

export function getAppOrigin(req: NextRequest): string {
  const override = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (override) return override.replace(/\/$/, '')
  return req.nextUrl.origin
}

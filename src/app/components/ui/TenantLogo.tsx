'use client'

import { useEffect, useState } from 'react'

type Size = 'sm' | 'md'

/**
 * Renders the current tenant's uploaded logo, or a colored-initials fallback
 * when no logo is set. Fetches /api/company-settings once on mount and caches
 * the URL in module memory to avoid refetching on every remount.
 */

// Module-level cache so switching pages doesn't re-fetch. Cleared when the
// user switches orgs (TopNav re-renders and we key the component on org id).
const cache: { orgKey: string | null; logoUrl: string | null } = {
  orgKey: null,
  logoUrl: null,
}

const PALETTE = ['#CC1133', '#2563EB', '#7C3AED', '#16A34A', '#D97706', '#DB2777']
function colorFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

export default function TenantLogo({
  orgKey,
  orgName,
  size = 'md',
}: {
  orgKey:  string
  orgName: string
  size?:   Size
}) {
  const cached = cache.orgKey === orgKey
  const [logoUrl, setLogoUrl] = useState<string | null>(cached ? cache.logoUrl : null)
  const [loaded,  setLoaded]  = useState(cached)

  useEffect(() => {
    if (cache.orgKey === orgKey) return
    let cancelled = false
    fetch('/api/company-settings')
      .then(r => r.ok ? r.json() : null)
      .then((d: { logoUrl?: string | null } | null) => {
        if (cancelled) return
        const url = d?.logoUrl ?? null
        cache.orgKey  = orgKey
        cache.logoUrl = url
        setLogoUrl(url)
        setLoaded(true)
      })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [orgKey])

  const px = size === 'sm' ? 22 : 28

  if (!loaded) {
    return (
      <span
        aria-hidden
        style={{
          width: px, height: px,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 6,
          display: 'inline-block',
        }}
      />
    )
  }

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`${orgName} logo`}
        style={{ height: px, width: 'auto', maxWidth: px * 2.4, objectFit: 'contain', borderRadius: 4 }}
      />
    )
  }

  return (
    <span
      aria-hidden
      style={{
        width: px, height: px,
        borderRadius: 6,
        background: colorFor(orgKey),
        color: 'white',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size === 'sm' ? 10 : 11,
        fontWeight: 700,
        letterSpacing: 0.5,
        flexShrink: 0,
      }}
      title={orgName}
    >
      {initialsOf(orgName)}
    </span>
  )
}

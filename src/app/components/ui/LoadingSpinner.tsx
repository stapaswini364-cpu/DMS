'use client'

export default function LoadingSpinner({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`animate-spin ${className}`}
      aria-label="Loading"
    >
      <circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.08)" strokeWidth="3" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="#CC1133"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

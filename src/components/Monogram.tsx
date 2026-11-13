import { useId } from 'react'

type MonogramProps = {
  size?: number
  className?: string
  /** Accessible name. Leave undefined when the monogram is decorative. */
  label?: string
  variant?: 'mark' | 'seal'
}

/**
 * The custom J&M monogram: two initials of equal weight inside a Magic Shop-style doorway,
 * with the shared seventh star at the top of the arch.
 */
export function Monogram({ size = 40, className, label, variant = 'mark' }: MonogramProps) {
  const decorative = !label
  // Several seals can be on the page at once (door, letter, finale): each needs its own gradient id.
  const wax = `seal-wax-${useId().replace(/:/g, '')}`
  if (variant === 'seal') {
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 120 120"
        role={decorative ? undefined : 'img'}
        aria-label={label}
        aria-hidden={decorative ? 'true' : undefined}
      >
        <defs>
          <radialGradient id={wax} cx="38%" cy="32%" r="75%">
            <stop offset="0" stopColor="#b98ff5" />
            <stop offset=".55" stopColor="#6a35a8" />
            <stop offset="1" stopColor="#3b1a5e" />
          </radialGradient>
        </defs>
        <path
          d="M60 4c9 0 12 6 20 8s15 1 20 8 2 13 5 21 9 11 9 19-6 11-9 19-1 14-5 21-12 6-20 8-11 8-20 8-12-6-20-8-15-1-20-8-2-13-5-21S6 68 6 60s6-11 9-19 1-14 5-21 12-6 20-8 11-8 20-8Z"
          fill={`url(#${wax})`}
        />
        <circle cx="60" cy="60" r="41" fill="none" stroke="#e7d7ff" strokeOpacity=".45" strokeWidth="1" />
        <path d="M40 92V55a20 20 0 0 1 40 0v37" fill="none" stroke="#f3e6c7" strokeOpacity=".8" strokeWidth="1.4" />
        <text x="51" y="80" textAnchor="middle" fontFamily="var(--font-display)" fontStyle="italic" fontSize="30" fill="#fff8f0">
          J
        </text>
        <text x="70" y="80" textAnchor="middle" fontFamily="var(--font-display)" fontStyle="italic" fontSize="30" fill="#fff8f0">
          M
        </text>
        <path d="M60 30c.4 3 1.9 4.5 4.9 4.9-3 .4-4.5 1.9-4.9 4.9-.4-3-1.9-4.5-4.9-4.9 3-.4 4.5-1.9 4.9-4.9Z" fill="#f3e6c7" />
      </svg>
    )
  }

  return (
    <svg
      className={className}
      width={size * 0.8}
      height={size}
      viewBox="0 0 64 80"
      role={decorative ? undefined : 'img'}
      aria-label={label}
      aria-hidden={decorative ? 'true' : undefined}
    >
      <path d="M8 77V32a24 24 0 0 1 48 0v45" fill="none" stroke="currentColor" strokeOpacity=".55" strokeWidth="1.3" />
      <path d="M13 77V33a19 19 0 0 1 38 0v44" fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="1" />
      <text x="25" y="62" textAnchor="middle" fontFamily="var(--font-display)" fontStyle="italic" fontWeight="500" fontSize="29" fill="currentColor">
        J
      </text>
      <text x="40.5" y="62" textAnchor="middle" fontFamily="var(--font-display)" fontStyle="italic" fontWeight="500" fontSize="29" fill="currentColor">
        M
      </text>
      <path
        className="monogram-star"
        d="M32 14c.5 3.6 2.4 5.5 6 6-3.6.5-5.5 2.4-6 6-.5-3.6-2.4-5.5-6-6 3.6-.5 5.5-2.4 6-6Z"
        fill="var(--c-champagne)"
      />
    </svg>
  )
}

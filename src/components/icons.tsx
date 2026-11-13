import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

/** Four-point concert star. */
export function StarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2.5c.6 4.6 2.9 6.9 7.5 7.5-4.6.6-6.9 2.9-7.5 7.5-.6-4.6-2.9-6.9-7.5-7.5 4.6-.6 6.9-2.9 7.5-7.5Z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** A small globe-topped lightstick. */
export function LightstickIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="5.2" />
      <path d="M9.6 13.2 10.4 21h3.2l.8-7.8" />
      <path d="M9.4 6.4c.9-1 2.3-1.4 3.6-1" opacity=".7" />
    </Svg>
  )
}

export function SoundOnIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
      <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" />
    </Svg>
  )
}

export function SoundOffIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
      <path d="m16 9.5 5 5m0-5-5 5" />
    </Svg>
  )
}

export function PlayIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
    </Svg>
  )
}

export function PauseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8.5 5.5v13M15.5 5.5v13" strokeWidth={2.4} />
    </Svg>
  )
}

export function ArrowIcon({ direction = 'right', ...props }: IconProps & { direction?: 'left' | 'right' | 'down' | 'up' }) {
  const rotate = { right: 0, down: 90, left: 180, up: 270 }[direction]
  // The individual `rotate` property composes with any CSS transform animation on the icon.
  return (
    <Svg {...props} style={{ rotate: `${rotate}deg`, ...(props.style ?? {}) }}>
      <path d="M4.5 12h14.5M13.5 6.5 19 12l-5.5 5.5" />
    </Svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Svg>
  )
}

export function MenuIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7.5h16M4 12h16M4 16.5h10" />
    </Svg>
  )
}

export function DownloadIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />
    </Svg>
  )
}

export function ReplayIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 4.5v4h4" />
    </Svg>
  )
}

export function CalmIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 14.5c2.2-2 4.3-2 6.5 0s4.3 2 6.5 0 2.9-1.6 4-1" />
      <path d="M3.5 9.5c2.2-2 4.3-2 6.5 0s4.3 2 6.5 0 2.9-1.6 4-1" opacity=".55" />
    </Svg>
  )
}

export function SparkleTrailIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M16 3.5c.4 2.6 1.6 3.8 4.2 4.2-2.6.4-3.8 1.6-4.2 4.2-.4-2.6-1.6-3.8-4.2-4.2 2.6-.4 3.8-1.6 4.2-4.2Z" fill="currentColor" stroke="none" />
      <path d="M4 20.5 10 14.5M6.5 21l2-2M3.5 17.5l2-2" />
    </Svg>
  )
}

export function EnvelopeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="6" width="17" height="12.5" rx="1.5" />
      <path d="m4 7 8 6.2L20 7" />
    </Svg>
  )
}

export function ExpandIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 4.5H4.5V9M15 4.5h4.5V9M9 19.5H4.5V15M15 19.5h4.5V15" />
    </Svg>
  )
}

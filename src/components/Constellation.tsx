import { forwardRef, useId } from 'react'
import data from '../config/constellation.json'

type Star = (typeof data.stars)[number]

const byId = Object.fromEntries(data.stars.map((s) => [s.id, s])) as Record<string, Star>
const [VW, VH] = data.viewBox

export type ConstellationState = 'apart' | 'near' | 'joined'

type Props = {
  className?: string
  /** Static pose for calm mode and small screens. Animated scenes drive the classes directly. */
  state?: ConstellationState
  /** Highlight one star (index into the seven stars), used on the photocards. */
  highlight?: number
  labels?: boolean
  showBeyond?: boolean
  title?: string
}

const segment = (a: string, b: string) => `M${byId[a].x} ${byId[a].y}L${byId[b].x} ${byId[b].y}`

export const JAMILA_PATH = `${segment('j1', 'j2')}L${byId.j3.x} ${byId.j3.y}`
export const MUSTAFA_PATH = `${segment('m1', 'm2')}L${byId.m3.x} ${byId.m3.y}`
export const JOIN_J = segment('j3', 'forever')
export const JOIN_M = segment('m3', 'forever')

/**
 * The couple's seven-star constellation: three stars on Jamila's path, three on Mustafa's,
 * and the seventh star where both paths meet. It recurs through the whole page.
 */
export const Constellation = forwardRef<SVGSVGElement, Props>(function Constellation(
  { className = '', state = 'joined', highlight, labels = false, showBeyond = true, title },
  ref,
) {
  const uid = useId().replace(/:/g, '')
  const glow = `cglow-${uid}`
  const line = `cline-${uid}`
  const shift = state === 'apart' ? 70 : state === 'near' ? 22 : 0
  return (
    <svg
      ref={ref}
      className={`constellation constellation--${state} ${className}`}
      viewBox={`0 0 ${VW} ${VH}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      <defs>
        <radialGradient id={glow}>
          <stop offset="0" stopColor="#fff8f0" stopOpacity="1" />
          <stop offset=".25" stopColor="#dcc8ff" stopOpacity=".85" />
          <stop offset=".6" stopColor="#a970ff" stopOpacity=".22" />
          <stop offset="1" stopColor="#a970ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={line} x1="0" x2="1">
          <stop offset="0" stopColor="#dcc8ff" stopOpacity=".2" />
          <stop offset=".5" stopColor="#fff8f0" stopOpacity=".95" />
          <stop offset="1" stopColor="#dcc8ff" stopOpacity=".2" />
        </linearGradient>
      </defs>

      {showBeyond && (
        <path
          className="c-beyond"
          d={`M${byId.forever.x} ${byId.forever.y - 16}L${data.beyond.x} ${data.beyond.y}`}
          stroke="#d8be91"
          strokeOpacity={state === 'joined' ? 0.6 : 0}
          strokeWidth="1.5"
          strokeDasharray="2 9"
          strokeLinecap="round"
          fill="none"
        />
      )}

      <g className="c-group c-group--jamila" transform={shift ? `translate(${-shift} 0)` : undefined}>
        <path className="c-line c-line--jamila" d={JAMILA_PATH} stroke={`url(#${line})`} />
        {state !== 'apart' && <path className="c-line c-line--join c-line--join-j" d={JOIN_J} stroke={`url(#${line})`} opacity={state === 'near' ? 0.25 : 1} />}
        {(['j1', 'j2', 'j3'] as const).map((id) => (
          <StarMark key={id} star={byId[id]} glow={glow} highlighted={highlight === data.stars.findIndex((s) => s.id === id)} />
        ))}
        {labels && (
          <text className="c-label c-label--jamila" x={byId.j1.x - 6} y={byId.j1.y + 50} textAnchor="start">
            Jamila
          </text>
        )}
      </g>

      <g className="c-group c-group--mustafa" transform={shift ? `translate(${shift} 0)` : undefined}>
        <path className="c-line c-line--mustafa" d={MUSTAFA_PATH} stroke={`url(#${line})`} />
        {state !== 'apart' && <path className="c-line c-line--join c-line--join-m" d={JOIN_M} stroke={`url(#${line})`} opacity={state === 'near' ? 0.25 : 1} />}
        {(['m1', 'm2', 'm3'] as const).map((id) => (
          <StarMark key={id} star={byId[id]} glow={glow} highlighted={highlight === data.stars.findIndex((s) => s.id === id)} />
        ))}
        {labels && (
          <text className="c-label c-label--mustafa" x={byId.m1.x + 6} y={byId.m1.y + 50} textAnchor="end">
            Mustafa
          </text>
        )}
      </g>

      <StarMark
        star={byId.forever}
        glow={glow}
        forever
        dim={state !== 'joined'}
        highlighted={highlight === data.stars.findIndex((s) => s.id === 'forever')}
      />
    </svg>
  )
})

function StarMark({ star, glow, forever = false, dim = false, highlighted = false }: { star: Star; glow: string; forever?: boolean; dim?: boolean; highlighted?: boolean }) {
  const r = star.r
  return (
    <g
      className={`c-star${forever ? ' c-star--forever' : ''}${highlighted ? ' is-highlighted' : ''}`}
      data-star={star.id}
      style={{ transformOrigin: `${star.x}px ${star.y}px`, transformBox: 'view-box' }}
      opacity={dim ? 0.35 : 1}
    >
      <circle className="c-star__glow" cx={star.x} cy={star.y} r={r * (forever ? 9 : 6)} fill={`url(#${glow})`} />
      <path
        className="c-star__spark"
        d={`M${star.x} ${star.y - r * 3.2}C${star.x + r * 0.4} ${star.y - r * 0.4} ${star.x + r * 0.4} ${star.y - r * 0.4} ${star.x + r * 3.2} ${star.y}C${star.x + r * 0.4} ${star.y + r * 0.4} ${star.x + r * 0.4} ${star.y + r * 0.4} ${star.x} ${star.y + r * 3.2}C${star.x - r * 0.4} ${star.y + r * 0.4} ${star.x - r * 0.4} ${star.y + r * 0.4} ${star.x - r * 3.2} ${star.y}C${star.x - r * 0.4} ${star.y - r * 0.4} ${star.x - r * 0.4} ${star.y - r * 0.4} ${star.x} ${star.y - r * 3.2}Z`}
        fill="#fff8f0"
      />
      <circle className="c-star__core" cx={star.x} cy={star.y} r={r * 0.8} fill="#fff8f0" />
    </g>
  )
}

export const STAR_ORDER = data.stars.map((s) => s.id)

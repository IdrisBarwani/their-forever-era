import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { STORY, type StoryBeatId } from '../config/site'
import {
  BEYOND,
  DUST,
  FIELD,
  FINAL_ARC,
  GUIDE,
  INITIALS_AT,
  JOURNEY,
  LINES,
  ORIGIN,
  SEVEN,
  SKY_H,
  SKY_W,
  STAR,
  sparkPath,
  type Point,
} from '../lib/storyGeometry'

const ORDER: StoryBeatId[] = ['before', 'his', 'hers', 'paths', 'forever']

type Person = 'mustafa' | 'jamila'

type Props = {
  /** The chapter this sky shows. */
  pose: StoryBeatId
  /**
   * Pinned desktop story: every element is rendered and GSAP owns visibility.
   * Otherwise the sky is a static pose (vertical sequence and calm mode).
   */
  stage?: boolean
  className?: string
}

const pct = (p: Point) => ({ left: `${(p.x / SKY_W) * 100}%`, top: `${(p.y / SKY_H) * 100}%` })

/**
 * The night sky of "Written in the Stars": two first lights, their paths, and the
 * constellation they make around the initials. Decorative SVG; the two named stars are
 * real buttons layered on top, so hover, focus and tap can reveal each name and birth date.
 */
export function StorySky({ pose, stage = false, className = '' }: Props) {
  const uid = useId().replace(/:/g, '')
  const at = ORDER.indexOf(pose)
  const has = (beat: StoryBeatId) => stage || at >= ORDER.indexOf(beat)
  /** Elements that first appear in this pose; the vertical sequence reveals only these. */
  const fresh = (beat: StoryBeatId) => (!stage && pose === beat ? { 'data-new': '' } : {})
  const ids = {
    warm: `sw-${uid}`,
    lilac: `sl-${uid}`,
    path: `sp-${uid}`,
    forever: `sf-${uid}`,
    bloom: `sb-${uid}`,
    riseJ: `rj-${uid}`,
    riseM: `rm-${uid}`,
    guide: `sg-${uid}`,
  }

  // Static poses: how far each journey has travelled, and whether it is still the bright head of the story.
  const travelled = pose === 'paths' ? JOURNEY.jamila.knots[2] : 1
  const travelledM = pose === 'paths' ? JOURNEY.mustafa.knots[2] : 1
  const dash = (len: number, f: number) => (stage || f >= 1 ? undefined : `${(len * f).toFixed(1)} ${(len * 2).toFixed(1)}`)

  return (
    <div className={`story-sky ${stage ? 'story-sky--stage' : `story-sky--${pose}`} ${className}`}>
      <svg className="story-sky__svg" viewBox={`0 0 ${SKY_W} ${SKY_H}`} aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={ids.warm}>
            <stop offset="0" stopColor="#fff8f0" />
            <stop offset=".22" stopColor="#f6e6c8" stopOpacity=".9" />
            <stop offset=".55" stopColor="#d8be91" stopOpacity=".32" />
            <stop offset="1" stopColor="#d8be91" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={ids.lilac}>
            <stop offset="0" stopColor="#fff8f0" />
            <stop offset=".22" stopColor="#dcc8ff" stopOpacity=".9" />
            <stop offset=".55" stopColor="#a970ff" stopOpacity=".3" />
            <stop offset="1" stopColor="#a970ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={ids.path}>
            <stop offset="0" stopColor="#fff8f0" />
            <stop offset=".3" stopColor="#dcc8ff" stopOpacity=".75" />
            <stop offset="1" stopColor="#a970ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={ids.forever}>
            <stop offset="0" stopColor="#fff8f0" />
            <stop offset=".2" stopColor="#efe5ff" stopOpacity=".95" />
            <stop offset=".5" stopColor="#a970ff" stopOpacity=".38" />
            <stop offset="1" stopColor="#a970ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={ids.bloom}>
            <stop offset="0" stopColor="#efe5ff" stopOpacity=".9" />
            <stop offset=".25" stopColor="#c39bff" stopOpacity=".5" />
            <stop offset=".6" stopColor="#7b48c4" stopOpacity=".18" />
            <stop offset="1" stopColor="#44206b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={ids.riseJ} gradientUnits="userSpaceOnUse" x1="0" y1={SKY_H} x2="0" y2={STAR.j1.y}>
            <stop offset="0" stopColor="#dcc8ff" stopOpacity="0" />
            <stop offset="1" stopColor="#efe5ff" stopOpacity=".9" />
          </linearGradient>
          <linearGradient id={ids.riseM} gradientUnits="userSpaceOnUse" x1="0" y1={SKY_H} x2="0" y2={STAR.m1.y}>
            <stop offset="0" stopColor="#d8be91" stopOpacity="0" />
            <stop offset="1" stopColor="#fff8f0" stopOpacity=".9" />
          </linearGradient>
          <linearGradient id={ids.guide} gradientUnits="userSpaceOnUse" x1="520" y1="0" x2={STAR.m1.x} y2={STAR.m1.y}>
            <stop offset="0" stopColor="#dcc8ff" stopOpacity="0" />
            <stop offset=".45" stopColor="#efe5ff" stopOpacity=".55" />
            <stop offset="1" stopColor="#fff8f0" stopOpacity=".85" />
          </linearGradient>
        </defs>

        {/* A quiet field of distant stars */}
        <g className="s-field">
          {FIELD.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={s.o} style={{ ['--d' as string]: `${s.d}s` }} />
          ))}
        </g>

        {(stage || pose === 'before' || pose === 'his') && (
          <path className="s-guide" d={GUIDE} stroke={`url(#${ids.guide})`} {...fresh('before')} opacity={!stage && pose === 'his' ? 0.3 : undefined} />
        )}

        {/* Where each first light rose into the sky */}
        {has('his') && <path className="s-origin s-origin--mustafa" d={ORIGIN.mustafa} stroke={`url(#${ids.riseM})`} {...fresh('his')} />}
        {has('hers') && <path className="s-origin s-origin--jamila" d={ORIGIN.jamila} stroke={`url(#${ids.riseJ})`} {...fresh('hers')} />}

        {/* The two journeys, curving toward each other */}
        {has('paths') && (
          <g className="s-journeys" {...fresh('paths')}>
            {(
              [
                ['jamila', JOURNEY.jamila, travelled],
                ['mustafa', JOURNEY.mustafa, travelledM],
              ] as const
            ).map(([who, j, f]) => (
              <g key={who} className={`s-trail s-trail--${who}`} opacity={!stage && pose === 'forever' ? 0.32 : undefined}>
                <path className="s-trail__glow" d={j.d} strokeDasharray={dash(j.length, f)} />
                <path className="s-trail__core" d={j.d} strokeDasharray={dash(j.length, f)} />
              </g>
            ))}
          </g>
        )}

        {/* Small stars lighting up along both paths */}
        {has('paths') && (
          <g className="s-dust">
            {(['jamila', 'mustafa'] as const).flatMap((who) =>
              DUST[who]
                .filter((d) => stage || pose === 'forever' || d.f <= (who === 'jamila' ? travelled : travelledM) + 0.001)
                .map((d, i) => (
                  <circle
                    key={`${who}-${i}`}
                    className={`s-dust__star s-dust__star--${who}`}
                    cx={d.x}
                    cy={d.y}
                    r={1.8}
                    data-f={d.f.toFixed(4)}
                    {...(!stage && (pose === 'paths' || (pose === 'forever' && d.f > JOURNEY[who].knots[2])) ? { 'data-new': '' } : {})}
                  />
                )),
            )}
          </g>
        )}

        {/* The finished constellation */}
        {has('forever') && (
          <g className="s-constellation" {...fresh('forever')}>
            <path className="s-beyond" d={`M${STAR.forever.x} ${STAR.forever.y - 18}L${BEYOND.x} ${BEYOND.y}`} />
            {[...LINES.jamila, ...LINES.mustafa].map((d, i) => (
              <path key={i} className={`s-line${i % 3 === 2 ? ' s-line--join' : ''}`} d={d} />
            ))}
            <path className="s-final" d={FINAL_ARC} />
          </g>
        )}

        {has('forever') && (
          <circle className="s-bloom" cx={STAR.forever.x} cy={STAR.forever.y} r="250" fill={`url(#${ids.bloom})`} {...fresh('forever')} />
        )}

        {has('forever') && (
          <text className="s-initials" x={INITIALS_AT.x} y={INITIALS_AT.y} textAnchor="middle" {...fresh('forever')}>
            J <tspan className="s-initials__amp">&amp;</tspan> M
          </text>
        )}

        {/* Stars on the paths */}
        {has('paths') &&
          (['j2', 'j3', 'm2', 'm3'] as const).map((id) => (
            <Mark key={id} className={`s-star s-star--path s-star--${id}`} p={STAR[id]} r={id.endsWith('2') ? 5.6 : 5} glow={ids.path} halo={6} fresh={!stage && pose === 'paths'} />
          ))}

        {has('forever') && <Mark className="s-star s-star--forever" p={STAR.forever} r={8.5} glow={ids.forever} halo={9} fresh={!stage && pose === 'forever'} />}

        {/* The two first lights */}
        {has('his') && <Mark className="s-star s-star--main s-star--mustafa" p={STAR.m1} r={7} glow={ids.warm} halo={8} fresh={!stage && pose === 'his'} />}
        {has('hers') && <Mark className="s-star s-star--main s-star--jamila" p={STAR.j1} r={6.6} glow={ids.lilac} halo={8} fresh={!stage && pose === 'hers'} />}

        {has('forever') && (
          <g className="s-seven">
            {SEVEN.map((s, i) => (
              <path key={i} className="s-seven__star" d={sparkPath(s.x, s.y, s.r)} style={{ ['--i' as string]: i }} {...fresh('forever')} />
            ))}
          </g>
        )}

        {/* Travelling lights (desktop story), or resting at the end of their paths in Chapter Three */}
        {(stage || pose === 'paths') &&
          (['jamila', 'mustafa'] as const).map((who) => {
            const rest = stage ? { x: 0, y: 0 } : JOURNEY[who].at(JOURNEY[who].knots[2])
            return (
              <g key={who} className={`s-spark s-spark--${who}`} transform={stage ? undefined : `translate(${rest.x} ${rest.y})`}>
                <circle r="16" fill={`url(#${who === 'jamila' ? ids.lilac : ids.warm})`} />
                <circle r="3.4" fill="#fff8f0" />
              </g>
            )
          })}
      </svg>

      <StarButtons pose={pose} stage={stage} />
    </div>
  )
}

function Mark({ className, p, r, glow, halo, fresh }: { className: string; p: Point; r: number; glow: string; halo: number; fresh: boolean }) {
  return (
    <g className={className} style={{ transformOrigin: `${p.x}px ${p.y}px`, transformBox: 'view-box' }} {...(fresh ? { 'data-new': '' } : {})}>
      <circle className="s-star__glow" cx={p.x} cy={p.y} r={r * halo} fill={`url(#${glow})`} />
      <path className="s-star__spark" d={sparkPath(p.x, p.y, r)} />
      <circle className="s-star__core" cx={p.x} cy={p.y} r={r * 0.8} />
    </g>
  )
}

/**
 * Mustafa's and Jamila's stars as buttons: hover, keyboard focus or a tap reveals the name and
 * birth date. Positions and labels (not colour alone) tell the two stars apart.
 */
function StarButtons({ pose, stage }: { pose: StoryBeatId; stage: boolean }) {
  const [open, setOpen] = useState<Person | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const at = ORDER.indexOf(pose)

  // A tap elsewhere closes an open label.
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const people: { who: Person; from: StoryBeatId; p: Point }[] = [
    { who: 'mustafa', from: 'his', p: STAR.m1 },
    { who: 'jamila', from: 'hers', p: STAR.j1 },
  ]

  return (
    <div ref={root} className="story-stars">
      {people
        .filter(({ from }) => stage || at >= ORDER.indexOf(from))
        .map(({ who, from, p }) => {
          const person = STORY.stars[who]
          // In the vertical sequence, the chapter that introduces a star also shows its date.
          const style = { ...pct(p), ...(!stage && pose === from ? { '--date': 1 } : {}) } as CSSProperties
          // Later chapters repeat the same star: still tappable, but one keyboard stop per star is enough.
          const repeat = !stage && pose !== from
          const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
            if (e.key === 'Escape' && open === who) {
              e.stopPropagation()
              setOpen(null)
            }
          }
          return (
            <button
              key={who}
              type="button"
              className={`story-star story-star--${who}`}
              style={style}
              data-open={open === who || undefined}
              tabIndex={repeat ? -1 : undefined}
              aria-hidden={repeat || undefined}
              onClick={() => setOpen((o) => (o === who ? null : who))}
              onKeyDown={onKey}
            >
              <span className="story-star__hit" aria-hidden="true" />
              <span className="story-star__label">
                <span className="story-star__name">{person.name}</span>
                <span className="story-star__date">
                  <span className="story-star__born">born</span> <time dateTime={person.born.iso}>{person.born.label}</time>
                </span>
              </span>
            </button>
          )
        })}
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { STORY, type StoryBeat } from '../config/site'
import { DoorButton } from '../components/DoorButton'
import { StorySky } from '../components/StorySky'
import { ReplayIcon, StarIcon } from '../components/icons'
import { gsap, ScrollTrigger, useGSAP } from '../lib/gsap'
import { useMotion } from '../lib/motion'
import { scrollToSection, scrollToY } from '../lib/scroll'
import { JOURNEY, SEVEN, STAR } from '../lib/storyGeometry'
import { tourHooks } from '../lib/tourHooks'

const SECTION_ID = 'stars'
const BEATS = STORY.beats

/*
 * Timeline map for the pinned story (timeline seconds; scroll scrubs through them).
 * LABELS are the resting points the scroll snaps to and the chapter indicator jumps to.
 * BOUNDS mark where each chapter takes over the indicator.
 */
// The finished constellation rests from 10.8 to the end, so scrolling back up into the story
// from the wishes below settles on it rather than rewinding straight past it.
const TOTAL = 11.9
const LABELS = [0, 2.5, 4.7, 7.6, 10.8]
const BOUNDS = [0, 1.6, 3.6, 5.8, 8.3]
/** Viewport heights of scrolling per timeline second: an unhurried pace. */
const PACE = 0.44

function beatAt(time: number): number {
  let i = 0
  BOUNDS.forEach((b, n) => {
    if (time >= b - 0.001) i = n
  })
  return i
}

const POINTS = LABELS.map((l) => l / TOTAL)

/**
 * Where the story settles when scrolling stops (scroll progress → chapter resting point).
 * A small nudge past a chapter returns to it; a real move carries on to the next chapter
 * in the direction of travel. Without a direction, the nearest chapter wins.
 */
function settle(value: number, direction: number): number {
  const exact = POINTS.find((p) => Math.abs(p - value) < 0.004)
  if (exact !== undefined) return exact
  let prev = 0
  let next = 1
  for (const p of POINTS) {
    if (p <= value) prev = p
    else {
      next = p
      break
    }
  }
  const forgive = (next - prev) * 0.12
  if (direction > 0) return value - prev < forgive ? prev : next
  if (direction < 0) return next - value < forgive ? next : prev
  return value - prev < next - value ? prev : next
}

/** Scene B — "Written in the Stars": two first lights, two paths, one constellation. */
export function WrittenInTheStars() {
  const { stage, motion } = useMotion()
  const root = useRef<HTMLElement>(null)

  // Ambient twinkles pause while the scene is off screen.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      el.dataset.onscreen = String(entry.isIntersecting)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section
      id={SECTION_ID}
      ref={root}
      className={`scene story ${stage ? 'story--stage' : 'story--flow'}`}
      data-theme="dark"
      aria-labelledby="stars-title"
    >
      {stage ? <StageStory /> : <FlowStory motion={motion} />}
    </section>
  )
}

function replay() {
  scrollToSection(SECTION_ID)
}

/**
 * The words of one chapter, shared by the pinned story and the vertical sequence.
 * In the pinned story the words are `decorative` (a full transcript is read instead),
 * but the replay button always stays reachable.
 */
function BeatText({ beat, decorative = false }: { beat: StoryBeat; decorative?: boolean }) {
  const Title = decorative ? 'p' : 'h3'
  const hide = decorative ? ({ 'aria-hidden': true } as const) : {}
  if (beat.id === 'before') {
    return (
      <>
        {!decorative && <Title className="visually-hidden">{beat.title}</Title>}
        <p className="story-beat__opening story-beat__part" {...hide}>
          {beat.lines[0]}
        </p>
      </>
    )
  }
  const finale = beat.id === 'forever'
  return (
    <>
      <p className="story-beat__kicker story-beat__part" {...hide}>
        {beat.kicker}
      </p>
      <Title className="story-beat__title story-beat__part" {...hide}>
        {beat.title}
      </Title>
      {beat.date && (
        <p className="story-beat__date story-beat__part" {...hide}>
          <StarIcon size={10} /> <time dateTime={beat.date.iso}>{beat.date.label}</time>
        </p>
      )}
      {finale && (
        <p className="story-beat__reveal story-beat__part" {...hide}>
          {STORY.reveal}
        </p>
      )}
      <p className="story-beat__lines story-beat__part" {...hide}>
        {beat.lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </p>
      {finale && (
        <>
          <p className="story-beat__finish story-beat__part" {...hide}>
            {STORY.finish}
          </p>
          <div className="story-beat__actions story-beat__part">
            <DoorButton variant="ghost" size="sm" icon={<ReplayIcon size={14} />} onClick={replay}>
              {STORY.replay}
            </DoorButton>
          </div>
        </>
      )}
    </>
  )
}

function StoryProgress({ active, onSelect, variant }: { active: number; onSelect: (i: number) => void; variant: 'rail' | 'bar' }) {
  return (
    <nav className={`story-progress story-progress--${variant}`} aria-label={`${STORY.title}: chapters`}>
      <ol className="story-progress__list">
        {BEATS.map((beat, i) => (
          <li key={beat.id}>
            <button
              type="button"
              className="story-progress__btn"
              aria-current={i === active ? 'step' : undefined}
              aria-label={beat.kicker ? `${beat.kicker}: ${beat.title}` : beat.title}
              onClick={() => onSelect(i)}
            >
              <span className="story-progress__mark">
                <StarIcon size={i === BEATS.length - 1 ? 15 : 11} className="story-progress__star" />
              </span>
              <span className="story-progress__label" aria-hidden="true">
                {beat.short}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {variant === 'bar' && (
        <span className="story-progress__current" aria-hidden="true">
          {BEATS[active].short}
        </span>
      )}
    </nav>
  )
}

/* ───────────────────────── Desktop: one pinned, scroll-scrubbed scene ───────────────────────── */

function StageStory() {
  const pinRef = useRef<HTMLDivElement>(null)
  const stRef = useRef<ScrollTrigger | null>(null)
  /** True while the chapter indicator is scrolling the story, so snapping stays out of the way. */
  const navigating = useRef(false)
  const navTimer = useRef(0)
  const [active, setActive] = useState(0)

  useGSAP(
    () => {
      const pin = pinRef.current
      if (!pin) return
      const q = gsap.utils.selector(pin)
      const one = (sel: string) => q(sel)[0]

      const beats = q('.story-beat')
      const [mBtn, jBtn] = [one('.story-star--mustafa'), one('.story-star--jamila')]
      const trailPaths = { jamila: q('.s-trail--jamila path'), mustafa: q('.s-trail--mustafa path') }
      // The bright core of each trail doubles as the motion path for its travelling light.
      const journeyPath = {
        jamila: pin.querySelector<SVGPathElement>('.s-trail--jamila .s-trail__core')!,
        mustafa: pin.querySelector<SVGPathElement>('.s-trail--mustafa .s-trail__core')!,
      }
      const spark = { jamila: one('.s-spark--jamila'), mustafa: one('.s-spark--mustafa') }
      const pathStar = (id: string) => one(`.s-star--${id}`)
      const lines = q('.s-line')

      // ── Starting state: an empty, quiet sky ─────────────────────────────────────────────
      gsap.set(q('.s-origin, .s-trail path, .s-line'), { drawSVG: '0%' })
      // A faint line of light is already there in the opening sky, leading the eye into the story.
      gsap.set(one('.s-guide'), { drawSVG: '0% 38%' })
      gsap.set(one('.s-final'), { drawSVG: '50% 50%' })
      // The dotted line rising from the shared star grows upward (drawing it would lose the dots).
      gsap.set(one('.s-beyond'), { scaleY: 0, transformOrigin: '50% 100%' })
      gsap.set(q('.s-star'), { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' })
      gsap.set(q('.s-dust__star'), { autoAlpha: 0 })
      gsap.set(q('.s-spark'), { autoAlpha: 0 })
      gsap.set(one('.s-bloom'), { autoAlpha: 0, scale: 0.2, transformOrigin: '50% 50%' })
      gsap.set(one('.s-initials'), { autoAlpha: 0, y: 14 })
      gsap.set(q('.s-seven__star'), { autoAlpha: 0 })
      gsap.set([mBtn, jBtn], { autoAlpha: 0, '--date': 0 })
      gsap.set(beats.slice(1), { autoAlpha: 0 })
      beats.slice(1).forEach((b) => gsap.set(b.querySelectorAll('.story-beat__part'), { y: 26, autoAlpha: 0 }))

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: pin,
          start: 'top top',
          end: () => `+=${Math.round(window.innerHeight * PACE * TOTAL)}`,
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          // No inertia: with a scrubbed timeline it would read the playhead catching up as
          // momentum and carry the story one chapter too far.
          snap: {
            snapTo: (value, self) => (navigating.current ? value : settle(value, self?.direction ?? 0)),
            inertia: false,
            duration: { min: 0.35, max: 1.1 },
            delay: 0.18,
            ease: 'power2.inOut',
          },
          onUpdate: (self) => {
            const i = beatAt(self.progress * TOTAL)
            setActive((prev) => (prev === i ? prev : i))
          },
        },
      })
      stRef.current = tl.scrollTrigger ?? null
      tourHooks.storyChapterY = (i) => {
        const st = stRef.current
        return st && POINTS[i] !== undefined ? st.start + POINTS[i] * (st.end - st.start) : null
      }

      const beatIn = (el: Element, at: number) => {
        tl.to(el, { autoAlpha: 1, duration: 0.01 }, at)
        tl.to(el.querySelectorAll('.story-beat__part'), { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' }, at)
      }
      const beatOut = (el: Element, at: number) => tl.to(el, { autoAlpha: 0, y: -22, duration: 0.4, ease: 'power1.in' }, at)
      const pop = (el: Element | Element[], at: number, ease = 'back.out(2.2)') => tl.to(el, { autoAlpha: 1, scale: 1, duration: 0.4, ease }, at)

      // Slow background drift for the whole story (parallax layers move at different rates).
      tl.to(one('.story-field--far'), { yPercent: -5, duration: TOTAL }, 0)
        .to(one('.story-field--near'), { yPercent: -13, duration: TOTAL }, 0)
        .to(one('.story-nebula'), { xPercent: -8, yPercent: -6, rotation: 10, duration: TOTAL }, 0)

      // ── Before there was an ‘us’… — a line of light leads into the story ─────────────────
      tl.to(one('.s-guide'), { drawSVG: '0% 100%', duration: 1.5, ease: 'power1.inOut' }, 0)
      beatOut(beats[0], 1.2)

      // ── Chapter One: his first light (28 November 1997) ─────────────────────────────────
      tl.to(one('.s-origin--mustafa'), { drawSVG: '100%', duration: 0.5, ease: 'power2.out' }, 1.4)
      pop(one('.s-star--mustafa'), 1.75, 'back.out(1.8)')
      tl.to(one('.s-guide'), { autoAlpha: 0, duration: 0.4 }, 1.8)
        .to(mBtn, { autoAlpha: 1, duration: 0.3 }, 1.95)
        .to(mBtn, { '--date': 1, duration: 0.3 }, 2.0)
      beatIn(beats[1], 1.75)
      tl.to(mBtn, { '--date': 0, duration: 0.3 }, 3.3)
      beatOut(beats[1], 3.2)

      // ── Chapter Two: her first light (27 May 2002) ──────────────────────────────────────
      tl.to(one('.s-origin--jamila'), { drawSVG: '100%', duration: 0.5, ease: 'power2.out' }, 3.55)
      pop(one('.s-star--jamila'), 3.95, 'back.out(1.8)')
      tl.to(jBtn, { autoAlpha: 1, duration: 0.3 }, 4.1).to(jBtn, { '--date': 1, duration: 0.3 }, 4.15)
      beatIn(beats[2], 3.95)
      tl.to(jBtn, { '--date': 0, duration: 0.3 }, 5.5)
      beatOut(beats[2], 5.4)

      // ── Chapter Three: two paths curve toward each other, small stars light along them ────
      const travel = (who: 'jamila' | 'mustafa', start: number, end: number, from: number, to: number) => {
        const j = JOURNEY[who]
        const k = to - from
        tl.to(spark[who], { motionPath: { path: journeyPath[who], align: journeyPath[who], alignOrigin: [0.5, 0.5], start: from, end: to }, duration: end - start }, start)
        tl.to(trailPaths[who], { drawSVG: `0% ${to * 100}%`, duration: end - start }, start)
        // Path stars and dust light up the moment the travelling light reaches them.
        const when = (f: number) => start + ((f - from) / k) * (end - start)
        j.knots.slice(1, 3).forEach((f, n) => {
          if (f > from + 0.001 && f <= to + 0.001) pop(pathStar(`${who[0]}${n + 2}`), when(f) - 0.08)
        })
        q(`.s-dust__star--${who}`).forEach((dot) => {
          const f = Number(dot.getAttribute('data-f'))
          if (f > from && f <= to + 0.0001) tl.to(dot, { autoAlpha: 1, duration: 0.15 }, when(f))
        })
      }
      tl.to(q('.s-spark'), { autoAlpha: 1, duration: 0.2 }, 5.75)
      // His light set out first; hers follows a little later, and they arrive together.
      travel('mustafa', 5.75, 7.4, 0, JOURNEY.mustafa.knots[2])
      travel('jamila', 5.95, 7.4, 0, JOURNEY.jamila.knots[2])
      tl.to(one('.story-bg--violet'), { autoAlpha: 1, duration: 1.6 }, 5.8)
      beatIn(beats[3], 6.05)
      beatOut(beats[3], 8.05)

      // ── Chapter Four: their forever era (15 November 2026) ──────────────────────────────
      travel('mustafa', 8.3, 9.05, JOURNEY.mustafa.knots[2], 1)
      travel('jamila', 8.3, 9.05, JOURNEY.jamila.knots[2], 1)
      pop(one('.s-star--forever'), 9.02, 'back.out(3)')
      tl.to(one('.s-bloom'), { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power2.out' }, 9.02)
        .to(one('.s-bloom'), { autoAlpha: 0.42, duration: 0.8, ease: 'power1.inOut' }, 9.55)
        .to(q('.s-spark'), { autoAlpha: 0, duration: 0.25 }, 9.08)
        .to(one('.story-bg--dawn'), { autoAlpha: 1, duration: 0.9 }, 9.1)
      ;[0, 1, 2].forEach((k) => tl.to([lines[k], lines[k + 3]], { drawSVG: '100%', duration: 0.45, ease: 'power1.inOut' }, 9.2 + k * 0.12))
      tl.to(q('.s-trail'), { opacity: 0.32, duration: 0.6 }, 9.45)
        .to(one('.s-initials'), { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 9.6)
        .to(one('.s-final'), { drawSVG: '0% 100%', duration: 0.6, ease: 'power1.inOut' }, 9.8)
        .to(one('.s-beyond'), { scaleY: 1, duration: 0.5, ease: 'power2.out' }, 10.0)
        .fromTo(
          q('.s-seven__star'),
          {
            x: (i: number) => STAR.forever.x - SEVEN[i].x,
            y: (i: number) => STAR.forever.y - SEVEN[i].y,
            scale: 0,
            transformOrigin: '50% 50%',
          },
          { x: 0, y: 0, scale: 1, autoAlpha: 1, duration: 0.7, stagger: 0.05, ease: 'power2.out' },
          9.7,
        )
      tl.to(beats[4], { autoAlpha: 1, duration: 0.01 }, 9.15)
      // Kicker, title, date, then the married name, the line, the wish and the replay button.
      const parts = beats[4].querySelectorAll('.story-beat__part')
      ;[9.15, 9.25, 9.35, 9.6, 9.85, 10.05, 10.2].forEach((at, i) => {
        if (parts[i]) tl.to(parts[i], { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out' }, at)
      })
      tl.fromTo(one('.story-beat__reveal'), { letterSpacing: '0.12em' }, { letterSpacing: '0em', duration: 0.8, ease: 'power2.out' }, 9.7)
      // Hold the finished constellation for the last stretch of the pin.
      tl.set({}, {}, TOTAL)

      // The opening words arrive as the section scrolls into view, before the pin takes over.
      gsap.from(beats[0].querySelectorAll('.story-beat__part'), {
        autoAlpha: 0,
        y: 30,
        ease: 'power2.out',
        stagger: 0.12,
        scrollTrigger: { trigger: pin, start: 'top 80%', end: 'top 20%', scrub: 0.6 },
      })

      return () => {
        stRef.current = null
        tourHooks.storyChapterY = undefined
      }
    },
    { scope: pinRef },
  )

  const goTo = useCallback((i: number) => {
    const st = stRef.current
    if (!st) return
    const release = (after: number) => {
      window.clearTimeout(navTimer.current)
      navTimer.current = window.setTimeout(() => (navigating.current = false), after)
    }
    navigating.current = true
    // Safety net: if the visitor interrupts the scroll, onComplete never fires; snapping still returns.
    release(3200)
    scrollToY(st.start + POINTS[i] * (st.end - st.start), {
      duration: 1.4,
      // Let the scrubbed playhead arrive before snapping may act again.
      onComplete: () => release(900),
    })
  }, [])

  useEffect(() => () => window.clearTimeout(navTimer.current), [])

  return (
    <div ref={pinRef} className="story-pin">
      <div className="story-bg story-bg--base" aria-hidden="true" />
      <div className="story-bg story-bg--violet" aria-hidden="true" />
      <div className="story-bg story-bg--dawn" aria-hidden="true" />
      <div className="story-nebula" aria-hidden="true" />
      <div className="story-field story-field--far" aria-hidden="true" />
      <div className="story-field story-field--near" aria-hidden="true" />

      {/* Screen readers get the whole story at once instead of one scrubbed chapter at a time. */}
      <div className="visually-hidden">
        <h2 id="stars-title" data-chapter-focus tabIndex={-1}>
          {STORY.title}
        </h2>
        <p>{STORY.skyLabel}</p>
        <ol>
          {BEATS.map((beat) => {
            const head = `${beat.kicker ? `${beat.kicker}: ` : ''}${beat.title}${beat.date ? `, ${beat.date.label}` : ''}`
            // Same order as on screen: heading and date, the married name, the lines, the closing wish.
            const body = [beat.id === 'forever' ? `${STORY.reveal}.` : '', ...beat.lines, beat.id === 'forever' ? STORY.finish : '']
            return <li key={beat.id}>{`${head}${/[.…]$/.test(head) ? '' : '.'} ${body.filter(Boolean).join(' ')}`}</li>
          })}
        </ol>
      </div>

      <p className="eyebrow story-eyebrow" aria-hidden="true">
        {STORY.eyebrow} <span className="story-eyebrow__dot">·</span> {STORY.title}
      </p>

      <StoryProgress variant="rail" active={active} onSelect={goTo} />

      <StorySky pose="forever" stage className="story-stage-sky" />

      <div className="story-band">
        {BEATS.map((beat) => (
          <div key={beat.id} className={`story-beat story-beat--${beat.id}`}>
            <BeatText beat={beat} decorative />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───────────────── Phones, tablets and calm mode: a readable vertical sequence ───────────────── */

function FlowStory({ motion }: { motion: boolean }) {
  const flowRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  // The step crossing the upper part of the screen is the current chapter.
  useEffect(() => {
    const flow = flowRef.current
    if (!flow) return
    const steps = Array.from(flow.querySelectorAll<HTMLElement>('.story-step'))
    let frame = 0
    const update = () => {
      frame = 0
      const line = window.innerHeight * 0.45
      let i = 0
      steps.forEach((s, n) => {
        if (s.getBoundingClientRect().top < line) i = n
      })
      setActive((prev) => (prev === i ? prev : i))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  // Gentle reveals: words rise in, new lines draw, new stars appear. Calm mode shows everything as is.
  useGSAP(
    () => {
      const flow = flowRef.current
      if (!flow || !motion) return
      flow.querySelectorAll<HTMLElement>('.story-step').forEach((step) => {
        const st = { trigger: step, start: 'top 78%', once: true }
        // Opacity only (not visibility), so the replay button stays in the Tab order before its reveal.
        gsap.from(step.querySelectorAll('.story-beat__part'), { opacity: 0, y: 24, duration: 0.9, stagger: 0.1, scrollTrigger: st })
        const fresh = (sel: string) => Array.from(step.querySelectorAll(sel))
        const strokes = fresh('[data-new].s-guide, [data-new].s-origin, [data-new] .s-trail path, [data-new] .s-line')
        if (strokes.length) gsap.from(strokes, { drawSVG: '0%', duration: 1.6, ease: 'power2.inOut', stagger: 0.08, scrollTrigger: st })
        const final = fresh('[data-new] .s-final')
        if (final.length) gsap.from(final, { drawSVG: '50% 50%', duration: 1, delay: 1, ease: 'power1.inOut', scrollTrigger: st })
        const beyond = fresh('[data-new] .s-beyond')
        if (beyond.length) gsap.from(beyond, { scaleY: 0, transformOrigin: '50% 100%', duration: 0.8, delay: 1.3, ease: 'power2.out', scrollTrigger: st })
        const stars = fresh('.s-star[data-new]')
        if (stars.length) gsap.from(stars, { scale: 0, autoAlpha: 0, transformOrigin: '50% 50%', duration: 0.7, stagger: 0.12, delay: 0.4, ease: 'back.out(2)', scrollTrigger: st })
        const dust = fresh('.s-dust__star[data-new]')
        if (dust.length) gsap.from(dust, { autoAlpha: 0, duration: 0.4, stagger: 0.07, delay: 0.5, scrollTrigger: st })
        const extras = fresh('.s-initials[data-new], .s-bloom[data-new]')
        if (extras.length) gsap.from(extras, { autoAlpha: 0, duration: 1, delay: 0.9, scrollTrigger: st })
        const seven = fresh('.s-seven__star[data-new]')
        if (seven.length)
          gsap.from(seven, {
            x: (i: number) => STAR.forever.x - SEVEN[i].x,
            y: (i: number) => STAR.forever.y - SEVEN[i].y,
            scale: 0,
            autoAlpha: 0,
            transformOrigin: '50% 50%',
            duration: 1,
            stagger: 0.06,
            delay: 1.1,
            ease: 'power2.out',
            scrollTrigger: st,
          })
        const spark = fresh('.story-sky--paths .s-spark')
        if (spark.length) gsap.from(spark, { autoAlpha: 0, duration: 0.6, delay: 1.2, scrollTrigger: st })
      })
      // The connecting constellation line grows as the visitor reads down the story.
      flow.querySelectorAll<HTMLElement>('.story-thread').forEach((thread) => {
        gsap.fromTo(thread, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: thread, start: 'top 88%', end: 'bottom 60%', scrub: true } })
      })
    },
    { scope: flowRef, dependencies: [motion], revertOnUpdate: true },
  )

  const goTo = useCallback((i: number) => {
    const step = flowRef.current?.querySelectorAll<HTMLElement>('.story-step')[i]
    if (!step) return
    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64
    const bar = flowRef.current?.querySelector<HTMLElement>('.story-progress')?.offsetHeight ?? 0
    scrollToY(step.getBoundingClientRect().top + window.scrollY - header - bar - 12, {
      onComplete: () => step.focus({ preventScroll: true }),
    })
  }, [])

  return (
    <div ref={flowRef} className="story-flow">
      <header className="story-flow__head">
        <p className="eyebrow">{STORY.eyebrow}</p>
        <h2 id="stars-title" className="section-title story-flow__title" data-chapter-focus tabIndex={-1}>
          {STORY.title}
        </h2>
      </header>

      <StoryProgress variant="bar" active={active} onSelect={goTo} />

      <ol className="story-steps">
        {BEATS.map((beat) => (
          <li key={beat.id} className={`story-step story-step--${beat.id}`} data-step-focus tabIndex={-1}>
            <span className="story-thread" aria-hidden="true" />
            <StorySky pose={beat.id} className="story-step__sky" />
            <div className="story-beat story-step__text">
              <BeatText beat={beat} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}


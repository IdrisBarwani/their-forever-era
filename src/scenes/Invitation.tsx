import { useCallback, useEffect, useRef, useState } from 'react'
import { GATE, INVITATION } from '../config/site'
import { DoorButton } from '../components/DoorButton'
import { Photo } from '../components/Photo'
import { SealButton } from '../components/SealButton'
import { SoundToggle } from '../components/SoundToggle'
import { ArrowIcon, StarIcon } from '../components/icons'
import { gate, useGateState } from '../lib/gate'
import { gsap, ScrollTrigger, SplitText, useGSAP } from '../lib/gsap'
import { useMotion } from '../lib/motion'
import { lockScroll, scrollToSection, unlockScroll } from '../lib/scroll'

/** The entrance plays once per visit, even if effects are switched off and on again. */
let introPlayed = false

/** Seven subtle stars over the opening stage (percent positions). */
// Placed in the gaps of the starry backdrop so no star ever sits on a face.
const HERO_STARS = [
  { x: 4, y: 46, s: 0.9 },
  { x: 29, y: 22, s: 0.75 },
  { x: 31.5, y: 70, s: 0.6 },
  { x: 50, y: 10, s: 1.25 },
  { x: 66, y: 30, s: 0.8 },
  { x: 69.5, y: 78, s: 0.6 },
  { x: 96, y: 52, s: 0.9 },
]

/** Timeline second at which the door leaves are open wide enough to count as "inside". */
const DOORS_OPEN_AT = 2.35
/** How long the calm-mode door takes to fade (matches the CSS transition). */
const CALM_FADE_MS = 450

/**
 * Scene A — the invitation. The page opens on a closed double door with the J&M wax seal on
 * its seam. Pressing the seal opens the door into the purple universe, then the entrance plays.
 */
export function Invitation() {
  const root = useRef<HTMLElement>(null)
  const intro = useRef<gsap.core.Timeline | null>(null)
  const { motion, finePointer } = useMotion()
  const [introPlaying, setIntroPlaying] = useState(false)
  const door = useGateState()
  /** Move keyboard focus to the first action once inside (only when the seal itself was pressed). */
  const focusAfter = useRef(false)

  // Pause the hero's ambient CSS animations whenever the stage is off screen.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      el.dataset.onscreen = entry.isIntersecting ? 'true' : 'false'
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // While the door is closed the page stays put, and nothing behind the door can take focus.
  useEffect(() => {
    if (door !== 'closed') return
    lockScroll()
    const behind = Array.from(document.querySelectorAll<HTMLElement>('#main > section:not(#invitation), .site-footer'))
    behind.forEach((el) => (el.inert = true))
    return () => {
      unlockScroll()
      behind.forEach((el) => (el.inert = false))
    }
  }, [door])

  // Once inside, pinned scenes re-measure (the page may have gained its scrollbar back).
  useEffect(() => {
    if (door === 'open') requestAnimationFrame(() => ScrollTrigger.refresh())
  }, [door])

  const focusFirstAction = useCallback(() => {
    if (!focusAfter.current) return
    focusAfter.current = false
    root.current?.querySelector<HTMLButtonElement>('.inv-actions .door-btn')?.focus({ preventScroll: true })
  }, [])

  /** Opens the door: the seal, a chapter link or the play button can all ask for it. */
  const enter = useCallback(
    ({ focus = false }: { focus?: boolean } = {}) => {
      if (gate.get() !== 'closed') return
      focusAfter.current = focus
      gate.set('opening')
      const tl = intro.current
      if (motion && tl) {
        tl.play()
        return
      }
      // Calm mode: the door simply fades (CSS), then the visitor is inside.
      window.setTimeout(() => {
        gate.set('open')
        focusFirstAction()
      }, motion ? 0 : CALM_FADE_MS)
    },
    [motion, focusFirstAction],
  )

  useEffect(() => gate.register(enter), [enter])

  const { contextSafe } = useGSAP(
    () => {
      const el = root.current
      if (!el || !motion) return
      const q = gsap.utils.selector(el)

      // Rebuilt in the middle of opening (for example after a settings change): just be inside.
      if (gate.get() === 'opening') gate.set('open')
      const closed = gate.get() === 'closed'

      // ── Entrance ───────────────────────────────────────────────────────────────────
      // The heading carries a visually hidden full name, so the split copy stays out of the accessibility tree.
      const split = SplitText.create(q('.inv-name'), { type: 'chars', mask: 'chars', aria: 'none' })
      const tl = gsap.timeline({
        paused: closed,
        defaults: { ease: 'power3.out' },
        onStart: () => {
          introPlayed = true
          setIntroPlaying(true)
        },
        onComplete: () => {
          setIntroPlaying(false)
          gate.set('open')
          focusFirstAction()
        },
      })

      // The door: the pressed seal swells and lifts away, light leaks through the seam,
      // and the two leaves swing open into the purple universe.
      let at = 0
      if (closed) {
        tl.to(q('.inv-door__seal'), { scale: 1.12, duration: 0.2, ease: 'power2.out' }, 0)
          .to(q('.inv-door__seal'), { autoAlpha: 0, scale: 0.7, duration: 0.35, ease: 'power2.in' }, 0.2)
          .to(q('.inv-door__hint'), { autoAlpha: 0, y: 8, duration: 0.3, ease: 'power1.in' }, 0)
          .to(q('.inv-seam'), { scaleX: 3, duration: 0.5, ease: 'power2.out' }, 0.25)
          .to(q('.inv-curtain--left'), { rotationY: 92, duration: 1.9, ease: 'power2.inOut' }, 0.45)
          .to(q('.inv-curtain--right'), { rotationY: -92, duration: 1.9, ease: 'power2.inOut' }, 0.45)
          .to(q('.inv-seam'), { scaleX: 14, autoAlpha: 0, duration: 1.4, ease: 'power2.out' }, 0.6)
          .to(q('.inv-door__glow'), { autoAlpha: 1, duration: 0.6, ease: 'power2.out' }, 0.4)
          .to(q('.inv-door__glow'), { autoAlpha: 0, duration: 1.2, ease: 'power1.inOut' }, 1.3)
          .call(() => gate.set('open'), undefined, DOORS_OPEN_AT)
        at = 0.5
      }

      tl.from(q('.inv-star'), { scale: 0, autoAlpha: 0, duration: 0.7, stagger: 0.09, ease: 'back.out(2.4)' }, at + 0.1)
        .fromTo(q('.inv-photo-zoom'), { scale: 1.14 }, { scale: 1, duration: 2.8, ease: 'power2.out' }, at)
        .fromTo(q('.inv-dim'), { autoAlpha: 0.85 }, { autoAlpha: 0, duration: 2.2, ease: 'power1.out' }, at + 0.2)
        .from(q('.inv-eyebrow'), { autoAlpha: 0, y: 14, duration: 0.8 }, at + 0.65)
        .from(split.chars, { yPercent: 115, duration: 1.1, stagger: 0.04, ease: 'power4.out' }, at + 0.7)
        .from(q('.inv-amp'), { autoAlpha: 0, scale: 0.5, rotate: -14, duration: 1.1, ease: 'back.out(1.8)' }, at + 1.05)
        .fromTo(q('.inv-era'), { autoAlpha: 0, letterSpacing: '0.75em' }, { autoAlpha: 1, letterSpacing: '0.34em', duration: 1.5, ease: 'power2.out' }, at + 1.3)
        .from(q('.inv-lede'), { autoAlpha: 0, y: 18, duration: 0.9 }, at + 1.6)
        .from(q('.inv-actions > *'), { autoAlpha: 0, y: 16, duration: 0.8, stagger: 0.1 }, at + 1.75)
        .from(q('.inv-cue'), { autoAlpha: 0, duration: 0.8 }, at + 2.2)
      if (introPlayed && !closed) tl.progress(1)
      intro.current = tl

      // ── Scroll: the stage drifts away as the story begins ──────────────────────
      gsap
        .timeline({ scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: true } })
        .to(q('.inv-photo-scroll'), { yPercent: 16, ease: 'none' }, 0)
        .to(q('.inv-photo-scroll'), { scale: 1.06, ease: 'none' }, 0)
        .to(q('.inv-content'), { yPercent: -14, autoAlpha: 0, ease: 'none' }, 0)
        .to(q('.inv-sky'), { yPercent: -40, ease: 'none' }, 0)
        .to(q('.inv-veil'), { autoAlpha: 1, ease: 'none' }, 0.2)

      // Finish the entrance immediately if the visitor scrolls away mid-way.
      ScrollTrigger.create({
        trigger: el,
        start: 'top+=80 top',
        onEnter: () => {
          if (tl.progress() < 1) tl.progress(1)
        },
      })

      // ── Mouse-responsive depth (fine pointers only) ────────────────────────────
      if (finePointer) {
        const layers = q('[data-depth]').map((layer) => {
          const depth = Number(layer.dataset.depth)
          return {
            depth,
            x: gsap.quickTo(layer, 'x', { duration: 1.2, ease: 'power3.out' }),
            y: gsap.quickTo(layer, 'y', { duration: 1.2, ease: 'power3.out' }),
          }
        })
        const onMove = (e: PointerEvent) => {
          if (e.pointerType !== 'mouse') return
          const rect = el.getBoundingClientRect()
          if (rect.bottom < 0) return
          const nx = e.clientX / window.innerWidth - 0.5
          const ny = e.clientY / window.innerHeight - 0.5
          layers.forEach((l) => {
            l.x(nx * l.depth * 34)
            l.y(ny * l.depth * 22)
          })
          el.style.setProperty('--lx', `${(nx + 0.5) * 100}%`)
          el.style.setProperty('--ly', `${(ny + 0.5) * 100}%`)
        }
        window.addEventListener('pointermove', onMove, { passive: true })
        return () => window.removeEventListener('pointermove', onMove)
      }
    },
    { scope: root, dependencies: [motion, finePointer], revertOnUpdate: true },
  )

  const skip = () => {
    intro.current?.progress(1)
    root.current?.querySelector<HTMLButtonElement>('.inv-actions .door-btn')?.focus()
  }

  const begin = contextSafe(() => {
    if (intro.current && intro.current.progress() < 1) intro.current.progress(1)
    const el = root.current
    if (motion && el) {
      gsap.fromTo(
        el.querySelector('.inv-flash'),
        { autoAlpha: 0, scaleX: 0.04 },
        { autoAlpha: 1, scaleX: 1, duration: 0.55, ease: 'power2.in', yoyo: true, repeat: 1, repeatDelay: 0.1 },
      )
    }
    scrollToSection('stars', { duration: 2 })
  })

  const closed = door === 'closed'

  return (
    <section id="invitation" ref={root} className="scene inv" data-theme="dark" data-door={door} aria-labelledby="inv-title" tabIndex={-1}>
      <div className="inv-stage">
        <div className="inv-photo-scroll">
          <div className="inv-photo" data-depth="0.35">
            <div className="inv-photo-zoom">
              <Photo id="hero" priority sizes="100vw" className="inv-photo__img" />
            </div>
          </div>
        </div>
        <div className="inv-grade" aria-hidden="true" />
        <div className="inv-light" aria-hidden="true" />
        <div className="inv-beams" data-depth="-0.5" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="inv-sky" aria-hidden="true">
          <div className="inv-stars" data-depth="0.9">
            {HERO_STARS.map((s, i) => (
              <span key={i} className="inv-star" style={{ left: `${s.x}%`, top: `${s.y}%`, ['--s' as string]: s.s, ['--d' as string]: `${i * 0.7}s` }}>
                <StarIcon size={18} />
              </span>
            ))}
          </div>
        </div>
        <svg className="inv-doors" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M3 96 L3 10 L15 16 L15 90 Z" />
          <path d="M97 96 L97 10 L85 16 L85 90 Z" />
        </svg>
        <div className="inv-dim" aria-hidden="true" />
        <div className="inv-veil" aria-hidden="true" />

        {/* The closed door. Its two leaves meet at a glowing seam, sealed with J&M. */}
        {door !== 'open' && (
          <div className="inv-door">
            <div className="inv-door__glow" aria-hidden="true" />
            <div className="inv-curtain inv-curtain--left" aria-hidden="true">
              <span className="inv-curtain__panel" />
            </div>
            <div className="inv-curtain inv-curtain--right" aria-hidden="true">
              <span className="inv-curtain__panel" />
            </div>
            <div className="inv-seam" aria-hidden="true" />
            <div className="inv-door__entry">
              <SealButton className="inv-door__seal" label={GATE.button} size={finePointer ? 108 : 96} disabled={!closed} onClick={() => enter({ focus: true })} />
              <p className="inv-door__hint" aria-hidden="true">
                <StarIcon size={12} /> {finePointer ? GATE.hint.pointer : GATE.hint.touch}
              </p>
            </div>
          </div>
        )}
        <div className="inv-flash" aria-hidden="true" />

        <div className="inv-content">
          <p className="eyebrow inv-eyebrow">
            <StarIcon size={12} /> {INVITATION.eyebrow}
          </p>
          <h1 id="inv-title" className="inv-title">
            <span className="visually-hidden">{INVITATION.title}</span>
            <span className="inv-title__visual" aria-hidden="true">
              <span className="inv-name inv-name--first">Jamila</span>
              <span className="inv-line2">
                <span className="inv-amp">&amp;</span>
                <span className="inv-name inv-name--second">Mustafa</span>
              </span>
            </span>
          </h1>
          <div className="inv-side">
            <p className="inv-era">{INVITATION.era}</p>
            <p className="inv-lede">{INVITATION.lede}</p>
            <div className="inv-actions" inert={closed}>
              <DoorButton magnetic onClick={begin} icon={<StarIcon size={14} />}>
                {INVITATION.cta}
              </DoorButton>
              <div className="inv-sound">
                <SoundToggle />
                <span className="inv-sound__hint">{INVITATION.soundHint}</span>
              </div>
            </div>
          </div>
        </div>

        {introPlaying && (
          <button type="button" className="skip-intro" onClick={skip}>
            {INVITATION.skip}
          </button>
        )}
        <a
          className="inv-cue"
          href="#stars"
          inert={closed}
          onClick={(e) => {
            e.preventDefault()
            scrollToSection('stars')
          }}
        >
          <span>{INVITATION.scrollCue}</span>
          <ArrowIcon direction="down" size={16} />
        </a>
      </div>
    </section>
  )
}

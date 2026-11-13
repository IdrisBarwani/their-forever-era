import { useCallback, useEffect, useRef, useState } from 'react'
import { WISHES, WISHES_COPY } from '../config/site'
import { ArrowIcon, StarIcon } from '../components/icons'
import { gsap, ScrollTrigger, useGSAP } from '../lib/gsap'
import { useMotion } from '../lib/motion'
import { scrollToY } from '../lib/scroll'
import { tourHooks } from '../lib/tourHooks'
import { useCarousel } from '../lib/useCarousel'
import { WishCard } from './WishCard'

/**
 * Scene C — Seven wishes for forever.
 * Desktop: a bounded pinned sequence where vertical scroll moves the cards sideways,
 * with ScrollTrigger snapping to each card. Elsewhere: a native swipe carousel with
 * CSS scroll snapping (excluded from Lenis), arrows and indicators.
 */
export function SevenWishes() {
  const { stage, calm } = useMotion()
  const [openId, setOpenId] = useState<string | null>(null)

  const toggle = useCallback((id: string, open: boolean) => setOpenId(open ? id : null), [])

  return (
    <section id="wishes" className={`scene wishes ${stage ? 'wishes--stage' : 'wishes--native'}`} data-theme="dark" aria-labelledby="wishes-title">
      {stage ? <StageWishes openId={openId} onToggle={toggle} /> : <NativeWishes openId={openId} onToggle={toggle} calm={calm} />}
    </section>
  )
}

function Intro({ id = 'wishes-title' }: { id?: string }) {
  return (
    <div className="wishes-intro">
      <p className="eyebrow">{WISHES_COPY.eyebrow}</p>
      <h2 id={id} className="section-title" data-chapter-focus tabIndex={-1}>
        {WISHES_COPY.title}
      </h2>
      <p className="wishes-intro__text">{WISHES_COPY.intro}</p>
      <p className="wishes-intro__disclaimer">
        <StarIcon size={11} /> {WISHES_COPY.disclaimer}
      </p>
    </div>
  )
}

type ListProps = { openId: string | null; onToggle: (id: string, open: boolean) => void }

function Progress({ active, onSelect }: { active: number; onSelect: (i: number) => void }) {
  return (
    <div className="wish-progress" role="group" aria-label="Choose a photocard">
      <span className="wish-progress__count" aria-live="polite">
        {String(active + 1).padStart(2, '0')} <span>/ 07</span>
      </span>
      <ol className="wish-progress__stars">
        {WISHES.map((w, i) => (
          <li key={w.id}>
            <button
              type="button"
              className="wish-progress__star"
              aria-current={i === active ? 'true' : undefined}
              onClick={() => onSelect(i)}
              title={`${w.member} · ${w.theme}`}
            >
              <StarIcon size={i === WISHES.length - 1 ? 16 : 12} />
              <span className="wish-progress__name">{w.member}</span>
              <span className="visually-hidden">, wish for {w.theme}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

function StageWishes({ openId, onToggle }: ListProps) {
  const pinRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLOListElement>(null)
  const stRef = useRef<ScrollTrigger | null>(null)
  const pointsRef = useRef<number[]>([])
  const [active, setActive] = useState(0)

  useGSAP(
    () => {
      const pin = pinRef.current
      const viewport = viewportRef.current
      const track = trackRef.current
      if (!pin || !viewport || !track) return
      const cards = Array.from(track.querySelectorAll<HTMLElement>('[data-slide]'))
      const travel = () => Math.max(0, track.scrollWidth - viewport.clientWidth)

      const computePoints = () => {
        const t = travel() || 1
        pointsRef.current = cards.map((c) => gsap.utils.clamp(0, 1, (c.offsetLeft + c.offsetWidth / 2 - viewport.clientWidth / 2) / t))
      }
      computePoints()

      const move = gsap.to(track, { x: () => -travel(), ease: 'none' })
      const st = ScrollTrigger.create({
        trigger: pin,
        start: 'top top',
        end: () => `+=${Math.max(travel(), window.innerHeight * 0.8)}`,
        pin: true,
        scrub: 0.7,
        animation: move,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onRefresh: computePoints,
        snap: {
          snapTo: (value: number) => {
            const pts = pointsRef.current
            if (!pts.length) return value
            return pts.reduce((best, p) => (Math.abs(p - value) < Math.abs(best - value) ? p : best), pts[0])
          },
          duration: { min: 0.3, max: 0.8 },
          delay: 0.12,
          ease: 'power2.inOut',
        },
        onUpdate: (self) => {
          const pts = pointsRef.current
          let best = 0
          pts.forEach((p, i) => {
            if (Math.abs(p - self.progress) < Math.abs(pts[best] - self.progress)) best = i
          })
          setActive((prev) => (prev === best ? prev : best))
        },
      })
      stRef.current = st
      tourHooks.wishY = (i) => {
        const p = pointsRef.current[i]
        return p === undefined ? null : st.start + p * (st.end - st.start)
      }

      // Depth: each card glides in from the right, its photo re-crops as it travels.
      cards.forEach((card) => {
        const inner = card.querySelector('.wish-slide__inner')
        const media = card.querySelector('.wish-card__media')
        const photo = card.querySelector('.wish-card__photo')
        gsap.fromTo(
          inner,
          { y: 70, rotationY: -16, autoAlpha: 0.35, transformPerspective: 1200 },
          { y: 0, rotationY: 0, autoAlpha: 1, ease: 'power2.out', scrollTrigger: { trigger: card, containerAnimation: move, start: 'left 98%', end: 'left 58%', scrub: true } },
        )
        gsap.fromTo(
          media,
          { clipPath: 'inset(0% 0% 0% 42% round 14px)' },
          { clipPath: 'inset(0% 0% 0% 0% round 14px)', ease: 'power2.out', scrollTrigger: { trigger: card, containerAnimation: move, start: 'left 100%', end: 'left 62%', scrub: true } },
        )
        gsap.fromTo(
          photo,
          { xPercent: 7, scale: 1.18 },
          { xPercent: -7, scale: 1.06, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: move, start: 'left right', end: 'right left', scrub: true } },
        )
      })

      // Staggered arrival of the first cards when the section reaches the screen.
      // Opacity only (not visibility), so keyboard users can Tab to the cards before they arrive.
      gsap.from(track.querySelectorAll('.wish-slide'), {
        y: 60,
        opacity: 0,
        stagger: 0.08,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: { trigger: pin, start: 'top 75%', toggleActions: 'play none none reverse' },
      })
      gsap.from(pin.querySelectorAll('.wishes-intro > *'), {
        y: 30,
        autoAlpha: 0,
        stagger: 0.1,
        duration: 0.9,
        scrollTrigger: { trigger: pin, start: 'top 70%', toggleActions: 'play none none reverse' },
      })

      // The pinned viewport clips its content and must never scroll itself when cards receive focus.
      const keepFlat = () => {
        viewport.scrollLeft = 0
      }
      viewport.addEventListener('scroll', keepFlat)
      return () => {
        viewport.removeEventListener('scroll', keepFlat)
        stRef.current = null
        tourHooks.wishY = undefined
      }
    },
    { scope: pinRef },
  )

  const goTo = useCallback((i: number) => {
    const st = stRef.current
    const p = pointsRef.current[i]
    if (!st || p === undefined) return
    scrollToY(st.start + p * (st.end - st.start), { duration: 1.1 })
  }, [])

  // Keyboard focus moving into an off-screen card brings that card to the centre.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const onFocus = (e: FocusEvent) => {
      const slide = (e.target as HTMLElement).closest<HTMLElement>('[data-slide]')
      if (!slide) return
      const i = Number(slide.dataset.slide)
      const r = slide.getBoundingClientRect()
      if (r.left < 0 || r.right > window.innerWidth) goTo(i)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
      const slide = (e.target as HTMLElement).closest<HTMLElement>('[data-slide]')
      if (!slide || (e.target as HTMLElement).closest('[data-open]')) return
      const i = Number(slide.dataset.slide) + (e.key === 'ArrowRight' ? 1 : -1)
      if (i < 0 || i >= WISHES.length) return
      e.preventDefault()
      goTo(i)
      track.querySelector<HTMLElement>(`[data-slide="${i}"] .wish-card__front .wish-card__btn`)?.focus({ preventScroll: true })
    }
    track.addEventListener('focusin', onFocus)
    track.addEventListener('keydown', onKey)
    return () => {
      track.removeEventListener('focusin', onFocus)
      track.removeEventListener('keydown', onKey)
    }
  }, [goTo])

  return (
    <div ref={pinRef} className="wishes-pin">
      <div className="wishes-glow" aria-hidden="true" />
      <div ref={viewportRef} className="wishes-viewport">
        <ol ref={trackRef} className="wishes-track">
          <li className="wishes-track__intro">
            <Intro />
          </li>
          {WISHES.map((wish, i) => (
            <li key={wish.id} className="wish-slide" data-slide={i}>
              <div className="wish-slide__inner">
                <WishCard wish={wish} index={i} open={openId === wish.id} onToggle={(o) => onToggle(wish.id, o)} />
              </div>
            </li>
          ))}
          <li className="wishes-track__end" aria-hidden="true">
            <StarIcon size={18} />
            <span>Seven wishes, one forever.</span>
          </li>
        </ol>
      </div>
      <Progress active={active} onSelect={goTo} />
      <p className="wishes-hint">{WISHES_COPY.hint}</p>
    </div>
  )
}

function NativeWishes({ openId, onToggle, calm }: ListProps & { calm: boolean }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const { index, goTo } = useCarousel(scrollerRef, WISHES.length, { calm, align: 'center' })

  useGSAP(
    () => {
      if (calm) return
      gsap.from(scrollerRef.current?.querySelectorAll('.wish-slide') ?? [], {
        y: 50,
        opacity: 0,
        stagger: 0.08,
        duration: 0.9,
        scrollTrigger: { trigger: scrollerRef.current, start: 'top 85%' },
      })
    },
    { dependencies: [calm], revertOnUpdate: true },
  )

  return (
    <div className="wishes-native">
      <Intro />
      <div ref={scrollerRef} className="wishes-scroller" data-lenis-prevent-horizontal aria-roledescription="carousel" aria-label="Seven photocards">
        <ol className="wishes-scroller__track">
          {WISHES.map((wish, i) => (
            <li key={wish.id} className="wish-slide" data-slide={i} aria-roledescription="slide" aria-label={`${i + 1} of 7: ${wish.member}`}>
              <WishCard wish={wish} index={i} open={openId === wish.id} onToggle={(o) => onToggle(wish.id, o)} />
            </li>
          ))}
        </ol>
      </div>
      <div className="carousel-controls">
        <button type="button" className="round-btn" onClick={() => goTo(index - 1, true)} disabled={index === 0}>
          <ArrowIcon direction="left" />
          <span className="visually-hidden">Previous photocard</span>
        </button>
        <Progress active={index} onSelect={(i) => goTo(i, true)} />
        <button type="button" className="round-btn" onClick={() => goTo(index + 1, true)} disabled={index === WISHES.length - 1}>
          <ArrowIcon />
          <span className="visually-hidden">Next photocard</span>
        </button>
      </div>
    </div>
  )
}

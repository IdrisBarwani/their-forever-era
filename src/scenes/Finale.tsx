import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FINALE, KEEPSAKE } from '../config/site'
import data from '../config/constellation.json'
import { Constellation } from '../components/Constellation'
import { DoorButton } from '../components/DoorButton'
import { Monogram } from '../components/Monogram'
import { Photo } from '../components/Photo'
import { DownloadIcon, ReplayIcon, StarIcon } from '../components/icons'
import { Burst } from '../lib/burst'
import { gsap, useGSAP } from '../lib/gsap'
import { createKeepsake, downloadBlob } from '../lib/keepsake'
import { useMotion } from '../lib/motion'
import { PurpleOcean } from '../lib/ocean'

type KeepsakeState = 'idle' | 'saving' | 'saved' | 'error'

const [VW, VH] = data.viewBox

/** Where the seven lights rise from (percent of the sky box) before they become the seven stars. */
const ORIGINS = [
  { x: 6, y: 175 },
  { x: 22, y: 210 },
  { x: 36, y: 190 },
  { x: 94, y: 180 },
  { x: 78, y: 215 },
  { x: 64, y: 195 },
  { x: 50, y: 230 },
]

/** CSS px of sky the ocean canvas keeps above its horizon (for the crowd's wave and halos). */
const OCEAN_LEAD = 140

/** Scene G — the purple-ocean finale. */
export function Finale() {
  const root = useRef<HTMLElement>(null)
  const skyRef = useRef<HTMLDivElement>(null)
  const oceanCanvas = useRef<HTMLCanvasElement>(null)
  const burstCanvas = useRef<HTMLCanvasElement>(null)
  const ocean = useRef<PurpleOcean | null>(null)
  const burst = useRef<Burst | null>(null)
  const celebration = useRef<gsap.core.Timeline | null>(null)
  const replayBtn = useRef<HTMLButtonElement>(null)
  const { motion, small, lowPower, finePointer } = useMotion()
  const [webgl, setWebgl] = useState<'pending' | 'on' | 'fallback'>('pending')
  const [lit, setLit] = useState(false)
  const [glow, setGlow] = useState(70)
  const [keepsake, setKeepsake] = useState<KeepsakeState>('idle')
  const [preview, setPreview] = useState<string | null>(null)

  // The horizon sits just under the couple's names. It is measured from layout (offsets ignore the
  // entrance transforms) and anchors the ocean and its glow, so the message that appears when the
  // finale is lit adds room below without moving anything above it.
  useLayoutEffect(() => {
    const section = root.current
    const inner = section?.querySelector<HTMLElement>('.finale-inner')
    const names = section?.querySelector<HTMLElement>('.finale-names')
    if (!section || !inner || !names) return
    let alive = true
    const place = () => {
      if (!alive) return
      let y = names.offsetHeight + 14
      for (let n: HTMLElement | null = names; n && n !== section; n = n.offsetParent as HTMLElement | null) y += n.offsetTop
      section.style.setProperty('--horizon', `${Math.round(y)}px`)
    }
    place()
    void document.fonts?.ready.then(place)
    const ro = new ResizeObserver(place)
    ro.observe(section)
    ro.observe(inner)
    return () => {
      alive = false
      ro.disconnect()
    }
  }, [])

  // WebGL ocean with a photographic fallback.
  useEffect(() => {
    const canvas = oceanCanvas.current
    const section = root.current
    if (!canvas || !section) return
    let instance: PurpleOcean
    try {
      instance = new PurpleOcean(canvas, {
        count: lowPower || small ? 3200 : 9000,
        maxDpr: small ? 1.25 : 1.6,
        animate: motion,
        lead: OCEAN_LEAD,
        // 100svh from the section's min-height: steady while mobile toolbars slide in and out.
        reference: () => Math.min(760, Math.max(420, (parseFloat(getComputedStyle(section).minHeight) || window.innerHeight) * 0.68)),
      })
    } catch (error) {
      console.info('[finale] WebGL unavailable, showing the photographic purple ocean instead.', error)
      setWebgl('fallback')
      return
    }
    instance.onLost = () => setWebgl('fallback')
    ocean.current = instance
    setWebgl('on')
    instance.setGlow(glow / 100)

    let visible = false
    const sync = () => {
      if (visible && !document.hidden && motion) instance.play()
      else instance.stop()
    }
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      sync()
    })
    io.observe(section)
    document.addEventListener('visibilitychange', sync)

    const onMove = (e: PointerEvent) => {
      if (!finePointer || e.pointerType !== 'mouse') return
      instance.setPointer(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('pointermove', onMove)
      instance.destroy()
      ocean.current = null
    }
    // glow is applied separately; recreating the ocean for it would be wasteful
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion, small, lowPower, finePointer])

  useEffect(() => {
    ocean.current?.setGlow(glow / 100)
    root.current?.style.setProperty('--ocean-glow', String(glow / 100))
  }, [glow])

  useEffect(() => {
    const canvas = burstCanvas.current
    if (!canvas) return
    try {
      burst.current = new Burst(canvas, small ? 1.25 : 1.5)
    } catch {
      burst.current = null
    }
    return () => burst.current?.clear()
  }, [small])

  // Scroll: seven lights rise out of the ocean and settle as the constellation; the sky deepens.
  useGSAP(
    () => {
      const el = root.current
      const sky = skyRef.current
      if (!el || !sky || !motion) return
      const orbs = gsap.utils.toArray<HTMLElement>('.finale-orb', el)
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: el, start: 'top 85%', end: 'top 5%', scrub: 1, invalidateOnRefresh: true },
      })
      orbs.forEach((orb, i) => {
        const o = ORIGINS[i]
        const star = data.stars[i]
        tl.fromTo(
          orb,
          {
            x: () => ((o.x - (star.x / VW) * 100) / 100) * sky.clientWidth,
            y: () => ((o.y - (star.y / VH) * 100) / 100) * sky.clientHeight,
            scale: 0.35,
            autoAlpha: 0,
          },
          { x: 0, y: 0, scale: 1, autoAlpha: 1, duration: 1, ease: 'power2.out' },
          i * 0.08,
        )
      })
      tl.fromTo(el.querySelector('.finale-bg--horizon'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.4 }, 0)
        .fromTo(el.querySelector('.finale-sky .constellation'), { autoAlpha: 0.15 }, { autoAlpha: 1, duration: 0.6 }, 0.7)
        // Opacity only (not visibility): the finale's buttons and slider stay in the Tab order.
        .from(el.querySelectorAll('.finale-copy > *'), { opacity: 0, y: 40, stagger: 0.1, duration: 0.6 }, 0.5)
    },
    { scope: root, dependencies: [motion], revertOnUpdate: true },
  )

  const celebrate = () => {
    const el = root.current
    if (!el) return
    // Replays start from a clean slate: no stacked timelines, no leftover particles.
    celebration.current?.kill()
    burst.current?.clear()
    ocean.current?.resetPulse()
    const lines = el.querySelectorAll('.finale-sky .c-line')
    const stars = el.querySelectorAll('.finale-sky .c-star')
    const orbs = el.querySelectorAll('.finale-orb')
    setLit(true)
    // The first button is replaced by "Replay": keep keyboard focus on the action.
    requestAnimationFrame(() => replayBtn.current?.focus({ preventScroll: true }))

    if (!motion) {
      ocean.current?.pulse()
      gsap.set(lines, { drawSVG: '100%' })
      return
    }
    const tl = gsap.timeline()
    tl.fromTo(lines, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.1, stagger: 0.12, ease: 'power2.inOut' }, 0)
      .fromTo(stars, { scale: 0.6, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.8, stagger: 0.07, ease: 'back.out(3)' }, 0.2)
      .fromTo(orbs, { scale: 1 }, { scale: 1.9, duration: 0.45, stagger: 0.07, yoyo: true, repeat: 1, ease: 'power2.out' }, 0.2)
      .fromTo(el.querySelector('.finale-seal'), { scale: 0.85, filter: 'brightness(1)' }, { scale: 1, filter: 'brightness(1.35)', duration: 1, ease: 'elastic.out(1, 0.6)' }, 0.9)
      .fromTo(el.querySelector('.finale-bg--dawn'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.8, ease: 'power2.out' }, 0.9)
      .call(
        () => {
          ocean.current?.pulse()
          const sky = skyRef.current
          const canvas = burstCanvas.current
          if (sky && canvas && burst.current) {
            const s = sky.getBoundingClientRect()
            const c = canvas.getBoundingClientRect()
            const F = data.stars.find((st) => st.id === 'forever')!
            burst.current.fire(s.left - c.left + (F.x / VW) * s.width, s.top - c.top + (F.y / VH) * s.height, small || lowPower ? 70 : 140)
          }
        },
        undefined,
        1.0,
      )
    celebration.current = tl
    // The message mounts with this render; animate it in once it exists.
    requestAnimationFrame(() => {
      const message = el.querySelector('.finale-message')
      if (message) tl.fromTo(message, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 1.3)
    })
  }

  const save = async () => {
    setKeepsake('saving')
    try {
      const blob = await createKeepsake()
      const url = downloadBlob(blob, KEEPSAKE.filename)
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old)
        return url
      })
      setKeepsake('saved')
    } catch {
      setKeepsake('error')
    }
  }

  useEffect(
    () => () => {
      celebration.current?.kill()
    },
    [],
  )

  return (
    <section
      id="finale"
      ref={root}
      className="scene finale"
      data-theme="dark"
      data-lit={lit || undefined}
      aria-labelledby="finale-title"
      style={{ ['--ocean-lead' as string]: `${OCEAN_LEAD}px` }}
    >
      <div className="finale-bg finale-bg--base" aria-hidden="true" />
      <div className="finale-bg finale-bg--horizon" aria-hidden="true" />
      <div className="finale-bg finale-bg--dawn" aria-hidden="true" />
      <div className="finale-ocean" aria-hidden="true">
        {webgl === 'fallback' && <Photo id="ocean-still" sizes="100vw" alt="" className="finale-ocean__photo" />}
        <canvas ref={oceanCanvas} className="finale-ocean__canvas" hidden={webgl === 'fallback'} />
      </div>

      <div className="finale-inner">
        <div ref={skyRef} className="finale-sky" aria-hidden="true">
          <Constellation showBeyond />
          {data.stars.map((s, i) => (
            <span key={s.id} className={`finale-orb${s.id === 'forever' ? ' finale-orb--forever' : ''}`} style={{ left: `${(s.x / VW) * 100}%`, top: `${(s.y / VH) * 100}%`, ['--i' as string]: i }} />
          ))}
          <div className="finale-seal">
            <Monogram variant="seal" size={88} />
          </div>
        </div>

        <div className="finale-copy">
          <p className="eyebrow">{FINALE.eyebrow}</p>
          <h2 id="finale-title" className="finale-title" data-chapter-focus tabIndex={-1}>
            {FINALE.title}
          </h2>
          <p className="finale-names">{FINALE.names}</p>
          <p className="finale-line">{FINALE.line}</p>

          <div className="finale-actions">
            {lit ? (
              <DoorButton ref={replayBtn} magnetic icon={<ReplayIcon size={16} />} onClick={celebrate}>
                {FINALE.replay}
              </DoorButton>
            ) : (
              <DoorButton magnetic icon={<StarIcon size={14} />} onClick={celebrate}>
                {FINALE.cta}
              </DoorButton>
            )}
            <DoorButton variant="ghost" icon={<DownloadIcon size={16} />} loading={keepsake === 'saving'} onClick={() => void save()}>
              {keepsake === 'saving' ? FINALE.keepsakeSaving : FINALE.keepsake}
            </DoorButton>
          </div>

          <div className="finale-status" role="status" aria-live="polite">
            {lit && (
              <div className="finale-message">
                <p className="finale-message__title">
                  <StarIcon size={14} /> {FINALE.litTitle}
                </p>
                <p>{FINALE.litMessage}</p>
                <p className="finale-borahae" lang="ko">
                  {FINALE.borahae}
                  <span lang="en"> — {FINALE.borahaeNote}</span>
                </p>
              </div>
            )}
            {keepsake === 'saved' && (
              <p className="finale-keepsake">
                {preview && <img src={preview} alt="Your keepsake: Happy Married Life, Jamila & Mustafa Lokhandwala, under the seven-star constellation" width={64} height={80} />}
                <span>
                  {FINALE.keepsakeSaved}{' '}
                  {preview && (
                    <a className="star-link" href={preview} download={KEEPSAKE.filename}>
                      Download again
                    </a>
                  )}
                </span>
              </p>
            )}
            {keepsake === 'error' && <p className="finale-keepsake finale-keepsake--error">{FINALE.keepsakeError}</p>}
          </div>

          <label className="glow-slider">
            <span className="glow-slider__label">
              {FINALE.glowLabel} <span className="glow-slider__value">{glow}%</span>
            </span>
            <input type="range" min={10} max={100} step={1} value={glow} onChange={(e) => setGlow(Number(e.target.value))} style={{ ['--fill' as string]: `${((glow - 10) / 90) * 100}%` }} />
          </label>
        </div>
      </div>
      <canvas ref={burstCanvas} className="finale-burst" aria-hidden="true" />
    </section>
  )
}

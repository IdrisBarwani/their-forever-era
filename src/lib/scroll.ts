import Lenis from 'lenis'
import { gate } from './gate'
import { gsap, ScrollTrigger } from './gsap'

/**
 * One scroll owner for the whole page.
 * - Desktop with full effects: Lenis smooths wheel input and is driven by the GSAP ticker,
 *   so Lenis, ScrollTrigger and every timeline share a single animation clock.
 * - Touch devices and calm mode: native scrolling, untouched.
 */
let lenis: Lenis | null = null
let tick: ((time: number) => void) | null = null
let lockDepth = 0

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function enableSmoothScroll(): Lenis {
  if (lenis) return lenis
  lenis = new Lenis({
    lerp: 0.09,
    smoothWheel: true,
    syncTouch: false,
    autoRaf: false,
    anchors: false,
    stopInertiaOnNavigate: true,
  })
  lenis.on('scroll', ScrollTrigger.update)
  tick = (time: number) => lenis?.raf(time * 1000)
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)
  if (lockDepth > 0) lenis.stop()
  return lenis
}

export function disableSmoothScroll(): void {
  if (tick) gsap.ticker.remove(tick)
  tick = null
  lenis?.destroy()
  lenis = null
  gsap.ticker.lagSmoothing(500, 33)
}

export function getLenis(): Lenis | null {
  return lenis
}

export function onScroll(callback: () => void): () => void {
  window.addEventListener('scroll', callback, { passive: true })
  return () => window.removeEventListener('scroll', callback)
}

type ScrollOptions = { immediate?: boolean; duration?: number; onComplete?: () => void }

export function scrollToY(y: number, { immediate = false, duration, onComplete }: ScrollOptions = {}): void {
  const top = Math.max(0, Math.round(y))
  if (lenis) {
    const distance = Math.abs(top - window.scrollY)
    lenis.scrollTo(top, {
      immediate,
      force: true,
      duration: duration ?? Math.min(2.4, 0.9 + distance / 4000),
      easing: easeInOut,
      onComplete: () => onComplete?.(),
    })
    return
  }
  const calm = document.documentElement.dataset.motion === 'calm'
  window.scrollTo({ top, behavior: immediate || calm ? 'auto' : 'smooth' })
  if (onComplete) {
    if (immediate || calm) requestAnimationFrame(() => onComplete())
    else waitForScrollEnd(onComplete)
  }
}

function waitForScrollEnd(done: () => void) {
  let last = window.scrollY
  let still = 0
  const check = () => {
    const now = window.scrollY
    still = Math.abs(now - last) < 1 ? still + 1 : 0
    last = now
    if (still > 6) done()
    else requestAnimationFrame(check)
  }
  requestAnimationFrame(check)
}

/** Document-space top of a section. Sections contain their own pin spacers, so this stays accurate while pinned. */
export function sectionTop(id: string): number | null {
  const el = document.getElementById(id)
  if (!el) return null
  return el.getBoundingClientRect().top + window.scrollY
}

export function scrollToSection(id: string, options: ScrollOptions & { focus?: boolean } = {}): void {
  // Going anywhere from the closed door first opens it. The pinned scenes are re-measured once
  // the page can scroll again, so the target position is exact.
  if (gate.get() !== 'open') {
    void gate.open().then(() =>
      requestAnimationFrame(() => {
        ScrollTrigger.refresh()
        scrollToSection(id, options)
      }),
    )
    return
  }
  const top = sectionTop(id)
  if (top === null) return
  const { focus = true, onComplete, ...rest } = options
  scrollToY(top, {
    ...rest,
    onComplete: () => {
      if (focus) {
        const target = document.querySelector<HTMLElement>(`#${id} [data-chapter-focus]`) ?? document.getElementById(id)
        target?.focus({ preventScroll: true })
      }
      onComplete?.()
    },
  })
  if (history.replaceState) history.replaceState(null, '', `#${id}`)
}

/** Prevent page scrolling behind dialogs and menus. Nested locks are reference-counted. */
export function lockScroll(): void {
  lockDepth += 1
  if (lockDepth > 1) return
  lenis?.stop()
  document.documentElement.classList.add('is-scroll-locked')
}

export function unlockScroll(): void {
  lockDepth = Math.max(0, lockDepth - 1)
  if (lockDepth > 0) return
  document.documentElement.classList.remove('is-scroll-locked')
  lenis?.start()
}

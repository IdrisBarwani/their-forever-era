import { useSyncExternalStore } from 'react'
import { gate } from './gate'
import { ScrollTrigger } from './gsap'
import { getLenis } from './scroll'
import { ambientSound } from './sound'
import { tourHooks } from './tourHooks'

/**
 * The play-through: the whole page, slowly, with music, without scrolling or clicking.
 * It glides from moment to moment, opens what needs opening (the door, each photocard,
 * the letter, the finale) and pauses to let each one be read. Any scroll, tap, click or
 * key press pauses it; pressing play again carries on from wherever the visitor is.
 */
export type TourState = 'idle' | 'playing' | 'paused' | 'done'

type Ctx = {
  signal: AbortSignal
  glide: (y: number, options?: GlideOptions) => Promise<void>
  wait: (seconds: number) => Promise<void>
  until: (test: () => boolean, timeoutSeconds: number) => Promise<boolean>
}

type Beat = {
  /** Where this beat plays (document px). Resuming starts at the first beat at or below the visitor. */
  at: () => number
  /** Rough length in seconds, for the progress ring. */
  weight: number
  run: (c: Ctx) => Promise<void>
}

type GlideOptions = { duration?: number; speed?: number; min?: number; max?: number; ease?: (t: number) => number }

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2
const linear = (t: number) => t
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Reading pace for longer text, in seconds per word (about 230 words a minute). */
const READ = 0.26

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel))
const calm = () => document.documentElement.dataset.motion === 'calm'
const headerH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64
const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight
const docTop = (el: Element) => el.getBoundingClientRect().top + window.scrollY
const words = (el: Element | null) => (el?.textContent ?? '').trim().split(/\s+/).filter(Boolean).length
/** Scroll position that shows the element below the header, centred if it fits. */
function showY(el: Element | null, fallback = window.scrollY) {
  if (!el) return fallback
  const r = el.getBoundingClientRect()
  const room = window.innerHeight - headerH()
  const top = docTop(el)
  return r.height <= room - 24 ? top - headerH() - (room - r.height) / 2 : top - headerH() - 16
}
function click(el: Element | null | undefined) {
  if (el instanceof HTMLElement && !(el as HTMLButtonElement).disabled) el.click()
}

class AbortError extends Error {
  constructor() {
    super('The play-through was paused')
    this.name = 'AbortError'
  }
}

/** Builds the play-through from the page as it is right now (layout, effects, screen size). */
function buildBeats(): Beat[] {
  const beats: Beat[] = []
  const stage = (sel: string) => !!$(sel)

  // ── 01 · The door and the invitation ──────────────────────────────────────────────
  beats.push({
    at: () => 0,
    weight: 8,
    run: async (c) => {
      if (gate.get() !== 'open') {
        await Promise.race([gate.open(), c.until(() => false, 8)])
        // Let the names arrive before moving on; pinned scenes re-measure now the page can scroll.
        await c.wait(calm() ? 0.8 : 2)
        ScrollTrigger.refresh()
      } else await c.glide(0, { speed: 6000, min: 1.5, max: 4 })
      await c.wait(2.6)
    },
  })

  // ── 02 · Written in the Stars ──────────────────────────────────────────────────────
  const storyStage = stage('#stars.story--stage') && !!tourHooks.storyChapterY
  if (!storyStage) {
    beats.push({
      at: () => docTop($('#stars')!) - headerH(),
      weight: 5,
      run: async (c) => {
        await c.glide(docTop($('#stars')!) - headerH() * 0.5, { duration: 3 })
        await c.wait(2.2)
      },
    })
  }
  for (let i = 0; i < 5; i++) {
    const y = () => {
      if (storyStage) return tourHooks.storyChapterY?.(i) ?? docTop($('#stars')!)
      const step = $$('.story-step')[i]
      const bar = $('.story-progress--bar')?.offsetHeight ?? 0
      return step ? docTop(step) - headerH() - bar - 12 : docTop($('#stars')!)
    }
    beats.push({
      at: y,
      weight: i === 0 ? 7 : 10,
      run: async (c) => {
        await c.glide(y(), storyStage ? { speed: 200, min: 2.5, max: 6.5, ease: easeSine } : { duration: 3.2 })
        await c.wait(i === 4 ? 6.5 : 4.6)
      },
    })
  }

  // ── 03 · Seven wishes: each card is turned over and read ───────────────────────────
  const wishesStage = stage('#wishes.wishes--stage') && !!tourHooks.wishY
  const wishesTop = () => docTop($('#wishes')!)
  const carouselY = () => showY($('.wishes-scroller'), wishesTop())
  beats.push({
    at: () => (wishesStage ? wishesTop() : showY($('.wishes-intro'), wishesTop())),
    weight: 6,
    run: async (c) => {
      await c.glide(wishesStage ? wishesTop() : showY($('.wishes-intro'), wishesTop()), { duration: 3.2 })
      await c.wait(2.6)
    },
  })
  for (let i = 0; i < 7; i++) {
    // Cards in the native carousel share one page position; a 1px step per card keeps resuming exact.
    const y = () => (wishesStage ? (tourHooks.wishY?.(i) ?? wishesTop()) : carouselY() + i)
    beats.push({
      at: y,
      weight: 8,
      run: async (c) => {
        await c.glide(y(), wishesStage ? { speed: 260, min: 1.8, max: 3.2, ease: easeSine } : { duration: i === 0 ? 2.4 : 0.3 })
        if (!wishesStage) {
          click($$('#wishes .wish-progress__star')[i])
          await c.wait(1.1)
        }
        const card = $$('#wishes .wish-card')[i]
        if (!card) return
        if (!card.hasAttribute('data-open')) click($('.wish-card__front .wish-card__btn', card))
        await c.wait(1)
        await c.wait(3.4)
        if (card.hasAttribute('data-open')) click($('.wish-card__btn--close', card))
        await c.wait(0.8)
      },
    })
  }

  // ── 04 · The purple archive: every photo in all three tabs ─────────────────────────
  const archiveY = () => {
    const tabs = $('#archive .archive-tabs')
    return tabs ? docTop(tabs) - headerH() - 14 : docTop($('#archive')!)
  }
  for (let t = 0; t < 3; t++) {
    beats.push({
      at: () => archiveY() + t,
      weight: 12,
      run: async (c) => {
        await c.glide(archiveY() + t, { duration: t === 0 ? 3.2 : 0.3 })
        const tab = $$('#archive [role="tab"]')[t]
        if (tab && tab.getAttribute('aria-selected') !== 'true') {
          click(tab)
          await c.wait(1.4)
        } else await c.wait(t === 0 ? 1.8 : 0.6)
        // Every photo in the tab, until the "next" arrow runs out.
        for (let k = 1; k < 24; k++) {
          const next = $$('#archive .archive-controls .round-btn')[1]
          if (!next || (next as HTMLButtonElement).disabled) break
          click(next)
          await c.wait(1.6)
        }
        await c.wait(0.8)
      },
    })
  }

  // ── 05 · The film ──────────────────────────────────────────────────────────────────
  const filmStage = stage('.film-pin--stage') && !!tourHooks.filmRange
  const filmReady = () => $('.film-frame')?.getAttribute('data-status') === 'ready'
  if (filmStage) {
    const range = () => tourHooks.filmRange?.() ?? [docTop($('#film')!), docTop($('#film')!)]
    beats.push({
      at: () => range()[0],
      weight: 6,
      run: async (c) => {
        await c.glide(range()[0], { duration: 3.2 })
        // The film follows the scroll here; make sure it is in that mode, and loaded.
        if ($('.film-frame')?.getAttribute('data-mode') === 'play') click($('.film-mode__opt[data-mode="scroll"]'))
        await c.until(filmReady, 10)
        await c.wait(0.8)
      },
    })
    beats.push({
      at: () => range()[1],
      weight: 15,
      run: async (c) => {
        const [start, end] = range()
        const left = clamp((end - window.scrollY) / Math.max(1, end - start), 0, 1)
        // A steady glide plays the 12-second film a touch slower than real time.
        await c.glide(end, { duration: Math.max(0.5, 15 * left), ease: linear })
        await c.wait(1)
      },
    })
  } else {
    const frameY = () => showY($('.film-frame'), docTop($('#film')!))
    beats.push({
      at: frameY,
      weight: 18,
      run: async (c) => {
        await c.glide(frameY(), { duration: 3.2 })
        await c.until(filmReady, 10)
        const video = $<HTMLVideoElement>('.film-video')
        if (!video) return
        // Ordinary playback from the beginning, with the frame held still on screen.
        click($('.film-mode__opt[data-mode="play"]'))
        await c.wait(0.2)
        video.currentTime = 0
        if (video.paused) click($$('.film-controls .round-btn')[0])
        await c.until(() => video.ended || (video.paused && video.currentTime > 1), 15)
        await c.wait(0.8)
      },
    })
  }
  const officialY = () => {
    const el = $('.official')
    return el ? docTop(el) - headerH() - 24 : docTop($('#film')!)
  }
  beats.push({
    at: officialY,
    weight: 6,
    run: async (c) => {
      await c.glide(officialY(), { duration: 2.8 })
      await c.wait(3)
    },
  })

  // ── 06 · The letter: the seal is pressed, then the letter is read ──────────────────
  const paper = () => $('#letter .letter-paper')
  const isOpen = () => !!paper() && !paper()!.hidden
  const envelopeY = () => showY(isOpen() ? paper() : $('#letter .envelope-wrap'), docTop($('#letter')!))
  beats.push({
    at: envelopeY,
    weight: 8,
    run: async (c) => {
      await c.glide(envelopeY(), { duration: 3.4 })
      if (!isOpen()) {
        await c.wait(1.6)
        click($('#letter .envelope__seal'))
        await c.wait(calm() ? 1 : 2.9)
      }
    },
  })
  const letterEnd = () => {
    const p = paper()
    return p && isOpen() ? docTop(p) + p.offsetHeight - window.innerHeight + 48 : envelopeY() + 1
  }
  beats.push({
    at: letterEnd,
    weight: 34,
    run: async (c) => {
      const p = paper()
      if (!p || !isOpen()) return
      const top = docTop(p) - headerH() - 18
      const readFor = words(p) * READ
      if (window.scrollY < top - 4) {
        await c.glide(top, { duration: 2.4 })
        await c.wait(4)
      }
      const end = letterEnd()
      if (end > window.scrollY + 4) {
        // Teleprompter pace: the rest of the letter rises slowly into view while it is read.
        const left = clamp((end - window.scrollY) / Math.max(1, end - top), 0, 1)
        await c.glide(end, { duration: Math.max(4, (readFor - 6) * left), ease: linear })
        await c.wait(3.5)
      } else await c.wait(Math.max(6, readFor - 4))
    },
  })

  // ── 07 · The finale: the lights rise, then the forever is lit ──────────────────────
  const finaleTop = () => docTop($('#finale')!)
  beats.push({
    at: finaleTop,
    weight: 7,
    run: async (c) => {
      await c.glide(finaleTop(), { duration: 4.6, ease: easeSine })
      await c.wait(2)
    },
  })
  beats.push({
    at: () => finaleTop() + 1,
    weight: 11,
    run: async (c) => {
      // The first finale button is "Light up your forever" (or "Replay the celebration" once lit).
      click($('#finale .finale-actions .door-btn'))
      await c.wait(3.2)
      const message = $('#finale .finale-message')
      if (message) {
        const y = docTop(message) + message.offsetHeight - window.innerHeight + 32
        if (y > window.scrollY + 4) await c.glide(y, { duration: 2.6 })
      }
      await c.wait(4.6)
    },
  })

  // ── A note from a forever friend, then the last line of the page ────────────────────
  const noteY = () => showY($('.dedication__card'), docTop($('#dedication')!))
  beats.push({
    at: noteY,
    weight: 16,
    run: async (c) => {
      await c.glide(noteY(), { duration: 4 })
      await c.wait(clamp(words($('.dedication__card')) * READ, 8, 18))
    },
  })
  beats.push({
    at: () => maxScroll(),
    weight: 5,
    run: async (c) => {
      await c.glide(maxScroll(), { duration: 3 })
      await c.wait(2.5)
    },
  })
  return beats
}

type Listener = () => void

class Tour {
  state: TourState = 'idle'
  private listeners = new Set<Listener>()
  private controller: AbortController | null = null
  private haltScroll: (() => void) | null = null
  // Progress bookkeeping (seconds of weight)
  private total = 1
  private doneWeight = 0
  private beatWeight = 0
  private beatStart = 0

  subscribe = (l: Listener) => {
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }

  getState = () => this.state

  private set(state: TourState) {
    this.state = state
    this.listeners.forEach((l) => l())
  }

  /** 0–1, for the progress ring. */
  progress(): number {
    if (this.state === 'done') return 1
    if (this.state === 'idle') return 0
    const running = this.state === 'playing' ? Math.min(0.98, (performance.now() - this.beatStart) / 1000 / Math.max(0.1, this.beatWeight)) : 0
    return clamp((this.doneWeight + running * this.beatWeight) / this.total, 0, 1)
  }

  toggle() {
    if (this.state === 'playing') this.pause()
    else this.play()
  }

  pause() {
    if (this.state !== 'playing') return
    this.controller?.abort()
    this.haltScroll?.()
    this.set('paused')
  }

  play() {
    if (this.state === 'playing') return
    // Music starts inside the click itself, so mobile browsers allow it.
    const sound = ambientSound.getState()
    if (sound === 'off' || sound === 'error') void ambientSound.start()
    const restart = this.state === 'done'
    const controller = new AbortController()
    this.controller = controller
    this.set('playing')
    void this.run(controller, restart)
  }

  private async run(controller: AbortController, restart: boolean) {
    const { signal } = controller
    const stopOnInput = this.listenForVisitor()
    try {
      const beats = buildBeats()
      this.total = beats.reduce((s, b) => s + b.weight, 0)
      let i = restart ? 0 : beats.findIndex((b) => b.at() >= window.scrollY - 1)
      if (i < 0) i = 0
      this.doneWeight = beats.slice(0, i).reduce((s, b) => s + b.weight, 0)
      const ctx = this.context(signal)
      for (; i < beats.length; i++) {
        this.beatWeight = beats[i].weight
        this.beatStart = performance.now()
        await beats[i].run(ctx)
        if (signal.aborted) throw new AbortError()
        this.doneWeight += beats[i].weight
      }
      if (this.controller === controller) this.set('done')
    } catch (error) {
      if (!(error instanceof AbortError) && !signal.aborted) {
        console.warn('[tour]', error)
        if (this.controller === controller) this.set('paused')
      }
    } finally {
      stopOnInput()
      if (this.controller === controller) this.controller = null
    }
  }

  /** Any scroll, tap, click or key press outside the tour's own controls hands control back. */
  private listenForVisitor() {
    const onOwnControl = (e: Event) => e.target instanceof Element && !!e.target.closest('[data-tour-keep]')
    const onInput = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return
        // Enter and Space press the play or sound button itself; every other key hands control back.
        if (onOwnControl(e) && (e.key === 'Enter' || e.key === ' ')) return
      } else if (onOwnControl(e)) return
      this.pause()
    }
    const onHidden = () => {
      if (document.hidden) this.pause()
    }
    const opts = { capture: true, passive: true }
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
    events.forEach((t) => window.addEventListener(t, onInput, opts))
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      events.forEach((t) => window.removeEventListener(t, onInput, opts))
      document.removeEventListener('visibilitychange', onHidden)
    }
  }

  private context(signal: AbortSignal): Ctx {
    const guard = () => {
      if (signal.aborted) throw new AbortError()
    }
    const wait = (seconds: number) =>
      new Promise<void>((resolve, reject) => {
        guard()
        const t = window.setTimeout(done, seconds * 1000)
        function done() {
          signal.removeEventListener('abort', abort)
          resolve()
        }
        function abort() {
          window.clearTimeout(t)
          reject(new AbortError())
        }
        signal.addEventListener('abort', abort, { once: true })
      })
    const until = async (test: () => boolean, timeoutSeconds: number) => {
      const end = performance.now() + timeoutSeconds * 1000
      while (performance.now() < end) {
        if (test()) return true
        await wait(0.12)
      }
      return test()
    }
    const glide = (y: number, { duration, speed = 900, min = 0.6, max = 6, ease = easeInOut }: GlideOptions = {}) =>
      new Promise<void>((resolve, reject) => {
        guard()
        const target = clamp(Math.round(y), 0, maxScroll())
        const from = window.scrollY
        const distance = Math.abs(target - from)
        if (distance < 2) return resolve()
        const seconds = duration ?? clamp(distance / speed, min, max)
        let finished = false
        const finish = (ok: boolean) => {
          if (finished) return
          finished = true
          signal.removeEventListener('abort', onAbort)
          window.clearTimeout(safety)
          this.haltScroll = null
          if (ok) resolve()
          else reject(new AbortError())
        }
        const onAbort = () => finish(false)
        signal.addEventListener('abort', onAbort, { once: true })
        // Never wait forever, even if something else takes the scroll over.
        const safety = window.setTimeout(() => finish(true), (seconds + 2) * 1000)

        // Calm mode: the page moves from moment to moment without gliding.
        if (calm()) {
          window.scrollTo({ top: target, behavior: 'instant' as ScrollBehavior })
          requestAnimationFrame(() => finish(true))
          return
        }
        const lenis = getLenis()
        if (lenis) {
          this.haltScroll = () => lenis.scrollTo(window.scrollY, { immediate: true, force: true })
          lenis.scrollTo(target, { duration: seconds, easing: ease, force: true, onComplete: () => finish(true) })
          return
        }
        // Touch devices scroll natively: glide frame by frame.
        const t0 = performance.now()
        let raf = 0
        this.haltScroll = () => cancelAnimationFrame(raf)
        const step = (now: number) => {
          if (finished) return
          const p = Math.min(1, (now - t0) / (seconds * 1000))
          window.scrollTo({ top: from + (target - from) * ease(p), behavior: 'instant' as ScrollBehavior })
          if (p < 1) raf = requestAnimationFrame(step)
          else finish(true)
        }
        raf = requestAnimationFrame(step)
      })
    return { signal, glide, wait, until }
  }
}

export const tour = new Tour()

export function useTourState(): TourState {
  return useSyncExternalStore(tour.subscribe, tour.getState, () => 'idle' as TourState)
}

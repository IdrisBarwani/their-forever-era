import { useEffect, useRef, useState } from 'react'
import { CHAPTERS, type ChapterId } from '../config/site'
import { ScrollTrigger } from './gsap'

type Extent = { id: ChapterId; top: number }

let extents: Extent[] = []

function measure() {
  extents = CHAPTERS.map((c) => {
    const el = document.getElementById(c.id)
    return { id: c.id, top: el ? el.getBoundingClientRect().top + window.scrollY : 0 }
  })
}

function activeAt(y: number): ChapterId {
  let current: ChapterId = CHAPTERS[0].id
  for (const e of extents) if (e.top <= y) current = e.id
  return current
}

/**
 * Tracks the active chapter and overall page progress.
 * Chapter positions are re-measured whenever ScrollTrigger refreshes (pin spacers included),
 * and the progress bar is written directly to the DOM to avoid re-rendering on every frame.
 */
export function useChapterTracking(onProgress: (progress: number) => void) {
  const [active, setActive] = useState<ChapterId>('invitation')
  const progressRef = useRef(onProgress)
  progressRef.current = onProgress

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const y = window.scrollY
      const max = document.documentElement.scrollHeight - window.innerHeight
      progressRef.current(max > 0 ? Math.min(1, Math.max(0, y / max)) : 0)
      const next = activeAt(y + window.innerHeight * 0.38)
      setActive((prev) => (prev === next ? prev : next))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const remeasure = () => {
      measure()
      schedule()
    }
    remeasure()
    ScrollTrigger.addEventListener('refresh', remeasure)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', remeasure)
    const ro = new ResizeObserver(remeasure)
    ro.observe(document.body)
    return () => {
      cancelAnimationFrame(frame)
      ScrollTrigger.removeEventListener('refresh', remeasure)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', remeasure)
      ro.disconnect()
    }
  }, [])

  return active
}

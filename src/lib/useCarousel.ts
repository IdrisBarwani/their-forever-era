import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Native horizontal scroll-snap carousel helpers:
 * - tracks the slide nearest the scroller's start edge,
 * - scrolls to a slide (respecting calm mode),
 * - adds mouse drag-to-scroll with a little inertia (touch and trackpads stay native).
 */
export function useCarousel(
  scrollerRef: RefObject<HTMLElement | null>,
  count: number,
  { calm = false, drag = true, align = 'start' as 'start' | 'center' } = {},
) {
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const dragged = useRef(false)

  const slides = useCallback(() => Array.from(scrollerRef.current?.querySelectorAll<HTMLElement>('[data-slide]') ?? []), [scrollerRef])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    let frame = 0
    const update = () => {
      frame = 0
      const max = el.scrollWidth - el.clientWidth
      setProgress(max > 0 ? el.scrollLeft / max : 0)
      const list = slides()
      if (!list.length) return
      const box = el.getBoundingClientRect()
      const anchor = align === 'center' ? box.left + box.width / 2 : box.left + parseFloat(getComputedStyle(el).scrollPaddingLeft || '0')
      let best = 0
      let bestDist = Infinity
      list.forEach((s, i) => {
        const r = s.getBoundingClientRect()
        const d = Math.abs((align === 'center' ? r.left + r.width / 2 : r.left) - anchor)
        if (d < bestDist) {
          bestDist = d
          best = i
        }
      })
      if (el.scrollLeft >= max - 2) best = list.length - 1
      setIndex(best)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [scrollerRef, slides, count, align])

  const goTo = useCallback(
    (i: number, focus = false) => {
      const el = scrollerRef.current
      const list = slides()
      const target = list[Math.max(0, Math.min(list.length - 1, i))]
      if (!el || !target) return
      const box = el.getBoundingClientRect()
      const r = target.getBoundingClientRect()
      const left =
        align === 'center'
          ? el.scrollLeft + (r.left + r.width / 2) - (box.left + box.width / 2)
          : el.scrollLeft + (r.left - box.left) - parseFloat(getComputedStyle(el).scrollPaddingLeft || '0')
      el.scrollTo({ left: Math.max(0, left), behavior: calm ? 'auto' : 'smooth' })
      if (focus) target.querySelector<HTMLElement>('button, a, [tabindex]')?.focus({ preventScroll: true })
    },
    [scrollerRef, slides, calm, align],
  )

  // Mouse drag with inertia. Snap is suspended while dragging so the motion stays fluid.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el || !drag) return
    let down = false
    let startX = 0
    let startLeft = 0
    let lastX = 0
    let lastT = 0
    let velocity = 0
    let raf = 0
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      down = true
      dragged.current = false
      startX = lastX = e.clientX
      startLeft = el.scrollLeft
      lastT = performance.now()
      velocity = 0
      cancelAnimationFrame(raf)
    }
    const onMove = (e: PointerEvent) => {
      if (!down) return
      const dx = e.clientX - startX
      if (!dragged.current && Math.abs(dx) > 6) {
        dragged.current = true
        el.dataset.dragging = 'true'
        el.setPointerCapture(e.pointerId)
      }
      if (!dragged.current) return
      const now = performance.now()
      velocity = (e.clientX - lastX) / Math.max(1, now - lastT)
      lastX = e.clientX
      lastT = now
      el.scrollLeft = startLeft - dx
    }
    const onUp = (e: PointerEvent) => {
      if (!down) return
      down = false
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      if (!dragged.current) return
      let v = velocity * 16
      const glide = () => {
        if (Math.abs(v) < 0.4 || calm) {
          delete el.dataset.dragging
          return
        }
        el.scrollLeft -= v
        v *= 0.92
        raf = requestAnimationFrame(glide)
      }
      raf = requestAnimationFrame(glide)
      window.setTimeout(() => (dragged.current = false), 0)
    }
    // Swallow the click that ends a drag so slides don't open by accident.
    const onClick = (e: MouseEvent) => {
      if (dragged.current) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('click', onClick, true)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('click', onClick, true)
    }
  }, [scrollerRef, drag, calm])

  return { index, progress, goTo }
}

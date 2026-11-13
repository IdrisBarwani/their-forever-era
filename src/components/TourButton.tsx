import { useEffect, useRef, useState } from 'react'
import { TOUR } from '../config/site'
import { tour, useTourState } from '../lib/tour'
import { PauseIcon, PlayIcon } from './icons'

const R = 20
const C = 2 * Math.PI * R

/**
 * Header play button: plays the whole page slowly, with music. While playing, a ring around
 * the button fills with the progress; pressing it again (or scrolling, tapping, any key) pauses.
 */
export function TourButton() {
  const state = useTourState()
  const ring = useRef<SVGCircleElement>(null)
  const [status, setStatus] = useState('')

  // The ring follows the play-through frame by frame without re-rendering React.
  useEffect(() => {
    const el = ring.current
    if (!el) return
    const paint = () => el.style.setProperty('stroke-dashoffset', String(C * (1 - tour.progress())))
    paint()
    if (state !== 'playing') return
    let raf = 0
    const tick = () => {
      paint()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [state])

  // Spoken status for screen readers.
  useEffect(() => {
    setStatus(state === 'playing' ? TOUR.started : state === 'paused' ? TOUR.paused : state === 'done' ? TOUR.finished : '')
  }, [state])

  const label = state === 'playing' ? TOUR.pause : state === 'paused' ? TOUR.resume : state === 'done' ? TOUR.again : TOUR.play

  return (
    <>
      <button type="button" className="icon-btn tour-btn" data-tour-keep data-state={state} aria-label={label} title={label} onClick={() => tour.toggle()}>
        <svg className="tour-btn__ring" viewBox="0 0 48 48" aria-hidden="true">
          <circle className="tour-btn__track" cx="24" cy="24" r={R} />
          <circle ref={ring} className="tour-btn__fill" cx="24" cy="24" r={R} strokeDasharray={C} strokeDashoffset={C} />
        </svg>
        {state === 'playing' ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
      </button>
      <span className="visually-hidden" role="status" aria-live="polite">
        {status}
      </span>
    </>
  )
}

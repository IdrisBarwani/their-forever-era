import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { WISHES_COPY, type Wish } from '../config/site'
import { MEMBER_CARDS } from '../config/media'
import { Constellation } from '../components/Constellation'
import { Photo } from '../components/Photo'
import { StarIcon } from '../components/icons'
import { gsap } from '../lib/gsap'
import { useMotion } from '../lib/motion'

type Props = {
  wish: Wish
  index: number
  open: boolean
  onToggle: (open: boolean) => void
}

/** One individually designed photocard: photo on the front, the wish on the back. */
export function WishCard({ wish, index, open, onToggle }: Props) {
  const cardRef = useRef<HTMLElement>(null)
  const tiltRef = useRef<HTMLDivElement>(null)
  const openBtn = useRef<HTMLButtonElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(open)
  const { finePointer, motion } = useMotion()
  const number = String(index + 1).padStart(2, '0')
  const backId = `wish-back-${wish.id}`

  // Move focus to the revealed face, and back to the trigger when the card closes.
  useEffect(() => {
    if (open && !wasOpen.current) window.setTimeout(() => closeBtn.current?.focus({ preventScroll: true }), motion ? 320 : 0)
    if (!open && wasOpen.current && cardRef.current?.contains(document.activeElement)) openBtn.current?.focus({ preventScroll: true })
    wasOpen.current = open
  }, [open, motion])

  // Restrained 3D tilt and a pointer-following highlight on capable devices.
  useEffect(() => {
    const card = cardRef.current
    const tilt = tiltRef.current
    if (!card || !tilt || !finePointer || !motion) return
    gsap.set(tilt, { transformPerspective: 1000 })
    const rx = gsap.quickTo(tilt, 'rotationX', { duration: 0.6, ease: 'power3.out' })
    const ry = gsap.quickTo(tilt, 'rotationY', { duration: 0.6, ease: 'power3.out' })
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const r = card.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width
      const py = (e.clientY - r.top) / r.height
      rx((0.5 - py) * 9)
      ry((px - 0.5) * 11)
      card.style.setProperty('--gx', `${px * 100}%`)
      card.style.setProperty('--gy', `${py * 100}%`)
      card.dataset.lit = 'true'
    }
    const leave = () => {
      rx(0)
      ry(0)
      card.dataset.lit = 'false'
    }
    card.addEventListener('pointermove', move)
    card.addEventListener('pointerleave', leave)
    return () => {
      card.removeEventListener('pointermove', move)
      card.removeEventListener('pointerleave', leave)
      gsap.set(tilt, { rotationX: 0, rotationY: 0 })
    }
  }, [finePointer, motion])

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      onToggle(false)
    }
  }

  const style = { '--accent': wish.accent, '--accent-soft': wish.accentSoft } as CSSProperties

  return (
    <article
      ref={cardRef}
      className={`wish-card wish-card--${wish.design}`}
      data-open={open || undefined}
      style={style}
      aria-label={`Photocard ${number} of 07: ${wish.member}, wish for ${wish.theme}`}
      onKeyDown={onKeyDown}
    >
      <div ref={tiltRef} className="wish-card__tilt">
        <div className="wish-card__flip">
          {/* Front */}
          <div className="wish-card__face wish-card__front" inert={open}>
            <div className="wish-card__media">
              <Photo id={MEMBER_CARDS[wish.id]} sizes="(max-width: 767px) 78vw, 340px" className="wish-card__photo" />
              {wish.design === 'orbit' && (
                <svg className="wish-card__orbits" viewBox="0 0 100 160" preserveAspectRatio="none" aria-hidden="true">
                  <ellipse cx="50" cy="62" rx="58" ry="20" />
                  <ellipse cx="50" cy="62" rx="44" ry="13" />
                </svg>
              )}
              {wish.design === 'constellation' && <Constellation className="wish-card__overlay-constellation" showBeyond={false} />}
              {wish.design === 'sunburst' && <span className="wish-card__rays" aria-hidden="true" />}
            </div>
            <div className="wish-card__frame" aria-hidden="true" />
            <span className="wish-card__glare" aria-hidden="true" />
            {wish.design === 'ticket' && (
              <span className="wish-card__ticket" aria-hidden="true">
                Admit two · Forever Era
              </span>
            )}
            {wish.design === 'mono' && <span className="wish-card__barcode" aria-hidden="true" />}
            <div className="wish-card__top">
              <span className="wish-card__no">{number}</span>
            </div>
            <div className="wish-card__meta">
              <p className="wish-card__member">{wish.member}</p>
              <p className="wish-card__theme">
                <StarIcon size={10} /> {wish.theme}
              </p>
              <button ref={openBtn} type="button" className="wish-card__btn" aria-expanded={open} aria-controls={backId} onClick={() => onToggle(true)}>
                {WISHES_COPY.open}
                <span className="visually-hidden">: {wish.theme}</span>
              </button>
            </div>
          </div>

          {/* Back */}
          <div id={backId} className="wish-card__face wish-card__back" inert={!open} role="group" aria-label={`${wish.theme}: wish ${number}`}>
            <p className="wish-card__back-kicker">
              Wish {number} · {wish.theme}
            </p>
            <p className="wish-card__wish">“{wish.text}”</p>
            <Constellation className="wish-card__mini" highlight={index} showBeyond={false} />
            <p className="wish-card__note">An original wish for Jamila &amp; Mustafa, carried by {wish.member}’s card.</p>
            <button ref={closeBtn} type="button" className="wish-card__btn wish-card__btn--close" onClick={() => onToggle(false)}>
              {WISHES_COPY.close}
              <span className="visually-hidden">: {wish.theme}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

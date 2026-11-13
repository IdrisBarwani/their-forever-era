import { useId, useLayoutEffect, useRef, useState } from 'react'
import { LETTER } from '../config/site'
import { DoorButton } from '../components/DoorButton'
import { Monogram } from '../components/Monogram'
import { Constellation } from '../components/Constellation'
import { SealButton } from '../components/SealButton'
import { StarIcon } from '../components/icons'
import { gsap, ScrollTrigger, useGSAP } from '../lib/gsap'
import { useMotion } from '../lib/motion'
import { scrollToY } from '../lib/scroll'

/**
 * Scene F — a quieter ivory chapter. The envelope's wax seal is the button: pressing it (never
 * hovering) opens the letter, whose paragraphs fade in on a gentle timer that does not depend on scrolling.
 */
export function Letter() {
  const root = useRef<HTMLElement>(null)
  const letterRef = useRef<HTMLDivElement>(null)
  const sealBtn = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const { motion, finePointer } = useMotion()
  const bodyId = useId()

  // Ambient line art drifting at different speeds (parallax) — decorative only.
  useGSAP(
    () => {
      const el = root.current
      if (!el || !motion) return
      el.querySelectorAll<HTMLElement>('[data-drift]').forEach((art) => {
        gsap.fromTo(
          art,
          { yPercent: Number(art.dataset.drift) * -1 },
          { yPercent: Number(art.dataset.drift), ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } },
        )
      })
      // Opacity only (not visibility): the envelope's button stays in the Tab order before its reveal.
      gsap.from(el.querySelectorAll('.letter-head > *, .envelope-wrap'), {
        opacity: 0,
        y: 30,
        stagger: 0.12,
        duration: 1,
        scrollTrigger: { trigger: el, start: 'top 70%' },
      })
    },
    { scope: root, dependencies: [motion], revertOnUpdate: true },
  )

  // Opening and folding choreography (layout effect: initial states are set before paint).
  useLayoutEffect(() => {
    const el = root.current
    const letter = letterRef.current
    if (!el || !letter) return
    const paras = letter.querySelectorAll('.letter-para')
    if (open) {
      if (motion) {
        const seal = el.querySelector('.envelope__seal')
        const tl = gsap.timeline({ onComplete: () => ScrollTrigger.refresh() })
        // The pressed seal swells for a moment and lifts away, then the flap opens.
        tl.to(seal, { scale: 1.12, duration: 0.2, ease: 'power2.out' }, 0)
          .to(seal, { autoAlpha: 0, scale: 0.7, duration: 0.35, ease: 'power2.in' }, 0.2)
          .to(el.querySelector('.envelope-hint'), { autoAlpha: 0, duration: 0.3 }, 0)
          .to(el.querySelector('.envelope__flap'), { rotateX: 180, duration: 0.7, ease: 'power2.inOut' }, 0.2)
          .to(el.querySelector('.envelope__paper'), { yPercent: -38, duration: 0.7, ease: 'power3.out' }, 0.65)
          .to(el.querySelector('.envelope-wrap'), { autoAlpha: 0, y: -20, scale: 0.94, duration: 0.6 }, 1.2)
          .fromTo(letter, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out' }, 1.3)
          .fromTo(paras, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.22, ease: 'power2.out' }, 1.55)
        letter.querySelector<HTMLElement>('.letter-salutation')?.focus({ preventScroll: true })
        // bring the letter into view gently if it starts low on the screen
        const r = letter.getBoundingClientRect()
        if (r.top > window.innerHeight * 0.45) scrollToY(window.scrollY + r.top - 96, { duration: 1.2 })
        return () => {
          tl.kill()
        }
      }
      ScrollTrigger.refresh()
      letter.querySelector<HTMLElement>('.letter-salutation')?.focus({ preventScroll: true })
      return
    }
    // folded
    gsap.set(el.querySelectorAll('.envelope__flap, .envelope__seal, .envelope__paper, .envelope-wrap, .envelope-hint'), { clearProps: 'all' })
    ScrollTrigger.refresh()
  }, [open, motion])

  const fold = () => {
    setOpen(false)
    requestAnimationFrame(() => sealBtn.current?.focus({ preventScroll: false }))
  }

  return (
    <section id="letter" ref={root} className="scene letter" data-theme="light" aria-labelledby="letter-title">
      <svg className="letter-art letter-art--a" data-drift="18" viewBox="0 0 200 200" aria-hidden="true">
        <path d="M100 178C52 140 22 112 22 78a38 38 0 0 1 78-16 38 38 0 0 1 78 16c0 34-30 62-78 100Z" />
        <path d="M100 160C62 130 40 108 40 82a26 26 0 0 1 60-12" />
      </svg>
      <svg className="letter-art letter-art--b" data-drift="34" viewBox="0 0 200 260" aria-hidden="true">
        <path d="M40 250V96a60 60 0 0 1 120 0v154" />
        <path d="M58 250V100a42 42 0 0 1 84 0v150" />
        <circle cx="128" cy="170" r="4" />
      </svg>
      <svg className="letter-art letter-art--c" data-drift="24" viewBox="0 0 200 200" aria-hidden="true">
        <path d="M30 150c30-60 60-90 120-110M60 170c20-40 50-80 110-96" />
        <path d="M150 40c2 10 6 14 16 16-10 2-14 6-16 16-2-10-6-14-16-16 10-2 14-6 16-16Z" />
      </svg>

      <div className="letter-inner">
        <header className="letter-head">
          <p className="eyebrow">{LETTER.eyebrow}</p>
          <h2 id="letter-title" className="section-title" data-chapter-focus tabIndex={-1}>
            {LETTER.title}
          </h2>
        </header>

        <div className="letter-stage" data-open={open || undefined}>
        <div className="envelope-wrap" hidden={open && !motion} inert={open}>
          <div className="envelope">
            <div className="envelope__back" aria-hidden="true" />
            <div className="envelope__paper" aria-hidden="true">
              <span>Dear Jamila and Mustafa,</span>
              <Constellation className="envelope__paper-art" showBeyond={false} />
            </div>
            <div className="envelope__front" aria-hidden="true" />
            <div className="envelope__flap" aria-hidden="true" />
            {/* The J&M wax seal is the button that opens the letter. */}
            <SealButton
              ref={sealBtn}
              className="envelope__seal"
              label={LETTER.open}
              size={92}
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => setOpen(true)}
            />
          </div>
          <p className="envelope-hint" aria-hidden="true">
            <StarIcon size={11} /> {finePointer ? LETTER.sealHint.pointer : LETTER.sealHint.touch}
          </p>
        </div>

        <div ref={letterRef} id={bodyId} className="letter-paper" hidden={!open}>
          <div className="letter-paper__edge" aria-hidden="true" />
          <Monogram className="letter-paper__mark" size={46} />
          <p className="letter-salutation letter-para" tabIndex={-1}>
            {LETTER.salutation}
          </p>
          {LETTER.paragraphs.map((p) => (
            <p key={p} className="letter-para">
              {p}
            </p>
          ))}
          <p className="letter-para letter-closing">{LETTER.closing}</p>
          <p className="letter-para letter-signature">{LETTER.signature}</p>
          <div className="letter-para letter-actions">
            <DoorButton variant="light" size="sm" onClick={fold} aria-expanded={open} aria-controls={bodyId}>
              {LETTER.close}
            </DoorButton>
          </div>
        </div>
        </div>
      </div>
    </section>
  )
}

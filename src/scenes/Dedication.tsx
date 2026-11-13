import { useRef } from 'react'
import { DEDICATION } from '../config/site'
import { StarIcon } from '../components/icons'
import { gsap, useGSAP } from '../lib/gsap'
import { useMotion } from '../lib/motion'

/**
 * A small, quiet note from the person who made the site, after the finale and before the footer.
 * Not a chapter: the wedding stays the focus, so it has no place in the setlist navigation.
 */
export function Dedication() {
  const root = useRef<HTMLElement>(null)
  const { motion } = useMotion()

  useGSAP(
    () => {
      const el = root.current
      if (!el || !motion) return
      const st = { trigger: el, start: 'top 78%', once: true }
      gsap.from(el.querySelectorAll('.dedication__reveal'), { autoAlpha: 0, y: 22, duration: 1, stagger: 0.12, ease: 'power2.out', scrollTrigger: st })
      gsap.from(el.querySelector('.dedication__flourish path'), { drawSVG: '0%', duration: 1.6, delay: 0.9, ease: 'power2.inOut', scrollTrigger: st })
      gsap.from(el.querySelector('.dedication__flourish-star'), { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%', duration: 0.6, delay: 2.2, ease: 'back.out(3)', scrollTrigger: st })
    },
    { scope: root, dependencies: [motion], revertOnUpdate: true },
  )

  return (
    <section ref={root} id="dedication" className="scene dedication" data-theme="dark" aria-labelledby="dedication-title">
      <div className="dedication__card">
        <StarIcon size={14} className="dedication__star dedication__reveal" />
        <h2 id="dedication-title" className="dedication__heading dedication__reveal">
          {DEDICATION.heading}
        </h2>
        <div className="dedication__body">
          <p className="dedication__salutation dedication__reveal">{DEDICATION.salutation}</p>
          {DEDICATION.paragraphs.map((p) => (
            <p key={p} className="dedication__reveal">
              {p}
            </p>
          ))}
          <p className="dedication__closing dedication__reveal">{DEDICATION.closing}</p>
        </div>
        <div className="dedication__signature dedication__reveal">
          <p className="dedication__name">{DEDICATION.signature}</p>
          <svg className="dedication__flourish" viewBox="0 0 320 40" aria-hidden="true" focusable="false">
            <path d="M6 26C58 20 104 30 150 24s88-16 128-8c14 3 22 8 30 4" />
            <path className="dedication__flourish-star" d="M308 6c.5 3.1 1.9 4.5 5 5-3.1.5-4.5 1.9-5 5-.5-3.1-1.9-4.5-5-5 3.1-.5 4.5-1.9 5-5Z" />
          </svg>
          <p className="dedication__supporting">{DEDICATION.supporting}</p>
        </div>
      </div>
    </section>
  )
}

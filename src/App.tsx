import { useEffect } from 'react'
import { CHAPTERS } from './config/site'
import { Cursor } from './components/Cursor'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { ScrollTrigger } from './lib/gsap'
import { MotionProvider, useMotion } from './lib/motion'
import { disableSmoothScroll, enableSmoothScroll, scrollToSection } from './lib/scroll'
import { Dedication } from './scenes/Dedication'
import { FilmMoment } from './scenes/FilmMoment'
import { Finale } from './scenes/Finale'
import { Invitation } from './scenes/Invitation'
import { Letter } from './scenes/Letter'
import { PurpleArchive } from './scenes/PurpleArchive'
import { SevenWishes } from './scenes/SevenWishes'
import { WrittenInTheStars } from './scenes/WrittenInTheStars'

export default function App() {
  return (
    <MotionProvider>
      <Experience />
    </MotionProvider>
  )
}

function Experience() {
  const { finePointer, motion, stage } = useMotion()
  const smooth = finePointer && motion

  // One scroll owner: Lenis on desktop with full effects, native scrolling everywhere else.
  useEffect(() => {
    if (!smooth) return
    enableSmoothScroll()
    ScrollTrigger.refresh()
    return () => disableSmoothScroll()
  }, [smooth])

  // Re-measure every scene once fonts and images have settled, and after layout-mode changes.
  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      if (!cancelled) ScrollTrigger.refresh()
    }
    void document.fonts?.ready.then(refresh)
    if (document.readyState === 'complete') requestAnimationFrame(refresh)
    else window.addEventListener('load', refresh, { once: true })
    ScrollTrigger.sort()
    requestAnimationFrame(refresh)
    return () => {
      cancelled = true
      window.removeEventListener('load', refresh)
    }
  }, [stage, motion])

  // Honour a chapter link in the address bar (for example …/#letter) once the scenes exist.
  // Such links start with the door already open (see lib/gate.ts); #invitation keeps the door.
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1))
    if (id === 'invitation' || !CHAPTERS.some((c) => c.id === id)) return
    const t = window.setTimeout(() => scrollToSection(id as (typeof CHAPTERS)[number]['id'], { immediate: true, focus: false }), 350)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <>
      <a className="skip-link" href="#letter" onClick={(e) => {
        e.preventDefault()
        scrollToSection('letter')
      }}>
        Skip to the wedding letter
      </a>
      <Header />
      <Cursor />
      <main id="main">
        <Invitation />
        <WrittenInTheStars />
        <SevenWishes />
        <PurpleArchive />
        <FilmMoment />
        <Letter />
        <Finale />
        <Dedication />
      </main>
      <Footer />
      <div className="grain" aria-hidden="true" />
    </>
  )
}

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from 'react'
import { CHAPTERS, type ChapterId } from '../config/site'
import { useChapterTracking } from '../lib/chapters'
import { useMotion } from '../lib/motion'
import { lockScroll, scrollToSection, unlockScroll } from '../lib/scroll'
import { Monogram } from './Monogram'
import { SoundToggle } from './SoundToggle'
import { TourButton } from './TourButton'
import { CalmIcon, CloseIcon, MenuIcon, SparkleTrailIcon, StarIcon } from './icons'

export function Header() {
  const barRef = useRef<HTMLSpanElement>(null)
  const active = useChapterTracking((p) => {
    if (barRef.current) barRef.current.style.transform = `scaleX(${p})`
  })
  const chapter = CHAPTERS.find((c) => c.id === active) ?? CHAPTERS[0]
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = chapter.theme
  }, [chapter.theme])

  const go = useCallback((event: MouseEvent<HTMLAnchorElement>, id: ChapterId) => {
    event.preventDefault()
    scrollToSection(id)
  }, [])

  return (
    <header className="site-header" data-theme={chapter.theme} data-scrolled={scrolled || undefined}>
      <div className="site-header__inner">
        <a href="#invitation" className="brand" onClick={(e) => go(e, 'invitation')} aria-label="Jamila & Mustafa, back to the invitation">
          <Monogram size={34} />
          <span className="brand__text" aria-hidden="true">
            J&amp;M <span className="brand__era">Forever Era</span>
          </span>
        </a>

        <nav className="chapter-nav" aria-label="Chapters">
          <ol>
            {CHAPTERS.map((c) => (
              <li key={c.id}>
                <a href={`#${c.id}`} onClick={(e) => go(e, c.id)} aria-current={c.id === active ? 'location' : undefined} className="chapter-nav__link">
                  <span className="chapter-nav__no">{c.track}</span>
                  {c.short}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="header-tools">
          <Setlist active={active} onSelect={(id) => scrollToSection(id)} />
          <SoundToggle compact />
          <EffectsToggle />
          <TrailToggle />
          <MobileMenu active={active} />
          <TourButton />
        </div>
      </div>
      <span className="header-progress" aria-hidden="true">
        <span ref={barRef} className="header-progress__bar" />
      </span>
    </header>
  )
}

function EffectsToggle({ withLabel = false }: { withLabel?: boolean }) {
  const { calm, setCalm } = useMotion()
  return (
    <button
      type="button"
      className={`icon-btn effects-toggle${withLabel ? ' icon-btn--labelled' : ''}`}
      aria-pressed={calm}
      onClick={() => setCalm(!calm)}
      title={calm ? 'Calm mode is on: switch back to full effects' : 'Switch to calm mode: fewer effects, same story'}
    >
      <CalmIcon />
      <span className={withLabel ? undefined : 'visually-hidden'}>{calm ? 'Calm mode on' : 'Calm mode'}</span>
    </button>
  )
}

function TrailToggle({ withLabel = false }: { withLabel?: boolean }) {
  const { trail, setTrail, finePointer, calm } = useMotion()
  if (!finePointer || calm) return null
  return (
    <button
      type="button"
      className={`icon-btn trail-toggle${withLabel ? ' icon-btn--labelled' : ''}`}
      aria-pressed={trail}
      onClick={() => setTrail(!trail)}
      title={trail ? 'Turn off the star trail' : 'Turn on the star trail'}
    >
      <SparkleTrailIcon />
      <span className={withLabel ? undefined : 'visually-hidden'}>Star trail</span>
    </button>
  )
}

/** Desktop chapter selector, styled like a concert setlist. */
function Setlist({ active, onSelect }: { active: ChapterId; onSelect: (id: ChapterId) => void }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const current = CHAPTERS.find((c) => c.id === active) ?? CHAPTERS[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    const first = panelRef.current?.querySelector<HTMLAnchorElement>('[aria-current="location"]') ?? panelRef.current?.querySelector('a')
    first?.focus()
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onPanelKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
    const links = Array.from(panelRef.current?.querySelectorAll<HTMLAnchorElement>('a') ?? [])
    const i = links.indexOf(document.activeElement as HTMLAnchorElement)
    let next = i
    if (e.key === 'ArrowDown') next = (i + 1) % links.length
    if (e.key === 'ArrowUp') next = (i - 1 + links.length) % links.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = links.length - 1
    e.preventDefault()
    links[next]?.focus()
  }

  return (
    <div className="setlist">
      <button
        ref={buttonRef}
        type="button"
        className="setlist__button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="setlist__label">Setlist</span>
        <span className="setlist__now">
          <span className="setlist__track">{current.track}</span> {current.short}
        </span>
        <svg className="setlist__chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <div ref={panelRef} id={panelId} className="setlist__panel" hidden={!open} onKeyDown={onPanelKey}>
        <p className="setlist__heading">
          <StarIcon size={12} /> Their Forever Era · Setlist
        </p>
        <ol className="setlist__list">
          {CHAPTERS.map((c) => (
            <li key={c.id}>
              <a
                href={`#${c.id}`}
                className="setlist__item"
                aria-current={c.id === active ? 'location' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  setOpen(false)
                  onSelect(c.id)
                }}
              >
                <span className="setlist__no">{c.track}</span>
                <span className="setlist__title">{c.title}</span>
                {c.id === active && (
                  <span className="eq" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

/** Mobile full-screen setlist sheet with focus management and scroll restoration. */
function MobileMenu({ active }: { active: ChapterId }) {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const pending = useRef<ChapterId | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      lockScroll()
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const onClose = () => {
    setOpen(false)
    unlockScroll()
    const target = pending.current
    pending.current = null
    if (target) requestAnimationFrame(() => scrollToSection(target))
    else buttonRef.current?.focus()
  }

  return (
    <>
      <button ref={buttonRef} type="button" className="icon-btn menu-btn" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <MenuIcon />
        <span className="visually-hidden">Open the setlist menu</span>
      </button>
      <dialog
        ref={dialogRef}
        className="mobile-menu"
        aria-label="Setlist menu"
        data-lenis-prevent
        onClose={onClose}
        onCancel={(e) => {
          e.preventDefault()
          setOpen(false)
        }}
      >
        <div className="mobile-menu__top">
          <span className="mobile-menu__brand">
            <Monogram size={30} /> Setlist
          </span>
          <button type="button" className="icon-btn" onClick={() => setOpen(false)} autoFocus>
            <CloseIcon />
            <span className="visually-hidden">Close menu</span>
          </button>
        </div>
        <ol className="mobile-menu__list">
          {CHAPTERS.map((c) => (
            <li key={c.id}>
              <a
                href={`#${c.id}`}
                aria-current={c.id === active ? 'location' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  pending.current = c.id
                  setOpen(false)
                }}
              >
                <span className="mobile-menu__no">{c.track}</span>
                <span className="mobile-menu__title">{c.title}</span>
              </a>
            </li>
          ))}
        </ol>
        <div className="mobile-menu__settings">
          <p className="mobile-menu__label">Stage settings</p>
          <SoundToggle withLabel />
          <EffectsToggle withLabel />
        </div>
      </dialog>
    </>
  )
}

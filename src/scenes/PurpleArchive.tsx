import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { ARCHIVE_COPY } from '../config/site'
import { GALLERY_TABS, image, type GalleryTab, type ImageId } from '../config/media'
import { Photo } from '../components/Photo'
import { ArrowIcon, CloseIcon, ExpandIcon, StarIcon } from '../components/icons'
import { gsap, useGSAP } from '../lib/gsap'
import { useMotion } from '../lib/motion'
import { lockScroll, unlockScroll } from '../lib/scroll'
import { useCarousel } from '../lib/useCarousel'

type TabId = GalleryTab['id']

function variantFor(ratio: number, i: number): 'wide' | 'tall' | 'mid' | 'small' {
  if (ratio < 0.9) return 'tall'
  if (ratio > 1.75) return 'wide'
  return i % 3 === 2 ? 'small' : 'mid'
}

/** Scene D — the purple archive: tabbed editorial gallery, swipe/drag carousel and an accessible viewer. */
export function PurpleArchive() {
  const [tab, setTab] = useState<TabId>('together')
  const [viewer, setViewer] = useState<{ tab: TabId; index: number } | null>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const uid = useId()

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const ids = GALLERY_TABS.map((t) => t.id)
    const i = ids.indexOf(tab)
    let next = -1
    if (e.key === 'ArrowRight') next = (i + 1) % ids.length
    if (e.key === 'ArrowLeft') next = (i - 1 + ids.length) % ids.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = ids.length - 1
    if (next < 0) return
    e.preventDefault()
    setTab(ids[next])
    tabsRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  const viewerItems = viewer ? GALLERY_TABS.find((t) => t.id === viewer.tab)!.images : []

  return (
    <section id="archive" className="scene archive" data-theme="dark" aria-labelledby="archive-title">
      <div className="archive-head">
        <p className="eyebrow">{ARCHIVE_COPY.eyebrow}</p>
        <h2 id="archive-title" className="section-title" data-chapter-focus tabIndex={-1}>
          {ARCHIVE_COPY.title}
        </h2>
        <p className="archive-intro">{ARCHIVE_COPY.intro}</p>
      </div>

      <div ref={tabsRef} className="archive-tabs" role="tablist" aria-label="Archive themes" onKeyDown={onTabKey}>
        {GALLERY_TABS.map((t) => (
          <button
            key={t.id}
            id={`${uid}-tab-${t.id}`}
            type="button"
            role="tab"
            className="archive-tab"
            aria-selected={tab === t.id}
            aria-controls={`${uid}-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
          >
            <StarIcon size={10} className="archive-tab__star" />
            {t.label}
            <span className="archive-tab__count">{String(t.images.length).padStart(2, '0')}</span>
          </button>
        ))}
      </div>

      {GALLERY_TABS.map((t) => (
        <div
          key={t.id}
          id={`${uid}-panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-${t.id}`}
          hidden={tab !== t.id}
          className="archive-panel"
        >
          {tab === t.id && <ArchiveCarousel tab={t} onOpen={(index) => setViewer({ tab: t.id, index })} />}
        </div>
      ))}

      <Lightbox
        items={viewerItems}
        index={viewer?.index ?? null}
        onIndex={(index) => setViewer((v) => (v ? { ...v, index } : v))}
        onClose={() => setViewer(null)}
      />
    </section>
  )
}

function ArchiveCarousel({ tab, onOpen }: { tab: GalleryTab; onOpen: (index: number) => void }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const { calm, motion } = useMotion()
  const { index, progress, goTo } = useCarousel(scrollerRef, tab.images.length, { calm })
  const count = tab.images.length

  // Masked reveal whenever a tab opens (and the first time the archive scrolls into view).
  useGSAP(
    () => {
      const el = scrollerRef.current
      if (!el || !motion) return
      const media = el.querySelectorAll('.archive-media')
      const caps = el.querySelectorAll('.archive-caption')
      gsap.fromTo(
        media,
        { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.08 },
        {
          clipPath: 'inset(0% 0% 0% 0%)',
          scale: 1,
          duration: 1.2,
          stagger: 0.09,
          ease: 'power3.inOut',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        },
      )
      gsap.from(caps, { autoAlpha: 0, y: 14, duration: 0.8, stagger: 0.09, delay: 0.5, scrollTrigger: { trigger: el, start: 'top 85%', once: true } })
    },
    { scope: scrollerRef, dependencies: [tab.id, motion], revertOnUpdate: true },
  )

  // Gentle in-frame parallax as slides travel across the carousel.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el || !motion) return
    let frame = 0
    const update = () => {
      frame = 0
      const box = el.getBoundingClientRect()
      el.querySelectorAll<HTMLElement>('[data-slide]').forEach((slide) => {
        const r = slide.getBoundingClientRect()
        const shift = (r.left + r.width / 2 - (box.left + box.width / 2)) / box.width
        slide.style.setProperty('--shift', Math.max(-1.2, Math.min(1.2, shift)).toFixed(3))
      })
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
  }, [motion, tab.id])

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    goTo(index + (e.key === 'ArrowRight' ? 1 : -1), true)
  }

  return (
    <div className="archive-carousel">
      <p className="archive-blurb">{tab.blurb}</p>
      <div
        ref={scrollerRef}
        className="archive-scroller"
        data-lenis-prevent-horizontal
        aria-roledescription="carousel"
        aria-label={`${tab.label} photos`}
        onKeyDown={onKey}
      >
        <ol className="archive-track">
          {tab.images.map((id, i) => {
            const meta = image(id)
            const ratio = meta.width / meta.height
            const variant = variantFor(ratio, i)
            return (
              <li
                key={id}
                className={`archive-slide archive-slide--${variant}`}
                data-slide={i}
                style={{ '--ratio': ratio.toFixed(4) } as CSSProperties}
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}`}
              >
                <figure className="archive-figure">
                  <button type="button" className="archive-thumb" onClick={() => onOpen(i)} data-cursor>
                    <span className="archive-media">
                      <Photo id={id} sizes={variant === 'wide' ? '(max-width: 767px) 92vw, 70vw' : '(max-width: 767px) 70vw, 40vw'} className="archive-img" />
                    </span>
                    <span className="archive-open" aria-hidden="true">
                      <ExpandIcon size={16} />
                    </span>
                    <span className="visually-hidden">Open photo {i + 1}: {meta.caption}</span>
                  </button>
                  <figcaption className="archive-caption" aria-hidden="true">
                    <span className="archive-caption__no">{String(i + 1).padStart(2, '0')}</span>
                    {meta.caption}
                  </figcaption>
                </figure>
              </li>
            )
          })}
        </ol>
      </div>
      <div className="carousel-controls archive-controls">
        <button type="button" className="round-btn" onClick={() => goTo(index - 1, true)} disabled={index === 0}>
          <ArrowIcon direction="left" />
          <span className="visually-hidden">Previous photo</span>
        </button>
        <div className="archive-position" aria-live="polite">
          <span className="archive-position__count">
            {String(index + 1).padStart(2, '0')} <span>/ {String(count).padStart(2, '0')}</span>
          </span>
          <span className="archive-position__bar" aria-hidden="true">
            <span style={{ transform: `scaleX(${Math.max(0.04, progress)})` }} />
          </span>
          <span className="archive-position__hint">{ARCHIVE_COPY.dragHint}</span>
        </div>
        <button type="button" className="round-btn" onClick={() => goTo(index + 1, true)} disabled={index >= count - 1}>
          <ArrowIcon />
          <span className="visually-hidden">Next photo</span>
        </button>
      </div>
    </div>
  )
}

function Lightbox({ items, index, onIndex, onClose }: { items: readonly ImageId[]; index: number | null; onIndex: (i: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const { motion } = useMotion()
  const isOpen = index !== null
  const id = index !== null ? items[index] : null
  const meta = id ? image(id) : null

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (isOpen && !dialog.open) {
      opener.current = document.activeElement as HTMLElement
      lockScroll()
      dialog.showModal()
      if (motion) gsap.fromTo(dialog.querySelector('.lightbox__frame'), { autoAlpha: 0, scale: 0.96 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power3.out' })
    } else if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen, motion])

  const handleClose = () => {
    unlockScroll()
    onClose()
    const back = opener.current
    opener.current = null
    requestAnimationFrame(() => back?.focus({ preventScroll: true }))
  }

  const step = (d: number) => {
    if (index === null) return
    onIndex((index + d + items.length) % items.length)
  }

  return (
    <dialog
      ref={ref}
      className="lightbox"
      aria-label="Photo viewer"
      data-lenis-prevent
      onClose={handleClose}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') step(1)
        if (e.key === 'ArrowLeft') step(-1)
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close()
      }}
    >
      {meta && id && index !== null && (
        <div className="lightbox__frame">
          <figure className="lightbox__figure">
            <Photo key={id} id={id} sizes="100vw" priority className="lightbox__img" />
            <figcaption className="lightbox__caption">
              <span className="lightbox__count">
                {index + 1} of {items.length}
              </span>
              <span className="lightbox__text">{meta.caption}</span>
            </figcaption>
          </figure>
          <div className="lightbox__nav">
            <button type="button" className="round-btn" onClick={() => step(-1)}>
              <ArrowIcon direction="left" />
              <span className="visually-hidden">Previous photo</span>
            </button>
            <button type="button" className="round-btn" onClick={() => step(1)}>
              <ArrowIcon />
              <span className="visually-hidden">Next photo</span>
            </button>
          </div>
          <button type="button" className="round-btn lightbox__close" onClick={() => ref.current?.close()} autoFocus>
            <CloseIcon />
            <span className="visually-hidden">Close photo viewer</span>
          </button>
        </div>
      )}
    </dialog>
  )
}

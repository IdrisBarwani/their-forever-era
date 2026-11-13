import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { FILM_COPY } from '../config/site'
import { FILM, OFFICIAL_VIDEOS } from '../config/media'
import { Photo } from '../components/Photo'
import { PauseIcon, PlayIcon, SoundOffIcon, SoundOnIcon, StarIcon } from '../components/icons'
import { asset } from '../lib/asset'
import { gsap, ScrollTrigger, useGSAP } from '../lib/gsap'
import { useMotion } from '../lib/motion'
import { ambientSound } from '../lib/sound'
import { tourHooks } from '../lib/tourHooks'

type Mode = 'scroll' | 'play'
type Status = 'idle' | 'loading' | 'ready' | 'error'

const fmt = (s: number) => {
  if (!Number.isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}

/** Scene E — the film moment: an original scroll-scrubbed film plus official music videos. */
export function FilmMoment() {
  return (
    <section id="film" className="scene film" data-theme="dark" aria-labelledby="film-title">
      <ScrubFilm />
      <OfficialFilm />
    </section>
  )
}

function ScrubFilm() {
  const { stage, motion } = useMotion()
  const pinRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [mode, setModeState] = useState<Mode>(motion ? 'scroll' : 'play')
  const modeRef = useRef<Mode>(mode)
  const [status, setStatus] = useState<Status>('idle')
  const [loadPct, setLoadPct] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [line, setLine] = useState(0)
  const target = useRef(0)
  const seekFrame = useRef(0)
  const progressRef = useRef(0)

  const setMode = useCallback((next: Mode) => {
    modeRef.current = next
    setModeState(next)
    const v = videoRef.current
    if (!v) return
    if (next === 'scroll') {
      v.pause()
      if (v.duration) {
        target.current = progressRef.current * v.duration
        v.currentTime = target.current
      }
    }
  }, [])

  // Calm mode starts in ordinary playback; scrubbing stays available as a choice.
  useEffect(() => {
    if (!motion && modeRef.current === 'scroll') setMode('play')
  }, [motion, setMode])

  // Load the film only when the visitor gets close, as a blob so scrubbing never waits on the network.
  useEffect(() => {
    const frame = frameRef.current
    const video = videoRef.current
    if (!frame || !video) return
    let objectUrl = ''
    let cancelled = false
    const load = async () => {
      setStatus('loading')
      const url = asset(FILM.src)
      try {
        const res = await fetch(url)
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
        const total = Number(res.headers.get('content-length')) || 0
        const reader = res.body.getReader()
        const chunks: BlobPart[] = []
        let received = 0
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          received += value.length
          if (total) setLoadPct(Math.round((received / total) * 100))
        }
        if (cancelled) return
        objectUrl = URL.createObjectURL(new Blob(chunks, { type: FILM.type }))
        video.src = objectUrl
      } catch {
        if (cancelled) return
        video.src = url // let the browser stream it directly instead
      }
      video.load()
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          void load()
        }
      },
      { rootMargin: '150% 0px' },
    )
    io.observe(frame)
    return () => {
      cancelled = true
      io.disconnect()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [])

  // Media element events keep the controls truthful.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onMeta = () => {
      setDuration(v.duration)
      target.current = progressRef.current * v.duration
      if (modeRef.current === 'scroll') v.currentTime = target.current
    }
    const onReady = () => setStatus('ready')
    const onTime = () => {
      setTime(v.currentTime)
      if (modeRef.current === 'play' && v.duration) setLine(Math.min(2, Math.floor((v.currentTime / v.duration) * 3)))
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onVolume = () => setMuted(v.muted)
    const onError = () => setStatus('error')
    const onSeeked = () => {
      setTime(v.currentTime)
      if (modeRef.current === 'scroll' && Math.abs(v.currentTime - target.current) > 1 / 30) scheduleSeek()
    }
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('loadeddata', onReady)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('seeked', onSeeked)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('ended', onPause)
    v.addEventListener('volumechange', onVolume)
    v.addEventListener('error', onError)
    return () => {
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('loadeddata', onReady)
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('seeked', onSeeked)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('ended', onPause)
      v.removeEventListener('volumechange', onVolume)
      v.removeEventListener('error', onError)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Duck the ambient soundtrack while the film plays with sound.
  useEffect(() => {
    ambientSound.duck(playing && !muted)
  }, [playing, muted])

  // Pause playback when the film leaves the screen or the tab is hidden.
  useEffect(() => {
    const frame = frameRef.current
    const v = videoRef.current
    if (!frame || !v) return
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting && !v.paused) v.pause()
    })
    io.observe(frame)
    const onHidden = () => {
      if (document.hidden && !v.paused) v.pause()
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [])

  /** One seek in flight at a time: the next one is applied after `seeked`. */
  function scheduleSeek() {
    if (seekFrame.current) return
    seekFrame.current = requestAnimationFrame(() => {
      seekFrame.current = 0
      const v = videoRef.current
      if (!v || modeRef.current !== 'scroll' || !v.duration) return
      if (v.seeking) return // `seeked` will call us again
      if (Math.abs(v.currentTime - target.current) > 1 / 30) v.currentTime = target.current
    })
  }

  // Scroll mapping: pinned on desktop, a simple pass-through elsewhere.
  useGSAP(
    () => {
      const pin = pinRef.current
      const frame = frameRef.current
      if (!pin || !frame) return
      const onUpdate = (self: ScrollTrigger) => {
        progressRef.current = self.progress
        if (modeRef.current !== 'scroll') return
        setLine(Math.min(2, Math.floor(self.progress * 2.999)))
        const v = videoRef.current
        if (!v || !v.duration) return
        target.current = self.progress * v.duration
        scheduleSeek()
      }
      if (stage) {
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: pin, start: 'top top', end: '+=190%', pin: true, scrub: 0.6, anticipatePin: 1, onUpdate },
        })
        tl.fromTo(
          frame,
          { clipPath: 'inset(9% 30% 9% 30% round 999px 999px 18px 18px)' },
          { clipPath: 'inset(0% 0% 0% 0% round 22px 22px 22px 22px)', duration: 0.28, ease: 'power2.inOut' },
          0,
        )
          .fromTo(pin.querySelector('.film-head'), { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -30, duration: 0.12 }, 0.16)
          .fromTo(pin.querySelector('.film-glow'), { autoAlpha: 0.2 }, { autoAlpha: 1, duration: 0.5 }, 0)
          .to({}, { duration: 0.72 }, 0.28)
        tourHooks.filmRange = () => {
          const st = tl.scrollTrigger
          return st ? [st.start, st.end] : null
        }
        return () => {
          tourHooks.filmRange = undefined
        }
      }
      ScrollTrigger.create({ trigger: frame, start: 'top 85%', end: 'bottom 15%', onUpdate })
    },
    { dependencies: [stage], revertOnUpdate: true },
  )

  const play = async () => {
    const v = videoRef.current
    if (!v) return
    if (modeRef.current === 'scroll') setMode('play')
    if (v.paused) {
      if (v.ended || (v.duration && v.currentTime >= v.duration - 0.05)) v.currentTime = 0
      try {
        await v.play()
      } catch {
        /* the browser blocked playback; the button stays in its paused state */
      }
    } else v.pause()
  }

  const toggleMute = () => {
    const v = videoRef.current
    if (v) v.muted = !v.muted
  }

  const seek = (value: number) => {
    const v = videoRef.current
    if (!v || !v.duration) return
    if (modeRef.current === 'scroll') setMode('play')
    v.currentTime = (value / 1000) * v.duration
    setTime(v.currentTime)
    setLine(Math.min(2, Math.floor((v.currentTime / v.duration) * 3)))
  }

  const onModeKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    e.preventDefault()
    const next: Mode = mode === 'scroll' ? 'play' : 'scroll'
    setMode(next)
    ;(e.currentTarget.querySelector(`[data-mode="${next}"]`) as HTMLElement | null)?.focus()
  }

  const ready = status === 'ready'
  const failed = status === 'error'

  return (
    <div ref={pinRef} className={`film-pin ${stage ? 'film-pin--stage' : ''}`}>
      <div className="film-glow" aria-hidden="true" />
      <header className="film-head">
        <p className="eyebrow">{FILM_COPY.eyebrow}</p>
        <h2 id="film-title" className="section-title" data-chapter-focus tabIndex={-1}>
          {FILM_COPY.title}
        </h2>
      </header>

      <div ref={frameRef} className="film-frame" data-status={status} data-mode={mode}>
        <video
          ref={videoRef}
          className="film-video"
          poster={asset(FILM.poster)}
          muted
          playsInline
          preload="none"
          aria-label="Forever Era, an original concert-light film: a purple ocean of lights, two paths of stars meeting in one constellation"
          hidden={failed}
        />
        {failed && (
          <div className="film-fallback">
            <Photo id={FILM.fallbackImage} sizes="100vw" alt="" className="film-fallback__img" />
          </div>
        )}
        <div className="film-overlay" aria-live="polite">
          {FILM_COPY.lines.map((text, i) => (
            <p key={text} className="film-line" data-active={line === i || undefined} aria-hidden={line !== i}>
              {text}
            </p>
          ))}
        </div>
        {status === 'loading' && (
          <div className="film-loading" role="status">
            <span className="lightstick-spinner" aria-hidden="true" />
            {FILM_COPY.loading} {loadPct > 0 && <span className="film-loading__pct">{loadPct}%</span>}
          </div>
        )}
        {failed && (
          <p className="film-error" role="status">
            {FILM_COPY.error}
          </p>
        )}
      </div>

      {!failed && (
        <div className="film-controls">
          <div className="film-mode" role="radiogroup" aria-label="How the film plays" onKeyDown={onModeKey}>
            {(['scroll', 'play'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                data-mode={m}
                aria-checked={mode === m}
                tabIndex={mode === m ? 0 : -1}
                className="film-mode__opt"
                onClick={() => setMode(m)}
              >
                {m === 'scroll' ? FILM_COPY.modeFollow : FILM_COPY.modePlay}
              </button>
            ))}
          </div>
          <button type="button" className="round-btn" onClick={() => void play()} disabled={!ready} aria-label={playing ? 'Pause the film' : 'Play the film'}>
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button type="button" className="round-btn" onClick={toggleMute} disabled={!ready} aria-pressed={!muted} aria-label={muted ? 'Unmute the film' : 'Mute the film'}>
            {muted ? <SoundOffIcon /> : <SoundOnIcon />}
          </button>
          <label className="film-seek">
            <span className="visually-hidden">Film position</span>
            <input
              type="range"
              min={0}
              max={1000}
              step={1}
              value={duration ? Math.round((time / duration) * 1000) : 0}
              onChange={(e) => seek(Number(e.target.value))}
              disabled={!ready}
              aria-valuetext={`${fmt(time)} of ${fmt(duration)}`}
              style={{ ['--fill' as string]: `${duration ? (time / duration) * 100 : 0}%` }}
            />
          </label>
          <span className="film-time" aria-hidden="true">
            {fmt(time)} / {fmt(duration)}
          </span>
        </div>
      )}
      <p className="film-caption">
        <StarIcon size={10} /> {FILM_COPY.filmCaption}
      </p>
    </div>
  )
}

function OfficialFilm() {
  const [selected, setSelected] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const video = OFFICIAL_VIDEOS[selected]

  const choose = (i: number) => {
    setSelected(i)
    setLoaded(false)
  }

  const start = () => {
    if (ambientSound.getState() === 'on') ambientSound.stop()
    document.querySelectorAll('video').forEach((v) => v.pause())
    setLoaded(true)
  }

  return (
    <div className="official">
      <div className="official__head">
        <p className="eyebrow">
          <StarIcon size={10} /> {FILM_COPY.officialTitle}
        </p>
      </div>
      <div className="official__body">
        <ol className="official__list" aria-label="Choose a music video">
          {OFFICIAL_VIDEOS.map((v, i) => (
            <li key={v.id}>
              <button type="button" className="official__pick" aria-pressed={i === selected} onClick={() => choose(i)}>
                <span className="official__no">{String(i + 1).padStart(2, '0')}</span>
                <span className="official__title">{v.title}</span>
                <span className="official__why">{v.why}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="official__player">
          {loaded ? (
            <iframe
              key={video.id}
              className="official__iframe"
              src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&playsinline=1&modestbranding=1`}
              title={`BTS “${video.title}” official music video on YouTube (HYBE LABELS)`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <button type="button" className="official__facade" onClick={start} data-cursor>
              <Photo id={video.poster} sizes="(max-width: 900px) 100vw, 60vw" alt="" className="official__poster" />
              <span className="official__play" aria-hidden="true">
                <PlayIcon size={26} />
              </span>
              <span className="official__label">
                Play “{video.title}”<span className="official__sub">Official MV · YouTube · HYBE LABELS</span>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

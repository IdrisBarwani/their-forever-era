import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { QUERIES, useMediaQuery } from './useMediaQuery'

export type MotionSettings = {
  /** The visitor's operating-system preference. */
  reducedMotion: boolean
  /** Calm mode: no smooth scrolling, pinning, particles, parallax or tilt. All content stays. */
  calm: boolean
  setCalm: (value: boolean) => void
  /** Cursor star trail (fine pointers only). */
  trail: boolean
  setTrail: (value: boolean) => void
  /** Mouse or trackpad with hover. Touch devices never get cursor effects or magnetism. */
  finePointer: boolean
  /** Large enough viewport + fine pointer + full effects: pinned, scroll-choreographed scenes. */
  stage: boolean
  /** Phone-sized viewport. */
  small: boolean
  /** Rough device-capability signal used to scale particle counts and render resolution. */
  lowPower: boolean
  /** Full effects are allowed (not calm). */
  motion: boolean
}

const MotionContext = createContext<MotionSettings | null>(null)

const STORAGE_KEY = 'forever-era:settings'

function readStored(): { calm?: boolean; trail?: boolean } {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { calm?: boolean; trail?: boolean }
  } catch {
    return {}
  }
}

function detectLowPower(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const cores = nav.hardwareConcurrency ?? 8
  const memory = nav.deviceMemory ?? 8
  return cores <= 4 || memory <= 4
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const reducedMotion = useMediaQuery(QUERIES.reducedMotion)
  const finePointer = useMediaQuery(QUERIES.finePointer)
  const bigViewport = useMediaQuery(QUERIES.stage)
  const small = useMediaQuery(QUERIES.small)

  const [stored] = useState(readStored)
  const [calmChoice, setCalmChoice] = useState<boolean | undefined>(stored.calm)
  const [trail, setTrailState] = useState<boolean>(stored.trail ?? true)
  const [lowPower] = useState(detectLowPower)

  // Until the visitor chooses, calm mode follows the operating-system preference.
  const calm = calmChoice ?? reducedMotion

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ calm: calmChoice, trail }))
    } catch {
      /* storage can be unavailable in private modes; settings simply won't persist */
    }
  }, [calmChoice, trail])

  useEffect(() => {
    document.documentElement.dataset.motion = calm ? 'calm' : 'full'
  }, [calm])

  const setCalm = useCallback((value: boolean) => setCalmChoice(value), [])
  const setTrail = useCallback((value: boolean) => setTrailState(value), [])

  const value = useMemo<MotionSettings>(
    () => ({
      reducedMotion,
      calm,
      setCalm,
      trail,
      setTrail,
      finePointer,
      stage: !calm && finePointer && bigViewport,
      small,
      lowPower,
      motion: !calm,
    }),
    [reducedMotion, calm, setCalm, trail, setTrail, finePointer, bigViewport, small, lowPower],
  )

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>
}

export function useMotion(): MotionSettings {
  const ctx = useContext(MotionContext)
  if (!ctx) throw new Error('useMotion must be used inside <MotionProvider>')
  return ctx
}

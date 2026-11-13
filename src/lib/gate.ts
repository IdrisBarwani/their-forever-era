import { useSyncExternalStore } from 'react'
import { CHAPTERS } from '../config/site'

/**
 * The closed door at the start of the page. It stays shut until the visitor presses its seal
 * (or something asks to go further: a chapter link, the play button). Anyone can await
 * `gate.open()` to know when the visitor is inside.
 */
export type GateState = 'closed' | 'opening' | 'open'

type OpenOptions = { focus?: boolean }
type Opener = (options: OpenOptions) => void
type Listener = () => void

function initialState(): GateState {
  if (typeof window === 'undefined') return 'closed'
  // A link straight to a chapter (…/#letter) goes straight there.
  const id = decodeURIComponent(window.location.hash.slice(1))
  return id && id !== 'invitation' && CHAPTERS.some((c) => c.id === id) ? 'open' : 'closed'
}

let state: GateState = initialState()
const listeners = new Set<Listener>()
let opener: Opener | null = null
let waiting: (() => void)[] = []

function set(next: GateState) {
  if (state === next) return
  state = next
  listeners.forEach((l) => l())
  if (next === 'open') {
    const resolve = waiting
    waiting = []
    resolve.forEach((r) => r())
  }
}

export const gate = {
  get: (): GateState => state,
  set,
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  /** The door registers how it opens; returns an unregister function. */
  register(fn: Opener) {
    opener = fn
    return () => {
      if (opener === fn) opener = null
    }
  },
  /** Opens the door if it is closed, and resolves once the visitor is inside. */
  open(options: OpenOptions = {}): Promise<void> {
    if (state === 'open') return Promise.resolve()
    const inside = new Promise<void>((resolve) => waiting.push(resolve))
    if (state === 'closed') {
      if (opener) opener(options)
      else set('open')
    }
    return inside
  },
}

export function useGateState(): GateState {
  return useSyncExternalStore(gate.subscribe, gate.get, () => 'closed' as GateState)
}

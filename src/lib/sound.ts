import { useSyncExternalStore } from 'react'
import { asset } from './asset'
import { AUDIO } from '../config/media'

/**
 * Opt-in ambient soundtrack.
 * Nothing is fetched or played until the visitor presses a sound control.
 * The loop is decoded once and crossfaded into itself, so it never clicks or gaps.
 */
export type SoundState = 'off' | 'loading' | 'on' | 'error'

type Listener = () => void

const CROSSFADE = 2.5
const VOLUME = 0.55

class AmbientSound {
  state: SoundState = 'off'
  private listeners = new Set<Listener>()
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private buffer: AudioBuffer | null = null
  private voices: { source: AudioBufferSourceNode; gain: GainNode }[] = []
  private nextStart = 0
  private timer: number | null = null
  private ducked = false

  subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState = () => this.state

  private set(state: SoundState) {
    this.state = state
    this.listeners.forEach((l) => l())
  }

  async toggle() {
    if (this.state === 'on' || this.state === 'loading') this.stop()
    else await this.start()
  }

  async start() {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) throw new Error('Web Audio unavailable')
      if (!this.ctx) {
        this.ctx = new Ctor()
        this.master = this.ctx.createGain()
        this.master.gain.value = 0
        this.master.connect(this.ctx.destination)
      }
      // Resume synchronously inside the click so mobile browsers allow playback.
      const resumed = this.ctx.resume()
      this.set('loading')
      if (!this.buffer) {
        const res = await fetch(asset(AUDIO.ambient.src))
        if (!res.ok) throw new Error(`Soundtrack request failed (${res.status})`)
        const data = await res.arrayBuffer()
        this.buffer = await this.ctx.decodeAudioData(data)
      }
      await resumed
      if (this.state !== 'loading') return // visitor cancelled while loading
      this.ducked = false
      this.nextStart = this.ctx.currentTime + 0.05
      this.scheduleVoices()
      const g = this.master!.gain
      g.cancelScheduledValues(this.ctx.currentTime)
      g.setValueAtTime(g.value, this.ctx.currentTime)
      g.linearRampToValueAtTime(VOLUME, this.ctx.currentTime + 2.2)
      this.set('on')
    } catch (error) {
      console.warn('[sound]', error)
      this.set('error')
    }
  }

  stop() {
    if (this.timer) window.clearTimeout(this.timer)
    this.timer = null
    const ctx = this.ctx
    if (!ctx || !this.master) {
      this.set('off')
      return
    }
    const g = this.master.gain
    g.cancelScheduledValues(ctx.currentTime)
    g.setValueAtTime(g.value, ctx.currentTime)
    g.linearRampToValueAtTime(0, ctx.currentTime + 0.7)
    const voices = this.voices
    this.voices = []
    window.setTimeout(() => {
      voices.forEach((v) => {
        try {
          v.source.stop()
        } catch {
          /* already stopped */
        }
        v.source.disconnect()
        v.gain.disconnect()
      })
      if (this.state === 'off') void ctx.suspend()
    }, 800)
    this.set('off')
  }

  /** Temporarily lower the soundtrack while a film plays with sound. */
  duck(on: boolean) {
    if (!this.ctx || !this.master || this.state !== 'on' || this.ducked === on) return
    this.ducked = on
    const g = this.master.gain
    const t = this.ctx.currentTime
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(on ? 0 : VOLUME, t + 0.8)
  }

  private scheduleVoices() {
    const ctx = this.ctx
    const buffer = this.buffer
    if (!ctx || !buffer || !this.master) return
    // Keep roughly ten seconds of audio scheduled ahead.
    while (this.nextStart < ctx.currentTime + 10) {
      const start = this.nextStart
      const duration = buffer.duration
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(1, start + CROSSFADE)
      gain.gain.setValueAtTime(1, start + duration - CROSSFADE)
      gain.gain.linearRampToValueAtTime(0, start + duration)
      source.connect(gain).connect(this.master)
      source.start(start)
      source.stop(start + duration + 0.05)
      const voice = { source, gain }
      source.onended = () => {
        this.voices = this.voices.filter((v) => v !== voice)
        gain.disconnect()
      }
      this.voices.push(voice)
      this.nextStart = start + duration - CROSSFADE
    }
    this.timer = window.setTimeout(() => this.scheduleVoices(), 4000)
  }
}

export const ambientSound = new AmbientSound()

export function useSoundState(): SoundState {
  return useSyncExternalStore(ambientSound.subscribe, ambientSound.getState, () => 'off' as SoundState)
}

/**
 * Synthesises the tribute's original music — no samples, no third-party recordings.
 *
 *  1. "Purple Ocean" — a 48-second ambient loop for the optional site soundtrack.
 *     Warm detuned pads move through eight chords while seven bell tones (one per star)
 *     drift above them. Three identical cycles are rendered through the reverb and the
 *     middle one is kept, so the loop carries its own reverb tail and repeats seamlessly.
 *  2. "Forever Era" — a 12-second cue for the concert-light film: a swell, two answering
 *     bell lines (two paths) panned left and right that meet in the centre, then a bloom.
 *
 * Output: public/media/audio/purple-ocean.mp3 and media-src/audio/film-score.wav
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import ffmpegPath from 'ffmpeg-static'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SR = 44100
const TAU = Math.PI * 2

const mtof = (m) => 440 * 2 ** ((m - 69) / 12)

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

class Mix {
  constructor(seconds) {
    this.length = Math.ceil(seconds * SR)
    this.L = new Float32Array(this.length)
    this.R = new Float32Array(this.length)
  }

  /** Warm pad: three slightly detuned voices with a slow vibrato and a soft second harmonic. */
  pad(midi, start, duration, amp, pan = 0, random = Math.random, attack = 2.2, release = 3.2) {
    const f = mtof(midi)
    const n0 = Math.floor(start * SR)
    const n1 = Math.min(this.length, Math.floor((start + duration + release) * SR))
    const detune = [0.9984, 1, 1.0017]
    const phases = detune.map(() => random() * TAU)
    const vibPhase = random() * TAU
    const harmonic = midi < 52 ? 0.08 : 0.2
    const gl = Math.cos(((pan + 1) / 4) * Math.PI)
    const gr = Math.sin(((pan + 1) / 4) * Math.PI)
    for (let n = Math.max(0, n0); n < n1; n++) {
      const t = (n - n0) / SR
      let env
      if (t < attack) env = Math.sin((t / attack) * (Math.PI / 2)) ** 2
      else if (t < duration) env = 1
      else env = Math.max(0, 1 - (t - duration) / release) ** 2
      const vib = 1 + 0.0011 * Math.sin(TAU * 0.16 * t + vibPhase)
      let s = 0
      for (let k = 0; k < 3; k++) {
        phases[k] += (TAU * f * detune[k] * vib) / SR
        s += Math.sin(phases[k]) + harmonic * Math.sin(2 * phases[k] + 0.3)
      }
      s *= (amp * env) / 3
      this.L[n] += s * gl
      this.R[n] += s * gr
    }
  }

  /** Glassy bell: inharmonic partials with individual exponential decays. */
  bell(midi, start, amp, pan = 0, brightness = 1) {
    const f = mtof(midi)
    const partials = [
      [1, 1, 2.8],
      [2.76, 0.32 * brightness, 1.2],
      [5.4, 0.1 * brightness, 0.55],
      [8.93, 0.035 * brightness, 0.3],
    ]
    const n0 = Math.floor(start * SR)
    const n1 = Math.min(this.length, n0 + Math.floor(5.5 * SR))
    const gl = Math.cos(((pan + 1) / 4) * Math.PI)
    const gr = Math.sin(((pan + 1) / 4) * Math.PI)
    for (let n = Math.max(0, n0); n < n1; n++) {
      const t = (n - n0) / SR
      const attack = Math.min(1, t / 0.005)
      let s = 0
      for (const [ratio, a, tau] of partials) s += a * Math.exp(-t / tau) * Math.sin(TAU * f * ratio * t)
      s *= amp * attack
      this.L[n] += s * gl
      this.R[n] += s * gr
    }
  }

  /** Feedback-delay-network reverb (4 lines, Householder mixing, damped feedback). */
  reverb({ mix = 0.34, feedback = 0.885, damp = 0.42, size = 1.6 } = {}) {
    const lens = [1687, 1601, 2053, 2251].map((l) => Math.round(l * size))
    const bufs = lens.map((l) => new Float32Array(l))
    const idx = [0, 0, 0, 0]
    const lp = [0, 0, 0, 0]
    const pre = Math.round(0.018 * SR)
    const preBuf = new Float32Array(pre)
    let preIdx = 0
    const outL = new Float32Array(this.length)
    const outR = new Float32Array(this.length)
    const taps = [0, 0, 0, 0]
    for (let n = 0; n < this.length; n++) {
      const dry = (this.L[n] + this.R[n]) * 0.5
      const x = preBuf[preIdx]
      preBuf[preIdx] = dry
      preIdx = (preIdx + 1) % pre
      let sum = 0
      for (let i = 0; i < 4; i++) {
        taps[i] = bufs[i][idx[i]]
        sum += taps[i]
      }
      sum *= 0.5
      for (let i = 0; i < 4; i++) {
        const v = taps[i] - sum
        lp[i] += (v - lp[i]) * (1 - damp)
        bufs[i][idx[i]] = x + lp[i] * feedback
        idx[i] = (idx[i] + 1) % lens[i]
      }
      const wetL = taps[0] - taps[2] * 0.6 + taps[3] * 0.3
      const wetR = taps[1] - taps[3] * 0.6 + taps[2] * 0.3
      outL[n] = this.L[n] * (1 - mix) + wetL * mix
      outR[n] = this.R[n] * (1 - mix) + wetR * mix
    }
    this.L = outL
    this.R = outR
  }

  fade(inSeconds, outSeconds) {
    const fi = Math.floor(inSeconds * SR)
    const fo = Math.floor(outSeconds * SR)
    for (let n = 0; n < fi; n++) {
      const g = Math.sin(((n / fi) * Math.PI) / 2) ** 2
      this.L[n] *= g
      this.R[n] *= g
    }
    for (let n = 0; n < fo; n++) {
      const i = this.length - 1 - n
      const g = Math.sin(((n / fo) * Math.PI) / 2) ** 2
      this.L[i] *= g
      this.R[i] *= g
    }
  }

  slice(fromSeconds, toSeconds) {
    const a = Math.floor(fromSeconds * SR)
    const b = Math.floor(toSeconds * SR)
    const out = new Mix(0)
    out.length = b - a
    out.L = this.L.slice(a, b)
    out.R = this.R.slice(a, b)
    return out
  }

  normalize(peak = 0.88) {
    let max = 0
    for (let n = 0; n < this.length; n++) max = Math.max(max, Math.abs(this.L[n]), Math.abs(this.R[n]))
    const g = max > 0 ? peak / max : 1
    for (let n = 0; n < this.length; n++) {
      this.L[n] = Math.tanh(this.L[n] * g * 1.05) / Math.tanh(1.05)
      this.R[n] = Math.tanh(this.R[n] * g * 1.05) / Math.tanh(1.05)
    }
  }

  wav() {
    const data = Buffer.alloc(this.length * 4)
    for (let n = 0; n < this.length; n++) {
      data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, this.L[n])) * 32767), n * 4)
      data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, this.R[n])) * 32767), n * 4 + 2)
    }
    const header = Buffer.alloc(44)
    header.write('RIFF', 0)
    header.writeUInt32LE(36 + data.length, 4)
    header.write('WAVE', 8)
    header.write('fmt ', 12)
    header.writeUInt32LE(16, 16)
    header.writeUInt16LE(1, 20)
    header.writeUInt16LE(2, 22)
    header.writeUInt32LE(SR, 24)
    header.writeUInt32LE(SR * 4, 28)
    header.writeUInt16LE(4, 32)
    header.writeUInt16LE(16, 34)
    header.write('data', 36)
    header.writeUInt32LE(data.length, 40)
    return Buffer.concat([header, data])
  }
}

// Seven bell tones, one per star (C major pentatonic, high register).
const STARS = [76, 79, 81, 84, 86, 88, 91]

function purpleOcean() {
  const CYCLE = 48
  const CHORD = 6
  const chords = [
    [48, 55, 59, 64, 74], // Cmaj9
    [45, 52, 55, 60, 71], // Am9
    [41, 48, 57, 64, 67], // Fmaj9
    [43, 50, 57, 59, 64], // G6/9
    [40, 47, 55, 62, 71], // Em7(add11)
    [41, 48, 55, 57, 64], // Fmaj7
    [38, 50, 57, 60, 65], // Dm9
    [43, 50, 55, 60, 62], // Gsus
  ]
  const mix = new Mix(CYCLE * 3 + 6)
  for (let cycle = 0; cycle < 3; cycle++) {
    const random = rng(7) // identical every cycle, so the middle cycle loops perfectly
    const offset = cycle * CYCLE
    chords.forEach((notes, i) => {
      const start = offset + i * CHORD
      notes.forEach((m, k) => {
        const amp = k === 0 ? 0.13 : k === notes.length - 1 ? 0.05 : 0.075
        mix.pad(m, start, CHORD - 0.6, amp, (k - 2) * 0.28, random)
      })
      mix.pad(notes[0] - 12, start, CHORD - 0.6, 0.05, 0, random) // soft sub
      // two or three stars per chord
      const count = 2 + Math.floor(random() * 2)
      for (let b = 0; b < count; b++) {
        const t = start + 0.8 + random() * (CHORD - 1.6)
        const note = STARS[Math.floor(random() * STARS.length)]
        mix.bell(note, t, 0.05 + random() * 0.03, random() * 1.4 - 0.7, 0.8)
      }
    })
  }
  mix.reverb({ mix: 0.4, feedback: 0.9, size: 1.7 })
  const loop = mix.slice(CYCLE, CYCLE * 2)
  loop.normalize(0.8)
  return loop
}

function filmScore(duration) {
  const mix = new Mix(duration + 0.5)
  const random = rng(21)
  // 0–4 s: a thousand lights — a low swell from silence
  ;[45, 52, 55, 60, 64].forEach((m, k) => mix.pad(m, 0, 4.2, k === 0 ? 0.12 : 0.07, (k - 2) * 0.3, random, 2.8, 1.8))
  mix.bell(81, 1.6, 0.045, -0.3)
  mix.bell(88, 2.9, 0.04, 0.35)
  // 4–8 s: two paths — answering bell lines from left and right, converging
  ;[41, 48, 57, 64, 67].forEach((m, k) => mix.pad(m, 4, 4.1, k === 0 ? 0.12 : 0.07, (k - 2) * 0.3, random, 1.4, 1.8))
  const left = [76, 79, 81]
  const right = [91, 88, 86]
  left.forEach((m, i) => mix.bell(m, 4.3 + i * 0.9, 0.06, -0.8 + i * 0.3))
  right.forEach((m, i) => mix.bell(m, 4.75 + i * 0.9, 0.055, 0.8 - i * 0.3))
  // 8–12 s: the seventh star — a bright resolution and bloom
  ;[48, 55, 59, 64, 67, 74].forEach((m, k) => mix.pad(m, 7.9, duration - 8.4, k === 0 ? 0.14 : 0.08, (k - 2.5) * 0.25, random, 1.2, 2.4))
  mix.bell(84, 8.0, 0.09, 0, 1.2)
  STARS.forEach((m, i) => mix.bell(m, 8.6 + i * 0.22, 0.035, (i - 3) * 0.2, 1))
  mix.reverb({ mix: 0.42, feedback: 0.89, size: 1.6 })
  mix.fade(0.05, 1.6)
  mix.normalize(0.85)
  return mix
}

async function main() {
  const audioOut = path.join(root, 'public', 'media', 'audio')
  const scratch = path.join(root, 'media-src', 'audio')
  await fs.mkdir(audioOut, { recursive: true })
  await fs.mkdir(scratch, { recursive: true })

  console.log('Rendering “Purple Ocean” loop…')
  const loop = purpleOcean()
  const loopWav = path.join(scratch, 'purple-ocean.wav')
  await fs.writeFile(loopWav, loop.wav())
  await run(ffmpegPath, ['-y', '-loglevel', 'error', '-i', loopWav, '-codec:a', 'libmp3lame', '-b:a', '128k', path.join(audioOut, 'purple-ocean.mp3')])

  console.log('Rendering film cue…')
  const filmDuration = Number(process.env.FILM_SECONDS ?? 12)
  const cue = filmScore(filmDuration)
  await fs.writeFile(path.join(scratch, 'film-score.wav'), cue.wav())
  console.log('Done: public/media/audio/purple-ocean.mp3, media-src/audio/film-score.wav')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

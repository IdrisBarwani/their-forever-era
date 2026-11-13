import data from '../config/constellation.json'

/**
 * Geometry for "Written in the Stars". The seven stars sit exactly where they do in the
 * shared constellation (film, finale, keepsake), so the story ends in the same constellation
 * the rest of the page celebrates. The sky is taller than the shared 1000 × 520 box so the
 * two first lights can rise in from below, as they do in the film.
 */
export const SKY_W = 1000
export const SKY_H = 600

export type Point = { x: number; y: number }

const pick = (id: string): Point => {
  const s = data.stars.find((star) => star.id === id)
  if (!s) throw new Error(`Unknown star ${id}`)
  return { x: s.x, y: s.y }
}

export const STAR = {
  j1: pick('j1'),
  j2: pick('j2'),
  j3: pick('j3'),
  m1: pick('m1'),
  m2: pick('m2'),
  m3: pick('m3'),
  forever: pick('forever'),
}

export const BEYOND: Point = { x: data.beyond.x, y: data.beyond.y }

type Segment = [Point, Point, Point, Point]

/** Uniform Catmull–Rom spline through the points, as cubic Bézier segments. */
function catmullRom(points: Point[]): Segment[] {
  const segments: Segment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    segments.push([
      p1,
      { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      p2,
    ])
  }
  return segments
}

function bezier([a, b, c, d]: Segment, t: number): Point {
  const u = 1 - t
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  }
}

const f1 = (n: number) => Math.round(n * 10) / 10

export type Journey = {
  /** SVG path data. */
  d: string
  length: number
  /** Fraction of the total length at which each input point is reached. */
  knots: number[]
  /** Point at a fraction of the total length. */
  at: (fraction: number) => Point
}

/** A smooth path through the points, with arc-length lookups for timing and placement. */
function journey(points: Point[]): Journey {
  const segments = catmullRom(points)
  const samples: { s: number; p: Point }[] = [{ s: 0, p: points[0] }]
  const knotLengths = [0]
  let total = 0
  for (const seg of segments) {
    let prev = seg[0]
    for (let i = 1; i <= 120; i++) {
      const p = bezier(seg, i / 120)
      total += Math.hypot(p.x - prev.x, p.y - prev.y)
      samples.push({ s: total, p })
      prev = p
    }
    knotLengths.push(total)
  }
  const at = (fraction: number): Point => {
    const target = Math.min(1, Math.max(0, fraction)) * total
    let lo = 0
    let hi = samples.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (samples[mid].s < target) lo = mid
      else hi = mid
    }
    const a = samples[lo]
    const b = samples[hi]
    const k = b.s === a.s ? 0 : (target - a.s) / (b.s - a.s)
    return { x: a.p.x + (b.p.x - a.p.x) * k, y: a.p.y + (b.p.y - a.p.y) * k }
  }
  const d = segments
    .map(([a, b, c, e], i) => `${i === 0 ? `M${f1(a.x)} ${f1(a.y)}` : ''}C${f1(b.x)} ${f1(b.y)} ${f1(c.x)} ${f1(c.y)} ${f1(e.x)} ${f1(e.y)}`)
    .join('')
  return { d, length: total, knots: knotLengths.map((l) => l / total), at }
}

/** Each light's journey toward the shared star. */
export const JOURNEY = {
  jamila: journey([STAR.j1, STAR.j2, STAR.j3, STAR.forever]),
  mustafa: journey([STAR.m1, STAR.m2, STAR.m3, STAR.forever]),
}

/** The first lights rise in from below the sky, like the two paths in the film. */
export const ORIGIN = {
  jamila: `M26 600C30 548 46 486 ${STAR.j1.x} ${STAR.j1.y}`,
  mustafa: `M974 600C970 546 952 472 ${STAR.m1.x} ${STAR.m1.y}`,
}

/** The delicate line of light that leads the eye to where the first star will appear. */
export const GUIDE = `M520 -8C600 120 860 250 ${STAR.m1.x} ${STAR.m1.y}`

/** Straight constellation lines, matching the shared constellation. */
const seg = (a: Point, b: Point) => `M${a.x} ${a.y}L${b.x} ${b.y}`
export const LINES = {
  jamila: [seg(STAR.j1, STAR.j2), seg(STAR.j2, STAR.j3), seg(STAR.j3, STAR.forever)],
  mustafa: [seg(STAR.m1, STAR.m2), seg(STAR.m2, STAR.m3), seg(STAR.m3, STAR.forever)],
}

/** The final connecting line: it closes the shape beneath the initials. */
export const FINAL_ARC = `M${STAR.j3.x} ${STAR.j3.y}C404 446 596 444 ${STAR.m3.x} ${STAR.m3.y}`

/** Where the initials sit, inside the shape formed by the meeting paths and the final arc. */
export const INITIALS_AT: Point = { x: 500, y: 338 }

/** Seven small stars scattered around the finished constellation. */
export const SEVEN: (Point & { r: number })[] = [
  { x: 214, y: 176, r: 3.2 },
  { x: 318, y: 102, r: 2.6 },
  { x: 420, y: 56, r: 3 },
  { x: 584, y: 60, r: 2.6 },
  { x: 684, y: 108, r: 3.2 },
  { x: 786, y: 182, r: 2.8 },
  { x: 500, y: 504, r: 3 },
]

/** Small stars along each path that light up as the travelling light passes them. */
function pathDust(j: Journey): (Point & { f: number })[] {
  const out: (Point & { f: number })[] = []
  for (let i = 0; i < j.knots.length - 1; i++) {
    const a = j.knots[i]
    const b = j.knots[i + 1]
    ;[0.34, 0.68].forEach((k, n) => {
      const f = a + (b - a) * k
      const p = j.at(f)
      const q = j.at(f + 0.004)
      const len = Math.hypot(q.x - p.x, q.y - p.y) || 1
      // Nudge off the path, alternating sides, so the dust looks scattered rather than beaded.
      const side = (i + n) % 2 === 0 ? 1 : -1
      out.push({ x: f1(p.x - ((q.y - p.y) / len) * 9 * side), y: f1(p.y + ((q.x - p.x) / len) * 9 * side), f })
    })
  }
  return out
}

export const DUST = {
  jamila: pathDust(JOURNEY.jamila),
  mustafa: pathDust(JOURNEY.mustafa),
}

/** A deterministic, sparse field of background stars. */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const FIELD: (Point & { r: number; o: number; d: number })[] = (() => {
  const rand = seeded(1128)
  const out: (Point & { r: number; o: number; d: number })[] = []
  while (out.length < 34) {
    const p = { x: f1(rand() * SKY_W), y: f1(rand() * (SKY_H - 40)) }
    // Keep clear of the seven stars and the initials so nothing competes with them.
    const near = Object.values(STAR).some((s) => Math.hypot(s.x - p.x, s.y - p.y) < 46) || Math.hypot(p.x - INITIALS_AT.x, p.y - INITIALS_AT.y + 20) < 90
    if (near) continue
    out.push({ ...p, r: f1(0.7 + rand() * 1.3), o: f1(0.25 + rand() * 0.5), d: f1(rand() * 6) })
  }
  return out
})()

/** Four-point star outline, matching the shared constellation's star marks. */
export function sparkPath(x: number, y: number, r: number): string {
  const a = r * 3.2
  const b = r * 0.4
  return `M${x} ${y - a}C${x + b} ${y - b} ${x + b} ${y - b} ${x + a} ${y}C${x + b} ${y + b} ${x + b} ${y + b} ${x} ${y + a}C${x - b} ${y + b} ${x - b} ${y + b} ${x - a} ${y}C${x - b} ${y - b} ${x - b} ${y - b} ${x} ${y - a}Z`
}

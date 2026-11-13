import data from '../config/constellation.json'
import { KEEPSAKE } from '../config/site'

/**
 * Draws the downloadable keepsake entirely from local artwork (no photos, no cross-origin
 * images), so export can never be blocked by a tainted canvas.
 * 1600 × 2000 px portrait PNG.
 */
const W = 1600
const H = 2000

function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DISPLAY = '"Cormorant Garamond Variable", "Cormorant Garamond", Georgia, serif'
const UI = '"Manrope Variable", Manrope, system-ui, sans-serif'

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, `rgba(255,248,240,${alpha})`)
  g.addColorStop(0.22, color.replace('ALPHA', String(0.8 * alpha)))
  g.addColorStop(1, color.replace('ALPHA', '0'))
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  const chars = [...text]
  const widths = chars.map((c) => ctx.measureText(c).width)
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1)
  let cx = x - total / 2
  const align = ctx.textAlign
  ctx.textAlign = 'left'
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y)
    cx += widths[i] + spacing
  })
  ctx.textAlign = align
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

export async function createKeepsake(): Promise<Blob> {
  await Promise.all([
    document.fonts.load(`italic 400 120px ${DISPLAY}`),
    document.fonts.load(`500 100px ${DISPLAY}`),
    document.fonts.load(`600 40px ${UI}`),
  ]).catch(() => undefined)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  const rand = seeded(1313)

  // Night sky to horizon
  const sky = ctx.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#0b0612')
  sky.addColorStop(0.45, '#1d0f30')
  sky.addColorStop(0.8, '#44206b')
  sky.addColorStop(0.84, '#2a1440')
  sky.addColorStop(1, '#100918')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)

  // Stars
  for (let i = 0; i < 420; i++) {
    const x = rand() * W
    const y = rand() * H * 0.78
    const r = 0.6 + rand() * 1.8
    ctx.fillStyle = `rgba(232,222,255,${0.25 + rand() * 0.6})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Horizon bloom
  ctx.globalCompositeOperation = 'lighter'
  const hz = 1610
  const bloom = ctx.createRadialGradient(W / 2, hz, 0, W / 2, hz, 900)
  bloom.addColorStop(0, 'rgba(220,200,255,0.55)')
  bloom.addColorStop(0.35, 'rgba(169,112,255,0.25)')
  bloom.addColorStop(1, 'rgba(68,32,107,0)')
  ctx.fillStyle = bloom
  ctx.fillRect(0, 0, W, H)

  // The purple ocean of lights
  for (let i = 0; i < 2600; i++) {
    const z = 2.4 + Math.pow(rand(), 0.7) * 90
    const x = (rand() * 2 - 1) * (z * 1.2 + 5)
    const sx = W / 2 + (x / z) * 900
    const sy = hz + (3.1 / z) * 900 * 0.62
    if (sx < -20 || sx > W + 20 || sy > H + 20) continue
    const size = Math.max(2.4, Math.min(34, (1 / z) * 900 * 0.2))
    const fog = Math.max(0, 1.1 - z / 96)
    const tone = rand()
    const color = tone < 0.65 ? '169,112,255' : tone < 0.9 ? '122,72,196' : '220,200,255'
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, size)
    g.addColorStop(0, `rgba(255,248,240,${0.9 * fog})`)
    g.addColorStop(0.25, `rgba(${color},${0.75 * fog})`)
    g.addColorStop(1, `rgba(${color},0)`)
    ctx.fillStyle = g
    ctx.fillRect(sx - size, sy - size, size * 2, size * 2)
  }
  ctx.globalCompositeOperation = 'source-over'
  const floor = ctx.createLinearGradient(0, H - 280, 0, H)
  floor.addColorStop(0, 'rgba(16,9,24,0)')
  floor.addColorStop(1, 'rgba(16,9,24,0.88)')
  ctx.fillStyle = floor
  ctx.fillRect(0, H - 280, W, 280)

  // Constellation
  const scale = 1.25
  const ox = W / 2 - 500 * scale
  const oy = 188
  const pt = (id: string) => {
    const s = data.stars.find((st) => st.id === id)!
    return { x: ox + s.x * scale, y: oy + s.y * scale, r: s.r }
  }
  const lines = [
    ['j1', 'j2'],
    ['j2', 'j3'],
    ['j3', 'forever'],
    ['m1', 'm2'],
    ['m2', 'm3'],
    ['m3', 'forever'],
  ]
  ctx.lineCap = 'round'
  for (const [width, alpha] of [
    [10, 0.08],
    [4, 0.25],
    [2, 0.9],
  ]) {
    ctx.strokeStyle = `rgba(220,200,255,${alpha})`
    ctx.lineWidth = width
    ctx.beginPath()
    lines.forEach(([a, b]) => {
      const A = pt(a)
      const B = pt(b)
      ctx.moveTo(A.x, A.y)
      ctx.lineTo(B.x, B.y)
    })
    ctx.stroke()
  }
  const F = pt('forever')
  ctx.setLineDash([3, 14])
  ctx.strokeStyle = 'rgba(216,190,145,0.7)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(F.x, F.y - 22)
  ctx.lineTo(F.x, oy + data.beyond.y * scale)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.globalCompositeOperation = 'lighter'
  data.stars.forEach((s) => {
    const p = pt(s.id)
    glow(ctx, p.x, p.y, s.id === 'forever' ? 150 : 60, 'rgba(169,112,255,ALPHA)', s.id === 'forever' ? 1 : 0.85)
  })
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#fff8f0'
  data.stars.forEach((s) => {
    const p = pt(s.id)
    ctx.beginPath()
    ctx.arc(p.x, p.y, s.r * 1.3, 0, Math.PI * 2)
    ctx.fill()
  })

  // Names under the constellation
  ctx.fillStyle = 'rgba(220,200,255,0.75)'
  ctx.font = `italic 400 40px ${DISPLAY}`
  ctx.textAlign = 'left'
  ctx.fillText('Jamila', pt('j1').x - 30, pt('j1').y + 70)
  ctx.textAlign = 'right'
  ctx.fillText('Mustafa', pt('m1').x + 30, pt('m1').y + 70)

  // Doorway frame
  ctx.strokeStyle = 'rgba(216,190,145,0.55)'
  ctx.lineWidth = 2
  const fx = 70
  const top = 90 + (W / 2 - fx) // arch apex sits 90px from the top
  ctx.beginPath()
  ctx.moveTo(fx, H - 70)
  ctx.lineTo(fx, top + 0)
  ctx.arc(W / 2, top, W / 2 - fx, Math.PI, 0)
  ctx.lineTo(W - fx, H - 70)
  ctx.closePath()
  ctx.stroke()
  ctx.strokeStyle = 'rgba(216,190,145,0.22)'
  ctx.beginPath()
  ctx.moveTo(fx + 18, H - 88)
  ctx.lineTo(fx + 18, top)
  ctx.arc(W / 2, top, W / 2 - fx - 18, Math.PI, 0)
  ctx.lineTo(W - fx - 18, H - 88)
  ctx.closePath()
  ctx.stroke()

  // Typography
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#d8be91'
  ctx.font = `600 28px ${UI}`
  spaced(ctx, 'A BTS-INSPIRED WEDDING WISH', W / 2, 920, 9)

  ctx.fillStyle = '#fff8f0'
  ctx.shadowColor = 'rgba(169,112,255,0.6)'
  ctx.shadowBlur = 40
  ctx.font = `italic 400 168px ${DISPLAY}`
  ctx.fillText(KEEPSAKE.heading, W / 2, 1080)
  ctx.shadowBlur = 24
  ctx.font = `500 112px ${DISPLAY}`
  ctx.fillText(KEEPSAKE.names, W / 2, 1210)
  ctx.shadowBlur = 0
  ctx.fillStyle = '#d8be91'
  ctx.font = `600 46px ${UI}`
  spaced(ctx, KEEPSAKE.surname.toUpperCase(), W / 2, 1292, 22)

  ctx.fillStyle = '#efe5ff'
  ctx.font = `italic 400 58px ${DISPLAY}`
  wrap(ctx, KEEPSAKE.wish, 1100).forEach((l, i) => ctx.fillText(l, W / 2, 1410 + i * 68))
  ctx.fillStyle = 'rgba(239,229,255,0.85)'
  ctx.font = `500 32px ${UI}`
  ctx.fillText(KEEPSAKE.secondary, W / 2, 1565)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), 'image/png'))
}

export function downloadBlob(blob: Blob, filename: string): string {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  return url
}

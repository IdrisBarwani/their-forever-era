/**
 * One short burst of purple stars and petals on a 2D canvas.
 * Each fire() replaces the previous burst, so replays never accumulate particles,
 * and the animation loop stops itself as soon as the last particle fades.
 */
type Kind = 'star' | 'petal'
type Particle = {
  kind: Kind
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  spin: number
  size: number
  life: number
  max: number
  color: string
  wobble: number
}

const COLORS = ['#a970ff', '#dcc8ff', '#fff8f0', '#c39bff', '#d8be91', '#7b48c4']

export class Burst {
  private canvas: HTMLCanvasElement
  private maxDpr: number
  private ctx: CanvasRenderingContext2D
  private particles: Particle[] = []
  private raf = 0
  private last = 0
  private dpr = 1

  constructor(canvas: HTMLCanvasElement, maxDpr = 1.5) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D unavailable')
    this.canvas = canvas
    this.maxDpr = maxDpr
    this.ctx = ctx
  }

  private resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr)
    const w = Math.round(this.canvas.clientWidth * this.dpr)
    const h = Math.round(this.canvas.clientHeight * this.dpr)
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
  }

  /** Origin in CSS pixels relative to the canvas. */
  fire(x: number, y: number, count: number) {
    this.resize()
    this.particles = []
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.7
      const speed = 0.25 + Math.random() * 0.55
      const kind: Kind = Math.random() < 0.6 ? 'star' : 'petal'
      this.particles.push({
        kind,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.08,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.008,
        size: kind === 'star' ? 4 + Math.random() * 7 : 6 + Math.random() * 7,
        life: 0,
        max: 1700 + Math.random() * 900,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        wobble: Math.random() * Math.PI * 2,
      })
    }
    cancelAnimationFrame(this.raf)
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.loop)
  }

  clear() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.particles = []
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  get active() {
    return this.particles.length > 0
  }

  private loop = (now: number) => {
    const dt = Math.min(40, now - this.last)
    this.last = now
    const { ctx, dpr } = this
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life += dt
      if (p.life >= p.max) {
        this.particles.splice(i, 1)
        continue
      }
      p.vy += 0.00042 * dt
      p.vx *= 0.995
      p.vy *= 0.995
      if (p.kind === 'petal') p.vx += Math.sin(p.life * 0.004 + p.wobble) * 0.0008 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.spin * dt
      const k = p.life / p.max
      const alpha = k < 0.08 ? k / 0.08 : k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1
      ctx.save()
      ctx.globalAlpha = Math.max(0, alpha)
      ctx.translate(p.x * dpr, p.y * dpr)
      ctx.rotate(p.rot)
      const s = p.size * dpr
      if (p.kind === 'star') {
        ctx.fillStyle = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur = 10 * dpr
        ctx.beginPath()
        ctx.moveTo(0, -s)
        ctx.quadraticCurveTo(s * 0.14, -s * 0.14, s, 0)
        ctx.quadraticCurveTo(s * 0.14, s * 0.14, 0, s)
        ctx.quadraticCurveTo(-s * 0.14, s * 0.14, -s, 0)
        ctx.quadraticCurveTo(-s * 0.14, -s * 0.14, 0, -s)
        ctx.fill()
      } else {
        const g = ctx.createLinearGradient(0, -s, 0, s)
        g.addColorStop(0, '#f3e9ff')
        g.addColorStop(1, p.color)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.ellipse(0, 0, s * 0.45, s, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
    this.raf = this.particles.length ? requestAnimationFrame(this.loop) : 0
    if (!this.particles.length) ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }
}

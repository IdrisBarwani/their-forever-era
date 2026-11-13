import { useEffect, useRef } from 'react'
import { gsap } from '../lib/gsap'
import { useMotion } from '../lib/motion'

const INTERACTIVE = 'a, button, [role="tab"], input, label, summary, [data-cursor]'
const MAX_PARTICLES = 26

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; rot: number; hue: number }

/**
 * Lightstick glow that follows a fine pointer, plus a short-lived, capped star trail.
 * The native cursor stays visible so targeting remains precise.
 * Nothing renders on touch devices or in calm mode.
 */
export function Cursor() {
  const { finePointer, motion, trail, lowPower } = useMotion()
  const enabled = finePointer && motion
  const haloRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const halo = haloRef.current
    if (!enabled || !halo) return
    const xTo = gsap.quickTo(halo, 'x', { duration: 0.42, ease: 'power3.out' })
    const yTo = gsap.quickTo(halo, 'y', { duration: 0.42, ease: 'power3.out' })
    let visible = false
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
      xTo(e.clientX)
      yTo(e.clientY)
      if (!visible) {
        visible = true
        gsap.set(halo, { x: e.clientX, y: e.clientY })
        halo.dataset.visible = 'true'
      }
    }
    const over = (e: PointerEvent) => {
      const target = (e.target as Element | null)?.closest?.(INTERACTIVE)
      halo.dataset.hover = target ? 'true' : 'false'
    }
    const leave = (e: PointerEvent) => {
      if (!e.relatedTarget) {
        visible = false
        halo.dataset.visible = 'false'
      }
    }
    const down = () => (halo.dataset.down = 'true')
    const up = () => (halo.dataset.down = 'false')
    window.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerover', over, { passive: true })
    document.addEventListener('pointerout', leave, { passive: true })
    window.addEventListener('pointerdown', down, { passive: true })
    window.addEventListener('pointerup', up, { passive: true })
    return () => {
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerout', leave)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
    }
  }, [enabled])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!enabled || !trail || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.5)
    const resize = () => {
      canvas.width = Math.round(window.innerWidth * dpr)
      canvas.height = Math.round(window.innerHeight * dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    const particles: Particle[] = []
    let raf = 0
    let lastX = -999
    let lastY = -999
    let last = performance.now()

    const drawStar = (p: Particle, alpha: number) => {
      const s = p.size * dpr
      ctx.save()
      ctx.translate(p.x * dpr, p.y * dpr)
      ctx.rotate(p.rot)
      ctx.globalAlpha = alpha
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 2.4)
      g.addColorStop(0, `hsla(${p.hue}, 100%, 92%, 0.9)`)
      g.addColorStop(1, `hsla(${p.hue}, 100%, 70%, 0)`)
      ctx.fillStyle = g
      ctx.fillRect(-s * 2.4, -s * 2.4, s * 4.8, s * 4.8)
      ctx.fillStyle = `hsla(${p.hue}, 100%, 96%, 1)`
      ctx.beginPath()
      ctx.moveTo(0, -s)
      ctx.quadraticCurveTo(s * 0.12, -s * 0.12, s, 0)
      ctx.quadraticCurveTo(s * 0.12, s * 0.12, 0, s)
      ctx.quadraticCurveTo(-s * 0.12, s * 0.12, -s, 0)
      ctx.quadraticCurveTo(-s * 0.12, -s * 0.12, 0, -s)
      ctx.fill()
      ctx.restore()
    }

    const loop = (now: number) => {
      const dt = Math.min(48, now - last)
      last = now
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life += dt
        if (p.life >= p.max) {
          particles.splice(i, 1)
          continue
        }
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 0.00002 * dt
        p.rot += 0.002 * dt
        const k = 1 - p.life / p.max
        drawStar(p, k * k)
      }
      raf = particles.length ? requestAnimationFrame(loop) : 0
    }

    const spawn = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      if (dx * dx + dy * dy < 18 * 18) return
      lastX = e.clientX
      lastY = e.clientY
      if (document.hidden) return
      particles.push({
        x: e.clientX,
        y: e.clientY,
        vx: (Math.random() - 0.5) * 0.02,
        vy: 0.01 + Math.random() * 0.02,
        life: 0,
        max: 520 + Math.random() * 240,
        size: 2 + Math.random() * 2.6,
        rot: Math.random() * Math.PI,
        hue: 262 + Math.random() * 30,
      })
      if (particles.length > MAX_PARTICLES) particles.shift()
      if (!raf) {
        last = performance.now()
        raf = requestAnimationFrame(loop)
      }
    }
    window.addEventListener('pointermove', spawn, { passive: true })
    return () => {
      window.removeEventListener('pointermove', spawn)
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [enabled, trail, lowPower])

  if (!enabled) return null
  return (
    <>
      {trail && <canvas ref={canvasRef} className="cursor-trail" aria-hidden="true" />}
      <div ref={haloRef} className="cursor-halo" aria-hidden="true" data-visible="false">
        <span className="cursor-halo__glow" />
        <span className="cursor-halo__ring" />
      </div>
    </>
  )
}

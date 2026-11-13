import { forwardRef, useEffect, useImperativeHandle, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { gsap } from '../lib/gsap'
import { useMotion } from '../lib/motion'

type DoorButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'light'
  size?: 'md' | 'sm'
  icon?: ReactNode
  /** Soft magnetic pull toward the pointer (fine pointers, full effects only). */
  magnetic?: boolean
  loading?: boolean
}

/**
 * Doorway-shaped button: a trapezoid outline (narrower at the top, like a door seen in
 * perspective), an illuminated border on hover, a pointer-following glow and a tactile press.
 * The magnetic offset is the only transform GSAP writes to this element.
 */
export const DoorButton = forwardRef<HTMLButtonElement, DoorButtonProps>(function DoorButton(
  { variant = 'primary', size = 'md', icon, magnetic = false, loading = false, className = '', children, onPointerMove, onPointerLeave, ...rest },
  forwarded,
) {
  const ref = useRef<HTMLButtonElement>(null)
  useImperativeHandle(forwarded, () => ref.current as HTMLButtonElement)
  const { finePointer, motion } = useMotion()
  const active = magnetic && finePointer && motion

  useEffect(() => {
    const el = ref.current
    if (!el || !active) return
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' })
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      xTo(((e.clientX - (r.left + r.width / 2)) / r.width) * 14)
      yTo(((e.clientY - (r.top + r.height / 2)) / r.height) * 10)
    }
    const leave = () => {
      xTo(0)
      yTo(0)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
      gsap.set(el, { x: 0, y: 0 })
    }
  }, [active])

  return (
    <button
      ref={ref}
      type="button"
      className={`door-btn door-btn--${variant} door-btn--${size} ${className}`}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        e.currentTarget.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
        e.currentTarget.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
        onPointerMove?.(e)
      }}
      onPointerLeave={onPointerLeave}
      {...rest}
    >
      <span className="door-btn__glow" aria-hidden="true" />
      <span className="door-btn__inner">
        {loading ? <span className="lightstick-spinner" aria-hidden="true" /> : icon}
        <span className="door-btn__label">{children}</span>
      </span>
    </button>
  )
})

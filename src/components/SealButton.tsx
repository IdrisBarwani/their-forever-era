import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Monogram } from './Monogram'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** Accessible name: the seal shows only the J&M monogram. */
  label: string
  /** Diameter in CSS px. */
  size?: number
}

/**
 * The J&M wax seal as a button, with a soft pulsing ring of light that invites the press.
 * Used to open the door at the start and the wedding letter.
 */
export const SealButton = forwardRef<HTMLButtonElement, Props>(function SealButton({ label, size = 92, className = '', style, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={`seal-btn ${className}`}
      aria-label={label}
      style={{ ['--seal-size' as string]: `${size}px`, ...style }}
      {...rest}
    >
      <span className="seal-btn__ring" aria-hidden="true" />
      <Monogram variant="seal" size={size} />
    </button>
  )
})

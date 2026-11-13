import { forwardRef, useState, type CSSProperties, type ImgHTMLAttributes } from 'react'
import { image, type ImageId } from '../config/media'
import { asset } from '../lib/asset'

type PhotoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'alt' | 'width' | 'height'> & {
  id: ImageId
  sizes: string
  /** Opening-scene images load eagerly with high priority; everything else is lazy. */
  priority?: boolean
  /** Override the alt text (pass "" for decorative use). */
  alt?: string
  focus?: string
}

/**
 * Responsive WebP photo with explicit dimensions, a blurred placeholder and lazy loading.
 * If a file fails to load, the placeholder colours stay and the image fades out gracefully.
 */
export const Photo = forwardRef<HTMLImageElement, PhotoProps>(function Photo(
  { id, sizes, priority = false, alt, focus, className = '', style, onLoad, onError, ...rest },
  ref,
) {
  const meta = image(id)
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const srcSet = meta.srcSet
    .split(', ')
    .map((part) => {
      const [path, w] = part.split(' ')
      return `${asset(path)} ${w}`
    })
    .join(', ')
  const css: CSSProperties = {
    objectPosition: focus ?? meta.focus,
    backgroundImage: state === 'loaded' ? undefined : `url("${meta.placeholder}")`,
    ...style,
  }
  return (
    <img
      ref={ref}
      className={`photo ${className}`}
      data-state={state}
      src={asset(meta.src)}
      srcSet={srcSet}
      sizes={sizes}
      width={meta.width}
      height={meta.height}
      alt={alt ?? meta.alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : 'auto'}
      style={css}
      onLoad={(e) => {
        setState('loaded')
        onLoad?.(e)
      }}
      onError={(e) => {
        setState('error')
        onError?.(e)
      }}
      {...rest}
    />
  )
})

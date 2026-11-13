import { ambientSound, useSoundState } from '../lib/sound'
import { SoundOffIcon, SoundOnIcon } from './icons'

type Props = { compact?: boolean; withLabel?: boolean; className?: string }

/** Opt-in soundtrack control. The state is shared by every instance on the page. */
export function SoundToggle({ compact = false, withLabel = false, className = '' }: Props) {
  const state = useSoundState()
  const on = state === 'on'
  const label =
    state === 'loading' ? 'Loading the soundtrack…' : state === 'error' ? 'Soundtrack unavailable, try again' : on ? 'Pause the soundtrack' : 'Play the soundtrack'
  return (
    <button
      type="button"
      className={`icon-btn sound-toggle ${withLabel || !compact ? 'icon-btn--labelled' : ''} ${className}`}
      aria-pressed={on}
      aria-busy={state === 'loading' || undefined}
      data-state={state}
      data-tour-keep
      onClick={() => void ambientSound.toggle()}
      title={label}
    >
      {on ? <SoundOnIcon /> : <SoundOffIcon />}
      <span className="sound-bars" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className={withLabel || !compact ? 'sound-toggle__text' : 'visually-hidden'}>
        {withLabel || !compact ? (state === 'loading' ? 'Loading…' : on ? 'Sound on' : state === 'error' ? 'Sound unavailable' : 'Sound off') : label}
      </span>
      {(withLabel || !compact) && <span className="visually-hidden">{label}</span>}
    </button>
  )
}

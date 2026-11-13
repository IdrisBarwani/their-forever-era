/**
 * Pinned scenes publish where their resting points are, so the play-through can glide to the
 * exact same places the visitor's own scrolling settles on. Each value is a document scroll
 * position in CSS px, or null when unknown. Scenes clear their entry when they unmount.
 */
export const tourHooks: {
  /** "Written in the Stars", pinned: chapter i (0–4). */
  storyChapterY?: (i: number) => number | null
  /** Seven wishes, pinned: photocard i (0–6) centred. */
  wishY?: (i: number) => number | null
  /** The film, pinned: where scrubbing starts and ends. */
  filmRange?: () => [number, number] | null
} = {}

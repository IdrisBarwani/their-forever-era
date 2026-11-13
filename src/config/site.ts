/**
 * Every name, line of copy and chapter lives here so the whole tribute can be
 * edited in one place. Media (photos, film, sound, credits) lives in ./media.ts.
 */

export const COUPLE = {
  first: 'Jamila',
  second: 'Mustafa',
  surname: 'Lokhandwala',
  pair: 'Jamila & Mustafa',
  full: 'Jamila & Mustafa Lokhandwala',
  initials: ['J', 'M'] as const,
}

export const SITE = {
  title: 'Jamila & Mustafa — Their Forever Era',
  tagline: 'A BTS-inspired wedding congratulations fan tribute',
}

export type ChapterId = 'invitation' | 'stars' | 'wishes' | 'archive' | 'film' | 'letter' | 'finale'

export type Chapter = {
  id: ChapterId
  track: string
  title: string
  short: string
  theme: 'dark' | 'light'
}

/** Seven chapters, like a seven-track setlist. */
export const CHAPTERS: Chapter[] = [
  { id: 'invitation', track: '01', title: 'The Invitation', short: 'Invitation', theme: 'dark' },
  { id: 'stars', track: '02', title: 'Written in the Stars', short: 'Stars', theme: 'dark' },
  { id: 'wishes', track: '03', title: 'Seven Wishes for Forever', short: 'Wishes', theme: 'dark' },
  { id: 'archive', track: '04', title: 'The Purple Archive', short: 'Archive', theme: 'dark' },
  { id: 'film', track: '05', title: 'Your Forever Era: The Film', short: 'Film', theme: 'dark' },
  { id: 'letter', track: '06', title: 'A Letter for the Lokhandwalas', short: 'Letter', theme: 'light' },
  { id: 'finale', track: '07', title: 'The Purple-Ocean Finale', short: 'Finale', theme: 'dark' },
]

/** The closed door at the very start. Its wax seal is the way in. */
export const GATE = {
  /** Accessible name of the seal button. */
  button: 'Go into the purple universe',
  hint: {
    pointer: 'Click the button to go into the purple universe',
    touch: 'Tap the button to go into the purple universe',
  },
}

/** The play button in the header: the whole page, slowly, with music, with no scrolling or clicking. */
export const TOUR = {
  play: 'Play the whole celebration with music',
  pause: 'Pause the celebration',
  resume: 'Resume the celebration',
  again: 'Play the celebration again from the start',
  started: 'Playing the whole celebration with music. Press this button again, scroll, tap or press a key to pause.',
  paused: 'Paused. Press play to carry on from here.',
  finished: 'The celebration has finished.',
}

export const INVITATION = {
  eyebrow: 'A BTS-inspired wedding celebration',
  title: 'Jamila & Mustafa',
  era: 'Their Forever Era',
  lede: 'A little purple universe, made for your beautiful beginning.',
  cta: 'Begin the celebration',
  skip: 'Skip intro',
  scrollCue: 'Scroll gently',
  soundHint: 'Sound is optional',
}

/** Dates as given by the family. `iso` feeds <time dateTime>; `label` is what visitors read. */
export const DATES = {
  mustafaBorn: { iso: '1997-11-28', label: '28 November 1997' },
  jamilaBorn: { iso: '2002-05-27', label: '27 May 2002' },
  wedding: { iso: '2026-11-15', label: '15 November 2026' },
} as const

export type StoryBeatId = 'before' | 'his' | 'hers' | 'paths' | 'forever'

export type StoryBeat = {
  id: StoryBeatId
  /** "Chapter One" and so on; the opening has none. */
  kicker?: string
  title: string
  /** Compact label for the chapter progress indicator. */
  short: string
  date?: { iso: string; label: string }
  lines: string[]
}

/** Scene B — "Written in the Stars". Only the dates and names the family provided; nothing invented. */
const STORY_BEATS: StoryBeat[] = [
  {
    id: 'before',
    title: 'Before there was an ‘us’…',
    short: 'Before',
    lines: ['Before there was an ‘us’, there were two beginnings.'],
  },
  {
    id: 'his',
    kicker: 'Chapter One',
    title: 'His first light',
    short: 'His first light',
    date: DATES.mustafaBorn,
    lines: ['A new light entered the world.', 'Mustafa’s story had begun.'],
  },
  {
    id: 'hers',
    kicker: 'Chapter Two',
    title: 'Her first light',
    short: 'Her first light',
    date: DATES.jamilaBorn,
    lines: ['A little later, another light began to shine.', 'Jamila’s story had begun.'],
  },
  {
    id: 'paths',
    kicker: 'Chapter Three',
    title: 'Two beginnings. One shared sky.',
    short: 'One shared sky',
    lines: ['Two lives. Two beginnings.', 'And a beautiful chapter they would one day write together.'],
  },
  {
    id: 'forever',
    kicker: 'Chapter Four',
    title: 'Their forever era',
    short: 'Their forever era',
    date: DATES.wedding,
    lines: ['On this day, two stories become a shared forever.'],
  },
]

export const STORY = {
  eyebrow: 'Chapter 02',
  title: 'Written in the Stars',
  beats: STORY_BEATS,
  reveal: 'Jamila & Mustafa Lokhandwala',
  finish: 'May you always find your way to each other.',
  replay: 'Replay our constellation',
  stars: {
    mustafa: { name: 'Mustafa', born: DATES.mustafaBorn },
    jamila: { name: 'Jamila', born: DATES.jamilaBorn },
  },
  initials: 'J & M',
  skyLabel:
    'Two stars in a purple night sky: Mustafa’s, first lit on 28 November 1997, and Jamila’s, first lit on 27 May 2002. Their paths curve toward each other and meet on 15 November 2026, forming a constellation around the initials J and M.',
}

export type MemberId = 'rm' | 'jin' | 'suga' | 'jhope' | 'jimin' | 'v' | 'jungkook'

export type Wish = {
  id: MemberId
  /** Official stage-name styling. */
  member: string
  theme: string
  text: string
  /** Visual treatment for the individually designed photocard. */
  design: 'ticket' | 'polaroid' | 'mono' | 'sunburst' | 'orbit' | 'arch' | 'constellation'
  accent: string
  accentSoft: string
}

/** Original wishes written for this tribute. They are not quotes or statements by BTS. */
export const WISHES: Wish[] = [
  {
    id: 'rm',
    member: 'RM',
    theme: 'Joy',
    text: 'May your ordinary days keep finding extraordinary reasons to smile.',
    design: 'ticket',
    accent: '#a970ff',
    accentSoft: '#dcc8ff',
  },
  {
    id: 'jin',
    member: 'Jin',
    theme: 'Friendship',
    text: 'May you always find your favourite person in each other.',
    design: 'polaroid',
    accent: '#f0b8dc',
    accentSoft: '#fbe3f1',
  },
  {
    id: 'suga',
    member: 'SUGA',
    theme: 'Courage',
    text: 'May every new beginning feel braver with your hands held together.',
    design: 'mono',
    accent: '#c9d2ec',
    accentSoft: '#eef1fa',
  },
  {
    id: 'jhope',
    member: 'j-hope',
    theme: 'Kindness',
    text: 'May gentleness be the language your home speaks.',
    design: 'sunburst',
    accent: '#e8c98f',
    accentSoft: '#fbefd6',
  },
  {
    id: 'jimin',
    member: 'Jimin',
    theme: 'Wonder',
    text: 'May you never stop discovering little things to love about each other.',
    design: 'orbit',
    accent: '#b8a4ff',
    accentSoft: '#e7defe',
  },
  {
    id: 'v',
    member: 'V',
    theme: 'Home',
    text: 'May home always be the place you create together.',
    design: 'arch',
    accent: '#d8be91',
    accentSoft: '#f4e8d2',
  },
  {
    id: 'jungkook',
    member: 'Jung Kook',
    theme: 'Forever',
    text: 'May you keep choosing each other through every season of life.',
    design: 'constellation',
    accent: '#a970ff',
    accentSoft: '#d8be91',
  },
]

export const WISHES_COPY = {
  eyebrow: 'Chapter 03',
  title: 'Seven wishes for forever',
  intro: 'Seven photocards, one for each member, each carrying a wish for your life together.',
  disclaimer: 'Every wish here was written for this tribute. They are not quotes or statements from BTS.',
  open: 'Open wish',
  close: 'Close wish',
  hint: 'Scroll, swipe or use the stars to move between cards.',
}

export const ARCHIVE_COPY = {
  eyebrow: 'Chapter 04',
  title: 'The purple archive',
  intro: 'A small gallery of seven: standing together, lighting up stages, and the little moments in between.',
  dragHint: 'Drag, swipe or use the arrows',
}

export const FILM_COPY = {
  eyebrow: 'Chapter 05',
  title: 'Your forever era: the film moment',
  lines: ['A thousand lights.', 'One beautiful beginning.', 'Your best chapters are still ahead.'],
  filmCaption:
    'An original concert-light film made for this tribute: a purple ocean, seven stars and two paths becoming one.',
  modeFollow: 'Follow scroll',
  modePlay: 'Play normally',
  loading: 'Warming up the lights…',
  error: 'The film could not load on this connection, so here is a still from the purple ocean instead.',
  officialTitle: 'From the official BTS channel',
}

export const LETTER = {
  eyebrow: 'Chapter 06',
  title: 'A letter for the Lokhandwalas',
  /** Accessible name of the wax seal, which opens the letter. */
  open: 'Open your wedding wish',
  /** Small hint under the envelope, worded for the visitor's device. */
  sealHint: { pointer: 'Click the seal to open your wedding wish', touch: 'Tap the seal to open your wedding wish' },
  close: 'Fold the letter',
  salutation: 'Dear Jamila and Mustafa,',
  paragraphs: [
    'May your marriage be filled with the kind of love that makes ordinary days feel special.',
    'May you laugh often, listen gently, dream boldly, and always find your way back to each other.',
    'Jamila, may this new chapter carry the warmth of your favourite song and the joy of a sky full of purple lights.',
    'Mustafa, may the life you build together be full of friendship, patience, and beautiful surprises.',
    'And to both of you: may your home hold kindness, your adventures hold wonder, and your love keep growing through every season.',
  ],
  closing: 'Here’s to your forever era.',
  signature: 'Happy married life, Jamila & Mustafa Lokhandwala.',
}

export const FINALE = {
  eyebrow: 'Chapter 07',
  title: 'Happy Married Life',
  names: 'Jamila & Mustafa Lokhandwala',
  line: 'May your forever shine brighter than a purple ocean.',
  cta: 'Light up your forever',
  replay: 'Replay the celebration',
  keepsake: 'Save your keepsake',
  keepsakeSaving: 'Making your keepsake…',
  keepsakeSaved: 'Your keepsake has been saved to your downloads.',
  keepsakeError: 'The keepsake could not be created on this device. Please try again.',
  litTitle: 'Your forever is lit.',
  litMessage:
    'Seven lights for seven wishes, and one shared star for the two of you. May every day of your marriage feel this bright.',
  glowLabel: 'Ocean glow',
  borahae: '보라해 · I purple you',
  borahaeNote: 'ARMY’s word for loving someone, and trusting them, for a very long time.',
}

/** A small note from the person who made this, placed after the finale. Wording as given. */
export const DEDICATION = {
  heading: 'A little note from your forever friend',
  salutation: 'Jamila & Mustafa,',
  paragraphs: [
    'This little purple universe is my gift to you both—a wish for a lifetime of laughter, kindness, and always having each other.',
    'As you begin your forever together, know that you’ll always have your best and forever friend cheering you on.',
  ],
  closing: 'With love,',
  signature: 'Idris Barwaniwala',
  supporting: 'Your best and forever friend.',
}

export const FOOTER = {
  line: 'Made for my love, Jamila from his loving husband Mustafa',
}

export const KEEPSAKE = {
  filename: 'Jamila-and-Mustafa-Lokhandwala-Forever-Era.png',
  heading: 'Happy Married Life',
  names: 'Jamila & Mustafa',
  surname: 'Lokhandwala',
  wish: 'May your forever shine brighter than a purple ocean.',
  secondary: 'Here’s to your forever era.',
}

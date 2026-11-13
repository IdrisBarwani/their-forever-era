/**
 * Visual and functional smoke test in the locally installed Google Chrome (via playwright-core).
 *
 *   node scripts/browser-check.mjs [url] [scenario]
 *   scenarios: desktop (default) · mobile · calm · interactions · all
 *
 * Screenshots go to .screenshots/. Console errors, page errors and failed requests are reported,
 * and the script exits non-zero if any are found.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from 'playwright-core'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const url = process.argv[2] ?? 'http://127.0.0.1:5173/'
const scenario = process.argv[3] ?? 'desktop'
const out = path.join(root, '.screenshots')
await fs.mkdir(out, { recursive: true })

const problems = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function watch(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`[${label}] console.${msg.type()}: ${msg.text()}`)
  })
  page.on('pageerror', (err) => problems.push(`[${label}] pageerror: ${err.message}`))
  page.on('requestfailed', (req) => {
    const u = req.url()
    if (u.includes('youtube') || u.includes('ytimg') || u.includes('googlevideo')) return
    // Media elements routinely cancel and re-issue range reads of a blob; that is not a failure.
    if (u.startsWith('blob:') && req.failure()?.errorText === 'net::ERR_ABORTED') return
    problems.push(`[${label}] requestfailed: ${u} ${req.failure()?.errorText}`)
  })
  page.on('response', (res) => {
    if (res.status() >= 400) problems.push(`[${label}] HTTP ${res.status()}: ${res.url()}`)
  })
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(out, `${name}.png`) })
  console.log('  📸', name)
}

/** The page opens on a closed door; check it, photograph it, then press its seal to go in. */
async function enter(page, label, { tap = false, calm = false } = {}) {
  const door = await page.evaluate(() => ({
    state: document.getElementById('invitation')?.dataset.door,
    locked: document.documentElement.classList.contains('is-scroll-locked'),
    hint: document.querySelector('.inv-door__hint')?.textContent?.trim(),
    play: document.querySelector('.site-header .tour-btn')?.getAttribute('aria-label'),
  }))
  if (door.state !== 'closed' || !door.locked) problems.push(`[${label}] the page did not open on the closed door (${JSON.stringify(door)})`)
  if (!/button to go into the purple universe$/.test(door.hint ?? '')) problems.push(`[${label}] door hint is “${door.hint}”`)
  if (door.play !== 'Play the whole celebration with music') problems.push(`[${label}] header play button missing (${door.play})`)
  await shot(page, `${label}-00-door`)
  if (tap) await page.tap('.inv-door__seal')
  else await page.click('.inv-door__seal')
  await sleep(calm ? 900 : 4600)
  const inside = await page.evaluate(() => document.getElementById('invitation')?.dataset.door)
  if (inside !== 'open') problems.push(`[${label}] the door did not open (${inside})`)
}

async function sectionTop(page, id) {
  return page.evaluate((i) => {
    const el = document.getElementById(i)
    return el ? el.getBoundingClientRect().top + window.scrollY : 0
  }, id)
}

/** Scroll in steps so scrubbed timelines and lazy images behave like a real visit. */
async function scrollTo(page, y, steps = 12) {
  const start = await page.evaluate(() => window.scrollY)
  for (let i = 1; i <= steps; i++) {
    await page.mouse.wheel(0, (y - start) / steps)
    await sleep(60)
  }
  await sleep(900)
}

async function desktop(browser, { calm = false, label = calm ? 'calm' : 'desktop' } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: calm ? 'reduce' : 'no-preference',
  })
  const page = await context.newPage()
  watch(page, label)
  await page.goto(url, { waitUntil: 'networkidle' })
  await sleep(1200)
  await enter(page, label, { calm })
  await shot(page, `${label}-01-hero`)

  const ids = ['stars', 'wishes', 'archive', 'film', 'letter', 'finale', 'dedication']
  // Pinned scenes: extra frames through the pin (in viewport heights from the section top).
  // For the story these are its chapter resting points.
  const frames = { stars: [1.1, 2.07, 3.34, 4.75], wishes: [0.6, 1.3, 2.0], film: [0.6, 1.3, 2.0] }
  for (const id of ids) {
    const top = await sectionTop(page, id)
    await scrollTo(page, top + 2)
    await shot(page, `${label}-${id}-start`)
    if (!calm && frames[id]) {
      const h = await page.evaluate(() => window.innerHeight)
      for (const f of frames[id]) {
        await scrollTo(page, top + h * f, 8)
        await shot(page, `${label}-${id}-${String(f).replace('.', '_')}`)
      }
    }
  }
  const total = await page.evaluate(() => document.documentElement.scrollHeight)
  await scrollTo(page, total, 10)
  await shot(page, `${label}-99-footer`)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 1) problems.push(`[${label}] horizontal overflow of ${overflow}px`)
  await context.close()
}

async function mobile(browser) {
  const context = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'no-preference' })
  const page = await context.newPage()
  watch(page, 'mobile')
  await page.goto(url, { waitUntil: 'networkidle' })
  await sleep(1200)
  await enter(page, 'mobile', { tap: true })
  await shot(page, 'mobile-01-hero')
  for (const id of ['stars', 'wishes', 'archive', 'film', 'letter', 'finale', 'dedication']) {
    const top = await sectionTop(page, id)
    await page.evaluate((y) => window.scrollTo(0, y), top)
    await sleep(1200)
    await shot(page, `mobile-${id}`)
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 1) problems.push(`[mobile] horizontal overflow of ${overflow}px`)

  // Mobile menu: open, check focus, close with Escape, scroll restored
  await page.evaluate(() => window.scrollTo(0, 1500))
  await sleep(500)
  const before = await page.evaluate(() => window.scrollY)
  await page.click('.menu-btn')
  await sleep(600)
  await shot(page, 'mobile-menu')
  const focusInMenu = await page.evaluate(() => !!document.activeElement?.closest('.mobile-menu'))
  if (!focusInMenu) problems.push('[mobile] focus did not move into the menu')
  await page.keyboard.press('Escape')
  await sleep(400)
  const after = await page.evaluate(() => window.scrollY)
  if (Math.abs(after - before) > 2) problems.push(`[mobile] scroll not restored after menu (${before} → ${after})`)
  const focusBack = await page.evaluate(() => document.activeElement?.classList.contains('menu-btn'))
  if (!focusBack) problems.push('[mobile] focus not returned to the menu button')
  await context.close()
}

async function interactions(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
  const page = await context.newPage()
  watch(page, 'interact')
  await page.goto(url, { waitUntil: 'networkidle' })
  await sleep(1000)

  // The door opens with Enter on its seal (keyboard), then the intro is skipped and the story begins
  await page.focus('.inv-door__seal')
  await page.keyboard.press('Enter')
  await sleep(1200)
  const skip = await page.$('.skip-intro')
  if (skip) await skip.click()
  await sleep(600)
  if ((await page.evaluate(() => document.getElementById('invitation')?.dataset.door)) !== 'open') problems.push('[interact] Enter on the door seal did not open the door')
  await page.click('.inv-actions .door-btn')
  await sleep(2600)
  const y = await page.evaluate(() => window.scrollY)
  const target = await sectionTop(page, 'stars')
  if (Math.abs(y - target) > 8) problems.push(`[interact] begin button landed at ${y}, expected ${target}`)

  // Written in the Stars: chapter indicator, star labels, replay
  await page.click('.story-progress--rail .story-progress__btn >> nth=2')
  await sleep(2600)
  const chapter = await page.getAttribute('.story-progress__btn[aria-current]', 'aria-label')
  if (!chapter?.startsWith('Chapter Two')) problems.push(`[interact] story indicator did not reach Chapter Two (${chapter})`)
  const hers = await page.evaluate(() => {
    const vis = (el) => !!el && getComputedStyle(el).visibility !== 'hidden' && Number(getComputedStyle(el).opacity) > 0.5
    return {
      beat: [...document.querySelectorAll('.story-band .story-beat')].filter(vis).map((b) => b.textContent),
      jamila: document.querySelector('.story-stage-sky .story-star--jamila')?.textContent,
    }
  })
  if (!hers.beat.join(' ').includes('27 May 2002')) problems.push(`[interact] Chapter Two does not show 27 May 2002 (${hers.beat})`)
  if (!hers.jamila?.includes('Jamila') || !hers.jamila.includes('27 May 2002')) problems.push(`[interact] Jamila’s star label is wrong (${hers.jamila})`)
  await shot(page, 'interact-story-hers')
  await page.click('.story-progress--rail .story-progress__btn >> nth=4')
  await sleep(2600)
  await shot(page, 'interact-story-forever')
  await page.click('.story-band button:has-text("Replay our constellation")')
  await sleep(3400)
  const storyTop = await page.evaluate(() => Math.round(document.getElementById('stars').getBoundingClientRect().top))
  if (Math.abs(storyTop) > 4) problems.push(`[interact] replay did not return to the story start (${storyTop})`)

  // Wish card via progress star
  await page.click('.wish-progress__star >> nth=3')
  await sleep(1800)
  await shot(page, 'interact-wish-progress-4')
  const btn = page.locator('.wish-card').nth(3).locator('.wish-card__front .wish-card__btn')
  await btn.click()
  await sleep(1100)
  await shot(page, 'interact-wish-open')
  const open = await page.locator('.wish-card').nth(3).getAttribute('data-open')
  if (open === null) problems.push('[interact] wish card did not open')
  await page.keyboard.press('Escape')
  await sleep(900)
  const closed = await page.locator('.wish-card').nth(3).getAttribute('data-open')
  if (closed !== null) problems.push('[interact] wish card did not close with Escape')

  // Gallery tabs, carousel, viewer
  await page.evaluate(() => document.getElementById('archive')?.scrollIntoView())
  await sleep(1500)
  await page.click('[role="tab"] >> text=On Stage')
  await sleep(1500)
  await shot(page, 'interact-archive-stage')
  await page.click('.archive-controls .round-btn >> nth=1')
  await sleep(900)
  const pos = await page.textContent('.archive-position__count')
  if (!pos?.includes('02')) problems.push(`[interact] archive next did not advance (${pos})`)
  await page.click('.archive-thumb >> nth=1')
  await sleep(900)
  await shot(page, 'interact-lightbox')
  const dialogOpen = await page.evaluate(() => document.querySelector('.lightbox')?.hasAttribute('open'))
  if (!dialogOpen) problems.push('[interact] lightbox did not open')
  const viewerText = await page.textContent('.lightbox')
  if (/Photo:|Source/.test(viewerText ?? '')) problems.push('[interact] the photo viewer still shows a “Photo: … · Source” credit')
  await page.keyboard.press('ArrowRight')
  await sleep(500)
  const count = await page.textContent('.lightbox__count')
  if (!count?.startsWith('3')) problems.push(`[interact] lightbox arrow did not advance (${count})`)
  await page.keyboard.press('Escape')
  await sleep(500)

  // Film: switch to normal playback and play
  await page.evaluate(() => document.getElementById('film')?.scrollIntoView())
  await sleep(2500)
  await page.click('.film-mode__opt >> text=Play normally')
  await sleep(300)
  await page.click('.film-controls .round-btn >> nth=0')
  await sleep(1600)
  const playing = await page.evaluate(() => {
    const v = document.querySelector('.film-video')
    return v && !v.paused && v.currentTime > 0.3
  })
  if (!playing) problems.push('[interact] film did not play in normal mode')
  await shot(page, 'interact-film-playing')
  await page.click('.film-controls .round-btn >> nth=0')
  await sleep(300)
  const paused = await page.evaluate(() => document.querySelector('.film-video')?.paused)
  if (!paused) problems.push('[interact] film did not pause')

  // Letter: the wax seal is the button; there is no separate “Open your wedding wish” button
  await page.evaluate(() => document.getElementById('letter')?.scrollIntoView())
  await sleep(1500)
  await shot(page, 'interact-letter-sealed')
  const oldButton = await page.$('#letter .door-btn:has-text("Open your wedding wish")')
  if (oldButton) problems.push('[interact] the separate “Open your wedding wish” button is still there')
  const sealName = await page.getAttribute('.envelope__seal', 'aria-label')
  if (sealName !== 'Open your wedding wish') problems.push(`[interact] wax seal button has the wrong name (${sealName})`)
  await page.click('.envelope__seal')
  await sleep(4000)
  await shot(page, 'interact-letter-open')
  const letterVisible = await page.isVisible('.letter-signature')
  if (!letterVisible) problems.push('[interact] letter did not open from the seal')
  await page.click('text=Fold the letter')
  await sleep(900)
  const sealFocused = await page.evaluate(() => document.activeElement?.classList.contains('envelope__seal'))
  if (!sealFocused) problems.push('[interact] folding the letter did not return focus to the seal')
  // Keyboard: Enter on the focused seal opens the letter again
  await page.keyboard.press('Enter')
  await sleep(4000)
  if (!(await page.isVisible('.letter-signature'))) problems.push('[interact] Enter on the seal did not open the letter')

  // Finale: light up, replay, keepsake download
  await page.evaluate(() => document.getElementById('finale')?.scrollIntoView())
  await sleep(2000)
  await page.click('text=Light up your forever')
  await sleep(1400)
  await shot(page, 'interact-finale-burst')
  await sleep(2200)
  await shot(page, 'interact-finale-lit')
  const litText = await page.textContent('.finale-message')
  if (/Nothing is sent/.test(litText ?? '')) problems.push('[interact] the finale still shows the “only on this screen” note')
  await page.click('text=Replay the celebration')
  await sleep(600)
  await page.click('text=Replay the celebration')
  await sleep(3500)
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('text=Save your keepsake')])
  const file = path.join(out, download.suggestedFilename())
  await download.saveAs(file)
  const { size } = await fs.stat(file)
  console.log(`  ⬇ keepsake saved: ${path.basename(file)} (${Math.round(size / 1024)} KB)`)
  if (size < 50_000) problems.push('[interact] keepsake file suspiciously small')

  // Dedication after the finale, then the footer sentence (exact, italic)
  const order = await page.evaluate(() => [...document.querySelectorAll('main > section')].map((s) => s.id).join(' '))
  if (!order.endsWith('finale dedication')) problems.push(`[interact] dedication is not right after the finale (${order})`)
  const footer = await page.evaluate(() => {
    const line = document.querySelector('.site-footer__line')
    return { text: line?.textContent, style: line ? getComputedStyle(line).fontStyle : null }
  })
  if (footer.text !== 'Made for my love, Jamila from his loving husband Mustafa') problems.push(`[interact] footer text is “${footer.text}”`)
  if (footer.style !== 'italic') problems.push(`[interact] footer sentence is not italic (${footer.style})`)

  // Play button: starts the play-through with music; a wheel turn pauses it
  await page.evaluate(() => window.scrollTo(0, 0))
  await sleep(1200)
  await page.click('.site-header .tour-btn')
  await sleep(9000)
  const tourNow = await page.evaluate(() => ({
    state: document.querySelector('.tour-btn')?.getAttribute('data-state'),
    sound: document.querySelector('.site-header .sound-toggle')?.getAttribute('data-state'),
    y: scrollY,
  }))
  if (tourNow.state !== 'playing' || tourNow.sound !== 'on' || tourNow.y < 50) problems.push(`[interact] play button did not start the play-through with music (${JSON.stringify(tourNow)})`)
  await page.mouse.move(700, 500)
  await page.mouse.wheel(0, 120)
  await sleep(1500)
  const tourAfterWheel = await page.getAttribute('.tour-btn', 'data-state')
  if (tourAfterWheel !== 'paused') problems.push(`[interact] scrolling did not pause the play-through (${tourAfterWheel})`)
  await shot(page, 'interact-tour-paused')

  // Texts that were removed must not come back anywhere on the page (hidden faces included)
  const removed = ['Fan-made photocard', 'Not a quote', 'Media credits', 'not personal messages from BTS', 'Nothing is sent to anyone', 'Photo:']
  const pageText = await page.evaluate(() => document.body.textContent ?? '')
  for (const text of removed) if (pageText.includes(text)) problems.push(`[interact] removed text is back on the page: “${text}”`)
  await context.close()
}

// Headless Chrome on macOS uses the real GPU (ANGLE/Metal), so WebGL renders as it would for a visitor.
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  if (scenario === 'desktop' || scenario === 'all') await desktop(browser)
  if (scenario === 'calm' || scenario === 'all') await desktop(browser, { calm: true })
  if (scenario === 'mobile' || scenario === 'all') await mobile(browser)
  if (scenario === 'interactions' || scenario === 'all') await interactions(browser)
} catch (error) {
  problems.push(`[runner] ${error.message}`)
} finally {
  await browser.close()
}

if (problems.length) {
  console.log(`\n${problems.length} problem(s):`)
  for (const p of [...new Set(problems)]) console.log(' •', p)
  process.exitCode = 1
} else console.log('\nNo console errors, page errors or failed requests.')

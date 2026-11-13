/**
 * Captures the README screenshots and GIFs from the running site in the locally installed Google Chrome.
 *
 *   npm run build && npm run preview     # serves the production build on http://127.0.0.1:4173
 *   npm run docs:media [url]             # in another terminal
 *
 * Screenshots are real page captures saved as WebP. GIFs are real screen recordings: Chrome's
 * screencast frames (with their timestamps) are re-timed to a steady frame rate and given an
 * optimised palette by ffmpeg. Everything is written to docs/media/.
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'
import { chromium, devices } from 'playwright-core'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const url = process.argv[2] ?? 'http://127.0.0.1:4173/'
const out = path.join(root, 'docs', 'media')
await fs.mkdir(out, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = []

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] })
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} exited with ${code}`))))
  })
}

/** Waits for web fonts and every eagerly loaded image. */
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    const pending = [...document.images].filter((img) => !img.complete && img.loading !== 'lazy')
    await Promise.all(pending.map((img) => new Promise((r) => img.addEventListener('load', r, { once: true }) || img.addEventListener('error', r, { once: true }))))
  })
}

async function openPage(context) {
  const page = await context.newPage()
  page.on('pageerror', (e) => report.push(`page error: ${e.message}`))
  await page.goto(url, { waitUntil: 'networkidle' })
  await settle(page)
  return page
}

/** Opens the door without touching the mouse or keyboard, so no cursor glow or focus ring shows. */
async function enter(page) {
  await page.evaluate(() => document.querySelector('.inv-door__seal')?.click())
  await page.waitForFunction(() => document.getElementById('invitation')?.dataset.door === 'open', null, { timeout: 10000 })
  await sleep(2600)
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null))
}

const docTop = (page, sel) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + window.scrollY, sel)
async function jump(page, y, wait = 2200) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), Math.round(y))
  await sleep(wait)
}
/** Scroll position of a chapter's resting point in the pinned "Written in the Stars" story. */
async function storyY(page, label) {
  return page.evaluate((t) => {
    const el = document.getElementById('stars')
    const top = el.getBoundingClientRect().top + window.scrollY
    return top + (t / 11.9) * (el.offsetHeight - window.innerHeight)
  }, label)
}
/** Clicks without the mouse; the page then moves focus into the new state, so focus is cleared for a clean still. */
async function clickJs(page, sel, nth = 0) {
  await page.evaluate(([s, n]) => document.querySelectorAll(s)[n]?.click(), [sel, nth])
  await sleep(120)
  await page.evaluate(() => requestAnimationFrame(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null)))
}
const blur = (page) => page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null))

async function still(page, name) {
  const png = await page.screenshot()
  const file = path.join(out, `${name}.webp`)
  await sharp(png).webp({ quality: 84, effort: 6 }).toFile(file)
  const { size } = await fs.stat(file)
  report.push(`${name}.webp  ${Math.round(size / 1024)} KB`)
}

/** Records the page while `actions` run, then encodes a looping GIF from the real frames. */
async function record(page, name, actions, { fps = 12, widths = [720, 640, 560], colors = [192, 160, 128], maxBytes = 4.5e6, holdEnd = 0.8 } = {}) {
  const cdp = await page.context().newCDPSession(page)
  const frames = []
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    frames.push({ data, t: metadata.timestamp })
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 })
  await actions()
  await cdp.send('Page.stopScreencast')
  await cdp.detach()
  if (frames.length < 2) throw new Error(`${name}: the recording captured no motion`)

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'forever-era-gif-'))
  const lines = ['ffconcat version 1.0']
  for (let i = 0; i < frames.length; i++) {
    const f = path.join(dir, `f${String(i).padStart(5, '0')}.jpg`)
    await fs.writeFile(f, Buffer.from(frames[i].data, 'base64'))
    const d = i < frames.length - 1 ? frames[i + 1].t - frames[i].t : holdEnd
    lines.push(`file '${f}'`, `duration ${Math.max(0.001, d).toFixed(4)}`)
  }
  lines.push(`file '${path.join(dir, `f${String(frames.length - 1).padStart(5, '0')}.jpg`)}'`)
  const list = path.join(dir, 'frames.ffconcat')
  await fs.writeFile(list, `${lines.join('\n')}\n`)

  const file = path.join(out, `${name}.gif`)
  let size = 0
  for (let k = 0; k < widths.length; k++) {
    const vf = `fps=${fps},scale=${widths[k]}:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colors[k]}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`
    await run(ffmpegPath, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', vf, '-loop', '0', file])
    size = (await fs.stat(file)).size
    if (size <= maxBytes) break
  }
  await fs.rm(dir, { recursive: true, force: true })
  const meta = await sharp(file, { animated: true }).metadata()
  const seconds = (meta.delay ?? []).reduce((s, d) => s + d, 0) / 1000
  report.push(`${name}.gif  ${meta.width}×${meta.pageHeight}  ${meta.pages} frames  ${seconds.toFixed(1)} s  ${(size / 1e6).toFixed(2)} MB  (from ${frames.length} recorded frames)`)
}

/** Moves the pointer along a straight line in small steps, like a real hand. */
async function glide(page, from, to, ms) {
  const steps = Math.max(8, Math.round(ms / 16))
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    await page.mouse.move(from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e)
    await sleep(ms / steps)
  }
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' }

  // ── Stills on desktop (no pointer or keyboard involved, so nothing overlays the design) ──
  {
    const context = await browser.newContext(desktop)
    const page = await openPage(context)
    await sleep(1500)
    await still(page, 'door-desktop')
    await enter(page)
    await sleep(2400)
    await still(page, 'hero-desktop')

    await jump(page, await storyY(page, 10.8), 3000)
    await still(page, 'constellation-desktop')

    await jump(page, (await docTop(page, '#wishes')) + 2, 1800)
    await clickJs(page, '.wish-progress__star', 3)
    await sleep(2200)
    await clickJs(page, '.wish-card .wish-card__front .wish-card__btn', 3)
    await sleep(1400)
    await still(page, 'photocards-desktop')
    await clickJs(page, '.wish-card .wish-card__btn--close', 3)

    await jump(page, await docTop(page, '#finale'), 3000)
    await clickJs(page, '#finale .finale-actions .door-btn')
    await sleep(4200)
    await blur(page)
    await sleep(300)
    await still(page, 'finale-desktop')

    const note = await page.evaluate(() => {
      const card = document.querySelector('.dedication__card')
      const r = card.getBoundingClientRect()
      const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 68
      const room = window.innerHeight - header
      return r.top + window.scrollY - header - (room - r.height) / 2
    })
    await jump(page, note, 3200)
    await still(page, 'dedication-desktop')
    await context.close()
  }

  // ── GIF 1: the opening — the seal is pressed, the door opens, the names arrive, the pointer plays ──
  {
    const context = await browser.newContext(desktop)
    const page = await openPage(context)
    await sleep(1200)
    const seal = await page.locator('.inv-door__seal').boundingBox()
    const sx = seal.x + seal.width / 2
    const sy = seal.y + seal.height / 2
    await page.mouse.move(1180, 760)
    await record(page, 'opening-experience', async () => {
      await sleep(200)
      await glide(page, [1180, 760], [sx, sy], 600)
      await sleep(250)
      await page.mouse.down()
      await sleep(80)
      await page.mouse.up()
      await sleep(3500)
      await glide(page, [sx, sy], [430, 320], 650)
      await glide(page, [430, 320], [1060, 360], 750)
      await sleep(250)
    })
    await context.close()
  }

  // ── GIF 2: the constellation story, scrolled through from the first light to the wedding date ──
  {
    const context = await browser.newContext(desktop)
    const page = await openPage(context)
    await enter(page)
    await jump(page, await docTop(page, '#stars'), 2600)
    await page.mouse.move(1330, 830)
    const distance = (await storyY(page, 11.6)) - (await page.evaluate(() => window.scrollY))
    await record(page, 'constellation-story', async () => {
      await sleep(250)
      const steps = 60
      for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, distance / steps)
        await sleep(78)
      }
      await sleep(1100)
    })
    await context.close()
  }

  // ── GIF 3: the purple-light celebration in the finale ──
  {
    const context = await browser.newContext(desktop)
    const page = await openPage(context)
    await enter(page)
    await jump(page, await docTop(page, '#finale'), 3200)
    const btn = await page.locator('#finale .finale-actions .door-btn').first().boundingBox()
    const bx = btn.x + btn.width / 2
    const by = btn.y + btn.height / 2
    await page.mouse.move(1150, 520)
    await record(page, 'celebration-finale', async () => {
      await sleep(200)
      await glide(page, [1150, 520], [bx, by], 750)
      await sleep(250)
      await page.mouse.down()
      await sleep(80)
      await page.mouse.up()
      await sleep(4300)
    })
    await context.close()
  }

  // ── Mobile: three real phone screens side by side ──
  {
    const context = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2 })
    const page = await openPage(context)
    await sleep(1500)
    const shots = [await page.screenshot()]
    await enter(page)
    const step = await page.evaluate(() => {
      const el = document.querySelector('.story-step--forever')
      const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 58
      const bar = document.querySelector('.story-progress--bar')?.offsetHeight ?? 0
      return el.getBoundingClientRect().top + window.scrollY - header - bar - 12
    })
    await jump(page, step, 3000)
    shots.push(await page.screenshot())
    await jump(page, await docTop(page, '#finale'), 3000)
    await clickJs(page, '#finale .finale-actions .door-btn')
    await sleep(4200)
    await blur(page)
    await sleep(300)
    shots.push(await page.screenshot())
    await context.close()

    const w = 585
    const h = 996
    const gap = 40
    const pad = 56
    const W = pad * 2 + w * 3 + gap * 2
    const H = pad * 2 + h
    const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="36" ry="36"/></svg>`)
    const edge = Buffer.from(`<svg width="${w}" height="${h}"><rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="36" ry="36" fill="none" stroke="rgb(220,200,255)" stroke-opacity="0.28" stroke-width="1.5"/></svg>`)
    const tiles = await Promise.all(
      shots.map(async (buf, i) => ({
        input: await sharp(buf).resize(w, h).composite([{ input: mask, blend: 'dest-in' }, { input: edge }]).png().toBuffer(),
        left: pad + i * (w + gap),
        top: pad,
      })),
    )
    const bg = Buffer.from(
      `<svg width="${W}" height="${H}"><defs><radialGradient id="g" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#2a173f"/><stop offset="1" stop-color="#0b0612"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/></svg>`,
    )
    const file = path.join(out, 'mobile-views.webp')
    await sharp(bg).composite(tiles).webp({ quality: 84, effort: 6 }).toFile(file)
    const { size } = await fs.stat(file)
    report.push(`mobile-views.webp  ${Math.round(size / 1024)} KB  (door, story, finale on an iPhone 13-sized screen)`)
  }
} finally {
  await browser.close()
}
console.log(report.join('\n'))

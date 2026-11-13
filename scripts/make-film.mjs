/**
 * Renders the original "Forever Era" concert-light film for the scroll-driven film scene.
 * Frames come from scripts/film/film.html (a deterministic canvas renderer) running in the
 * locally installed Google Chrome, and are piped straight into ffmpeg.
 *
 * The H.264 file uses a short keyframe interval and no B-frames, so seeking to any
 * scroll position stays responsive.
 *
 *   npm run media:audio   # renders media-src/audio/film-score.wav first
 *   npm run media:film
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'
import { chromium } from 'playwright-core'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'media', 'film')
const scoreWav = path.join(root, 'media-src', 'audio', 'film-score.wav')
const constellation = JSON.parse(await fs.readFile(path.join(root, 'src', 'config', 'constellation.json'), 'utf8'))

const FPS = 30
const SECONDS = Number(process.env.FILM_SECONDS ?? 12)
const POSTER_T = 10.8

async function main() {
  await fs.mkdir(outDir, { recursive: true })
  const hasScore = await fs
    .access(scoreWav)
    .then(() => true)
    .catch(() => false)
  if (!hasScore) throw new Error('Run `npm run media:audio` first to create the film score.')

  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(path.join(root, 'scripts', 'film', 'film.html')).href)
  await page.evaluate((c) => window.setup(c), constellation)

  const mp4 = path.join(outDir, 'forever-era.mp4')
  const ff = spawn(
    ffmpegPath,
    [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-i', scoreWav,
      '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p',
      '-g', '8', '-keyint_min', '8', '-sc_threshold', '0', '-bf', '0',
      '-c:a', 'aac', '-b:a', '128k',
      '-t', String(SECONDS),
      '-movflags', '+faststart',
      mp4,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  )

  const total = Math.round(FPS * SECONDS)
  for (let i = 0; i < total; i++) {
    const dataUrl = await page.evaluate((t) => window.frame(t, 0.93), i / FPS)
    const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
    if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain')
    if (i % 60 === 0) console.log(`  frame ${i}/${total}`)
  }
  ff.stdin.end()
  const [code] = await once(ff, 'close')
  if (code !== 0) throw new Error(`ffmpeg exited with ${code}`)

  // Poster: the completed constellation, shown before playback.
  const posterUrl = await page.evaluate((t) => window.frame(t, 0.95), POSTER_T)
  const posterJpg = Buffer.from(posterUrl.slice(posterUrl.indexOf(',') + 1), 'base64')
  await sharp(posterJpg).webp({ quality: 80 }).toFile(path.join(outDir, 'forever-era-poster.webp'))
  await sharp(posterJpg).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(outDir, 'forever-era-poster.jpg'))

  // Review sheet for checking the film without playing it.
  const times = [0.8, 2.6, 4.6, 6.6, 8.6, 10.8]
  const tiles = []
  for (const t of times) {
    const url = await page.evaluate((tt) => window.frame(tt, 0.85), t)
    tiles.push(await sharp(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')).resize(640, 360).toBuffer())
  }
  const sheetPath = path.join(root, 'media-src', 'film-review.jpg')
  await sharp({ create: { width: 1280, height: 1080, channels: 3, background: '#000' } })
    .composite(tiles.map((input, i) => ({ input, left: (i % 2) * 640, top: Math.floor(i / 2) * 360 })))
    .jpeg({ quality: 80 })
    .toFile(sheetPath)

  await browser.close()
  const { size } = await fs.stat(mp4)
  console.log(`Film written: ${path.relative(root, mp4)} (${(size / 1024 / 1024).toFixed(2)} MB), poster and review sheet saved.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

/**
 * Downloads the curated Wikimedia Commons photographs, generates responsive WebP files
 * and writes the typed media manifest plus a human-readable credits file.
 *
 *   npm run media:fetch            # download missing originals, rebuild all outputs
 *   npm run media:fetch -- --force # re-download originals too
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { IMAGE_SOURCES, GALLERY } from './media-sources.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rawDir = path.join(root, 'media-src', 'commons')
const outDir = path.join(root, 'public', 'media', 'img')
const manifestPath = path.join(root, 'src', 'config', 'media.generated.ts')
const creditsPath = path.join(root, 'MEDIA_CREDITS.md')
const force = process.argv.includes('--force')

const UA = 'JamilaMustafaForeverEra/1.0 (private fan tribute; static site build script)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function request(url, { json = false, attempts = 8 } = {}) {
  let wait = 4000
  let lastStatus = 0
  for (let attempt = 0; attempt < attempts; attempt++) {
    let res
    try {
      res = await fetch(url, { headers: { 'User-Agent': UA } })
    } catch (error) {
      if (attempt === attempts - 1) throw error
      await sleep(wait)
      wait *= 1.8
      continue
    }
    if (res.ok) return json ? res.json() : Buffer.from(await res.arrayBuffer())
    lastStatus = res.status
    if (res.status !== 429 && res.status < 500) throw new Error(`HTTP ${res.status} for ${url}`)
    if (attempt === attempts - 1) break
    const retryAfter = Number(res.headers.get('retry-after'))
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(20, retryAfter) * 1000 : wait)
    wait *= 1.8
  }
  throw new Error(`Gave up on ${url} (last status ${lastStatus})`)
}

const stripHtml = (value = '') =>
  value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Prefer Commons' cached thumbnails (standard widths) over multi-megabyte originals:
 * they are lighter on Wikimedia's servers and far less likely to be rate limited.
 */
function downloadUrls(meta, needed) {
  // Wikimedia only serves a fixed set of thumbnail widths; other sizes return HTTP 400.
  const steps = [960, 1280, 1920, 3840]
  const match = meta.url.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/(.+)$/)
  if (!match) return [meta.url]
  const [, base, a, ab, name] = match
  const clean = name.split('?')[0]
  const thumb = (w) => `${base}/thumb/${a}/${ab}/${clean}/${w}px-${clean}`
  const usable = steps.filter((s) => s < meta.width)
  const preferred = usable.find((s) => s >= needed)
  const urls = preferred ? [thumb(preferred)] : [meta.url]
  // Fallbacks: the original, then the largest thumbnail below it.
  if (preferred) urls.push(meta.url)
  const below = [...usable].reverse().find((s) => s !== preferred)
  if (below) urls.push(thumb(below))
  return urls
}

async function commonsInfo(files) {
  const info = {}
  for (let i = 0; i < files.length; i += 25) {
    const chunk = files.slice(i, i + 25)
    const url =
      'https://commons.wikimedia.org/w/api.php?' +
      new URLSearchParams({
        action: 'query',
        format: 'json',
        prop: 'imageinfo',
        iiprop: 'url|size|mime|extmetadata',
        titles: chunk.map((f) => `File:${f}`).join('|'),
      })
    const data = await request(url, { json: true })
    const normalized = Object.fromEntries((data.query.normalized ?? []).map((n) => [n.to, n.from]))
    for (const page of Object.values(data.query.pages)) {
      if (!page.imageinfo) throw new Error(`Missing on Commons: ${page.title}`)
      const original = (normalized[page.title] ?? page.title).replace(/^File:/, '')
      const ii = page.imageinfo[0]
      const meta = ii.extmetadata ?? {}
      info[original] = {
        url: ii.url,
        page: ii.descriptionurl,
        width: ii.width,
        height: ii.height,
        // Some Commons artist fields append notes ("Additional details…"); keep just the credit line.
        author: (stripHtml(meta.Artist?.value).split(/\s+Additional details/i)[0] || 'Unknown author').slice(0, 90),
        license: stripHtml(meta.LicenseShortName?.value) || 'See source page',
        licenseUrl: meta.LicenseUrl?.value ?? '',
        description: stripHtml(meta.ImageDescription?.value).slice(0, 300),
        date: stripHtml(meta.DateTimeOriginal?.value).slice(0, 40),
      }
    }
    await sleep(600)
  }
  return info
}

async function main() {
  await fs.mkdir(rawDir, { recursive: true })
  await fs.mkdir(outDir, { recursive: true })

  console.log(`Fetching metadata for ${IMAGE_SOURCES.length} images…`)
  const info = await commonsInfo(IMAGE_SOURCES.map((s) => s.file))

  const manifest = {}
  for (const source of IMAGE_SOURCES) {
    const meta = info[source.file]
    const ext = path.extname(meta.url).toLowerCase() || '.jpg'
    const rawPath = path.join(rawDir, `${source.id}${ext}`)
    let exists = false
    try {
      await fs.access(rawPath)
      exists = true
    } catch {
      /* not downloaded yet */
    }
    if (!exists || force) {
      const needed = Math.max(...source.widths)
      const urls = downloadUrls(meta, needed)
      process.stdout.write(`  ↓ ${source.id} (${meta.width}×${meta.height}) … `)
      let saved = false
      for (const url of urls) {
        try {
          await fs.writeFile(rawPath, await request(url, { attempts: 3 }))
          console.log(url === meta.url ? 'original' : url.match(/\/(\d+)px-/)?.[1] + 'px thumbnail')
          saved = true
          break
        } catch (error) {
          process.stdout.write(`(${error.message.slice(0, 60)}) … `)
        }
      }
      if (!saved) throw new Error(`Could not download ${source.file}`)
      await sleep(2500)
    }

    const { width: srcW } = await sharp(rawPath, { failOn: 'none' }).metadata()
    const widths = [...new Set(source.widths.map((w) => Math.min(w, srcW)))].sort((a, b) => a - b)
    const variants = []
    for (const w of widths) {
      const file = `${source.id}-${w}.webp`
      const out = await sharp(rawPath, { failOn: 'none' })
        .rotate()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: source.quality ?? 76, effort: 5, smartSubsample: true })
        .toFile(path.join(outDir, file))
      variants.push({ file, width: out.width, height: out.height, bytes: out.size })
    }
    const tiny = await sharp(rawPath, { failOn: 'none' }).rotate().resize({ width: 24 }).blur(1.2).webp({ quality: 40 }).toBuffer()
    const largest = variants[variants.length - 1]
    manifest[source.id] = {
      id: source.id,
      src: `media/img/${variants[Math.min(1, variants.length - 1)].file}`,
      srcSet: variants.map((v) => `media/img/${v.file} ${v.width}w`).join(', '),
      width: largest.width,
      height: largest.height,
      placeholder: `data:image/webp;base64,${tiny.toString('base64')}`,
      alt: source.alt,
      caption: source.caption,
      members: source.members ?? [],
      focus: source.focus ?? '50% 50%',
      credit: {
        title: source.file.replace(/\.[a-z]+$/i, ''),
        author: meta.author,
        license: meta.license,
        licenseUrl: meta.licenseUrl,
        source: meta.page,
        date: meta.date,
        description: meta.description,
      },
    }
    const kb = Math.round(variants.reduce((n, v) => n + v.bytes, 0) / 1024)
    console.log(`  ✓ ${source.id}: ${variants.map((v) => v.width).join('/')}px, ${kb} KB total — ${meta.license}, ${meta.author}`)
    console.log(`      ${meta.date} · ${meta.description.slice(0, 160)}`)
  }

  const ts = `/* eslint-disable */
// Generated by scripts/fetch-media.mjs — do not edit by hand.
// Source files: Wikimedia Commons. Authors and licences are pulled from each file page.

export type ImageCredit = {
  title: string
  author: string
  license: string
  licenseUrl: string
  source: string
  date: string
  description: string
}

export type ImageAsset = {
  id: string
  src: string
  srcSet: string
  width: number
  height: number
  placeholder: string
  alt: string
  caption: string
  members: string[]
  focus: string
  credit: ImageCredit
}

export const IMAGES = ${JSON.stringify(manifest, null, 2)} satisfies Record<string, ImageAsset>

export type ImageId = keyof typeof IMAGES

export const GALLERY_IDS = ${JSON.stringify(GALLERY, null, 2)} as const
`
  await fs.writeFile(manifestPath, ts)

  const lines = [
    '# Media credits',
    '',
    'Every photograph on this site is a freely licensed image from Wikimedia Commons.',
    'Files were resized and converted to WebP; no other edits were made to the photographs themselves',
    '(the site applies colour overlays in CSS). Member identification comes from each Commons file title.',
    '',
    '| Use | Photo | Author | Licence | Source |',
    '| --- | --- | --- | --- | --- |',
    ...Object.values(manifest).map(
      (m) =>
        `| ${m.id} | ${m.caption.replace(/\|/g, '/')} | ${m.credit.author.replace(/\|/g, '/')} | ${m.credit.licenseUrl ? `[${m.credit.license}](${m.credit.licenseUrl})` : m.credit.license} | [Commons](${m.credit.source}) |`,
    ),
    '',
    '## Film and sound',
    '',
    '- **“Forever Era” concert-light film** (`public/media/film/`): original animation rendered for this tribute by `scripts/make-film.mjs`. No third-party footage.',
    '- **“Purple Ocean” ambient soundtrack** (`public/media/audio/`): original synthesised music generated by `scripts/make-audio.mjs`. No samples.',
    '- **Official music videos**: embedded from the HYBE LABELS YouTube channel using YouTube’s privacy-enhanced player. They are not hosted or modified here.',
    '',
    '## Typefaces',
    '',
    '- Cormorant Garamond by Christian Thalmann — SIL Open Font License 1.1 (self-hosted via Fontsource).',
    '- Manrope by Mikhail Sharanda — SIL Open Font License 1.1 (self-hosted via Fontsource).',
    '',
    '## Disclaimer',
    '',
    'This is an unofficial, non-commercial fan tribute made for Jamila & Mustafa Lokhandwala. BTS, ARMY and related names belong to their owners;',
    'no endorsement by BTS, BIGHIT MUSIC or HYBE is implied. All wishes and the letter are original writing for this tribute, not quotes from BTS.',
    '',
  ]
  await fs.writeFile(creditsPath, lines.join('\n'))
  console.log(`\nWrote ${path.relative(root, manifestPath)} and ${path.relative(root, creditsPath)}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

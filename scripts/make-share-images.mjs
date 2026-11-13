/**
 * Renders the link-preview card (public/og-image.jpg, 1200 × 630) and the home-screen icon
 * (public/apple-touch-icon.png, 180 × 180) in the locally installed Google Chrome, using the
 * site's own fonts. Both use only original artwork: the card's background is the poster frame
 * of the original film, so no photo credit is needed where link previews appear.
 *
 *   npm run media:film     # creates the poster first
 *   npm run media:share
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { chromium } from 'playwright-core'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pub = path.join(root, 'public')
const fonts = path.join(root, 'node_modules', '@fontsource-variable')

async function dataUrl(file, type) {
  return `data:${type};base64,${(await fs.readFile(file)).toString('base64')}`
}

const [serif, serifItalic, sans, poster] = await Promise.all([
  dataUrl(path.join(fonts, 'cormorant-garamond', 'files', 'cormorant-garamond-latin-wght-normal.woff2'), 'font/woff2'),
  dataUrl(path.join(fonts, 'cormorant-garamond', 'files', 'cormorant-garamond-latin-wght-italic.woff2'), 'font/woff2'),
  dataUrl(path.join(fonts, 'manrope', 'files', 'manrope-latin-wght-normal.woff2'), 'font/woff2'),
  dataUrl(path.join(pub, 'media', 'film', 'forever-era-poster.jpg'), 'image/jpeg').catch(() => {
    throw new Error('Run `npm run media:film` first: the share card uses the film poster.')
  }),
])

const fontFaces = `
  @font-face { font-family: 'Display'; font-weight: 300 700; src: url(${serif}) format('woff2'); }
  @font-face { font-family: 'Display'; font-style: italic; font-weight: 300 700; src: url(${serifItalic}) format('woff2'); }
  @font-face { font-family: 'UI'; font-weight: 200 800; src: url(${sans}) format('woff2'); }
  * { margin: 0; box-sizing: border-box; }
  html, body { background: #100918; }
`

const card = `<!doctype html><html><head><style>${fontFaces}
  .card { position: relative; width: 1200px; height: 630px; overflow: hidden; color: #fff8f0; text-align: center;
    background: #100918 url(${poster}) center 32% / 1200px auto no-repeat; }
  .card::before { content: ''; position: absolute; inset: 0;
    background: linear-gradient(180deg, rgb(16 9 24 / 0) 34%, rgb(16 9 24 / 0.55) 58%, rgb(16 9 24 / 0.9) 100%); }
  .frame { position: absolute; inset: 22px; border: 1.5px solid rgb(216 190 145 / 0.45); border-radius: 18px; }
  .copy { position: absolute; left: 0; right: 0; bottom: 74px; display: grid; justify-items: center; gap: 12px; }
  .eyebrow { font: 700 17px/1 UI, sans-serif; letter-spacing: 0.42em; text-transform: uppercase; color: #d8be91; padding-left: 0.42em; }
  h1 { font: italic 400 112px/0.95 Display, serif; text-shadow: 0 0 44px rgb(169 112 255 / 0.75), 0 4px 18px rgb(16 9 24 / 0.6); }
  .era { font: 500 40px/1 Display, serif; color: #dcc8ff; letter-spacing: 0.02em; }
</style></head><body>
  <div class="card" id="card">
    <div class="frame"></div>
    <div class="copy">
      <p class="eyebrow">A BTS-inspired wedding wish</p>
      <h1>Jamila &amp; Mustafa</h1>
      <p class="era">Their Forever Era</p>
    </div>
  </div>
</body></html>`

// Full-bleed square: iOS rounds the corners itself and fills transparency with black.
const icon = `<!doctype html><html><head><style>${fontFaces}
  .icon { width: 180px; height: 180px; }
</style></head><body>
  <svg class="icon" id="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
      <radialGradient id="g" cx="50%" cy="35%" r="75%">
        <stop offset="0" stop-color="#7b48c4"/>
        <stop offset="1" stop-color="#100918"/>
      </radialGradient>
    </defs>
    <rect width="64" height="64" fill="url(#g)"/>
    <path d="M15 60V28a17 17 0 0 1 34 0v32" fill="none" stroke="#d8be91" stroke-width="2"/>
    <text x="25.5" y="49" text-anchor="middle" font-family="Display" font-style="italic" font-size="21" fill="#fff8f0">J</text>
    <text x="39" y="49" text-anchor="middle" font-family="Display" font-style="italic" font-size="21" fill="#fff8f0">M</text>
    <path d="M32 9.5c.4 2.6 1.7 3.9 4.3 4.3-2.6.4-3.9 1.7-4.3 4.3-.4-2.6-1.7-3.9-4.3-4.3 2.6-.4 3.9-1.7 4.3-4.3Z" fill="#d8be91"/>
  </svg>
</body></html>`

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })

  await page.setContent(card)
  await page.evaluate(() => document.fonts.ready)
  const cardPng = await page.locator('#card').screenshot({ type: 'png' })
  await sharp(cardPng).jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(pub, 'og-image.jpg'))

  await page.setContent(icon)
  await page.evaluate(() => document.fonts.ready)
  const iconPng = await page.locator('#icon').screenshot({ type: 'png', omitBackground: false })
  await sharp(iconPng).flatten({ background: '#100918' }).png({ compressionLevel: 9 }).toFile(path.join(pub, 'apple-touch-icon.png'))
} finally {
  await browser.close()
}

for (const f of ['og-image.jpg', 'apple-touch-icon.png']) {
  const { size } = await fs.stat(path.join(pub, f))
  const { width, height } = await sharp(path.join(pub, f)).metadata()
  console.log(`Wrote public/${f} (${width} × ${height}, ${Math.round(size / 1024)} KB)`)
}

import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Link previews (WhatsApp, iMessage, Slack, social apps) need an absolute image URL.
 * With VITE_SITE_URL set to the published address, the build writes absolute og:url,
 * og:image and twitter:image tags. Without it, a relative og:image is written as a
 * best effort; some apps then show the link without a picture.
 */
function shareMeta(siteUrl: string): Plugin {
  return {
    name: 'forever-era:share-meta',
    transformIndexHtml() {
      const base = siteUrl.trim()
      let image = 'og-image.jpg'
      let pageUrl: string | null = null
      if (base) {
        const root = new URL(base.endsWith('/') ? base : `${base}/`)
        pageUrl = root.href
        image = new URL('og-image.jpg', root).href
      }
      const meta = (attrs: Record<string, string>) => ({ tag: 'meta', attrs, injectTo: 'head' as const })
      return [
        ...(pageUrl ? [meta({ property: 'og:url', content: pageUrl })] : []),
        meta({ property: 'og:image', content: image }),
        meta({ property: 'og:image:width', content: '1200' }),
        meta({ property: 'og:image:height', content: '630' }),
        meta({ property: 'og:image:alt', content: 'Jamila & Mustafa, Their Forever Era: a seven-star constellation over a purple ocean of lights' }),
        meta({ name: 'twitter:image', content: image }),
      ]
    },
  }
}

// Relative base keeps the static build portable: it works from a domain root,
// a sub-folder (GitHub Pages) or a drag-and-drop host such as Netlify Drop.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    base: './',
    plugins: [react(), shareMeta(env.VITE_SITE_URL ?? '')],
    build: {
      target: 'es2022',
      assetsInlineLimit: 2048,
      chunkSizeWarningLimit: 900,
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
    },
  }
})

/** Resolves a file in /public against Vite's base URL, so the build works from any folder. */
export function asset(path: string): string {
  const base = import.meta.env.BASE_URL
  return `${base}${path.replace(/^\//, '')}`
}

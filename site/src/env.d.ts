/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** The Go backend, e.g. https://api.teachforfree.com (the app's .env). */
  readonly VITE_API_URL: string
}

// shared/branding.ts (tffHead)
declare module 'virtual:tff-head' {
  /** shared/pwa-head.html, with ?v= on every /branding/ image. */
  export const pwaHead: string
  /** The chalkboard logo. */
  export const logoUrl: string
  /** The 1200×630 link-preview image (path only). */
  export const ogImageUrl: string
  /** The 512px app icon (path only). */
  export const iconUrl: string
}

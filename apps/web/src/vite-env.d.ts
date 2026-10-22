/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Pixel Race API, e.g. "http://localhost:3001". */
  readonly VITE_API_BASE_URL?: string;
  /** Buy Me a Coffee page for the floating donate button, e.g. "https://buymeacoffee.com/name". */
  readonly VITE_BUY_ME_A_COFFEE_URL?: string;
  /** "false" turns accounts off (guest-only site: no login/register). On when unset. */
  readonly VITE_AUTH_ENABLED?: string;
  /** Public site URL for canonical/og:url/sitemap, e.g. "https://pixelgp.example". Build-time only. */
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

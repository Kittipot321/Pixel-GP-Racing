// Build-time SEO helpers: the site URL, the head tags that need it, and the
// robots.txt / sitemap.xml files.
//
// Pure functions with no DOM access, so vite.config.ts can import them at build
// time and the tests can call them directly. Social crawlers (LINE, Facebook)
// do not run JavaScript, so everything here is written into the built
// index.html rather than set from React.

export const SITE_NAME = 'Pixel GP Racing';

/**
 * Public pages: the landing page (home, used for the build-time canonical and
 * og:url) and the game. Every other route needs a login.
 */
export const INDEXED_PATHS = ['/', '/play'] as const;

export const OG_IMAGE = {
  path: '/og-image.png',
  width: 1200,
  height: 630,
  alt: 'Pixel GP Racing — รถ F1 พิกเซล 4 สีแข่งกันเข้าเส้นชัย',
} as const;

export interface SiteUrlEnv {
  VITE_SITE_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
}

export interface HeadTag {
  tag: 'link' | 'meta';
  attrs: Record<string, string>;
}

/**
 * The absolute site URL without a trailing slash, or null when none is known.
 * VITE_SITE_URL wins (a custom domain); otherwise the production host Vercel
 * sets at build time. A local build has neither.
 */
export function resolveSiteUrl(env: SiteUrlEnv): string | null {
  const explicit = env.VITE_SITE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }
  const vercelHost = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelHost) {
    return `https://${vercelHost.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  }
  return null;
}

/** Tags that need an absolute URL; none when the site URL is unknown. */
export function buildHeadTags(siteUrl: string | null): HeadTag[] {
  if (!siteUrl) {
    return [];
  }
  const pageUrl = `${siteUrl}${INDEXED_PATHS[0]}`; // the home page
  const imageUrl = `${siteUrl}${OG_IMAGE.path}`;
  return [
    { tag: 'link', attrs: { rel: 'canonical', href: pageUrl } },
    { tag: 'meta', attrs: { property: 'og:url', content: pageUrl } },
    { tag: 'meta', attrs: { property: 'og:image', content: imageUrl } },
    { tag: 'meta', attrs: { property: 'og:image:width', content: String(OG_IMAGE.width) } },
    { tag: 'meta', attrs: { property: 'og:image:height', content: String(OG_IMAGE.height) } },
    { tag: 'meta', attrs: { property: 'og:image:alt', content: OG_IMAGE.alt } },
    { tag: 'meta', attrs: { name: 'twitter:image', content: imageUrl } },
  ];
}

export function buildRobotsTxt(siteUrl: string | null): string {
  const lines = ['User-agent: *', 'Allow: /'];
  if (siteUrl) {
    lines.push('', `Sitemap: ${siteUrl}/sitemap.xml`);
  }
  return `${lines.join('\n')}\n`;
}

export function buildSitemapXml(siteUrl: string): string {
  const urls = INDEXED_PATHS.map((path) => `  <url>\n    <loc>${siteUrl}${path}</loc>\n  </url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {
  buildHeadTags,
  buildRobotsTxt,
  buildSitemapXml,
  resolveSiteUrl,
} from './src/seo/site-meta.ts';

/**
 * Writes the URL-dependent SEO tags into index.html and emits robots.txt and
 * sitemap.xml. Without a known site URL (a local build) it adds no absolute
 * tags and no sitemap, and says so once.
 */
function seo(siteUrl: string | null): Plugin {
  return {
    name: 'pixel-gp-seo',
    transformIndexHtml() {
      return buildHeadTags(siteUrl).map(({ tag, attrs }) => ({
        tag,
        attrs,
        injectTo: 'head' as const,
      }));
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: buildRobotsTxt(siteUrl) });
      if (siteUrl) {
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: buildSitemapXml(siteUrl) });
      } else {
        this.warn(
          'No site URL (VITE_SITE_URL or VERCEL_PROJECT_PRODUCTION_URL): skipped canonical, og:url, og:image and sitemap.xml',
        );
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteUrl = resolveSiteUrl({
    VITE_SITE_URL: env.VITE_SITE_URL,
    VERCEL_PROJECT_PRODUCTION_URL: env.VERCEL_PROJECT_PRODUCTION_URL,
  });
  return {
    plugins: [react(), tailwindcss(), seo(siteUrl)],
    server: {
      port: 5173,
      open: true,
    },
  };
});

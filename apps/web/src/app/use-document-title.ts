// Per-page browser tab title, in the active UI language.
//
// The home page (the landing page at /) gets "<site> - <tagline>", matching the
// static title in index.html that social crawlers read; every other page gets
// "<page> | <site>". Search engines that run JavaScript see these titles.
//
// useCanonicalPath points the build-time canonical and og:url tags at the
// current page, so /play is not read as a duplicate of the home page.

import { useEffect } from 'react';
import { useI18n } from '../i18n/i18n-context.tsx';
import { SITE_NAME } from '../seo/site-meta.ts';

export function pageTitle(page: string | null, tagline: string): string {
  return page ? `${page} | ${SITE_NAME}` : `${SITE_NAME} - ${tagline}`;
}

/** Sets document.title; pass null for the home page. */
export function useDocumentTitle(page: string | null): void {
  const { t } = useI18n();
  const title = pageTitle(page, t.seo.tagline);
  useEffect(() => {
    document.title = title;
  }, [title]);
}

const CANONICAL_TAGS = [
  ['link[rel="canonical"]', 'href'],
  ['meta[property="og:url"]', 'content'],
] as const;

/**
 * Rewrites the path of the canonical and og:url tags, keeping their origin.
 * Does nothing when the build had no site URL (the tags are absent).
 */
export function useCanonicalPath(path: string): void {
  useEffect(() => {
    for (const [selector, attr] of CANONICAL_TAGS) {
      const element = document.head.querySelector(selector);
      const current = element?.getAttribute(attr);
      if (element && current) {
        element.setAttribute(attr, new URL(path, current).href);
      }
    }
  }, [path]);
}

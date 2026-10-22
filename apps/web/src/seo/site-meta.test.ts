import { buildHeadTags, buildRobotsTxt, buildSitemapXml, resolveSiteUrl } from './site-meta.ts';

describe('resolveSiteUrl', () => {
  it('prefers VITE_SITE_URL and drops trailing slashes', () => {
    expect(
      resolveSiteUrl({
        VITE_SITE_URL: 'https://pixelgp.example/',
        VERCEL_PROJECT_PRODUCTION_URL: 'pixel-gp.vercel.app',
      }),
    ).toBe('https://pixelgp.example');
  });

  it('falls back to the Vercel production host over https', () => {
    expect(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'pixel-gp.vercel.app' })).toBe(
      'https://pixel-gp.vercel.app',
    );
  });

  it('returns null when neither is set or both are blank', () => {
    expect(resolveSiteUrl({})).toBeNull();
    expect(resolveSiteUrl({ VITE_SITE_URL: '  ', VERCEL_PROJECT_PRODUCTION_URL: '' })).toBeNull();
  });
});

describe('buildHeadTags', () => {
  it('points canonical and og:url at the home page and the image at an absolute URL', () => {
    const tags = buildHeadTags('https://pixelgp.example');
    expect(tags).toContainEqual({
      tag: 'link',
      attrs: { rel: 'canonical', href: 'https://pixelgp.example/' },
    });
    expect(tags).toContainEqual({
      tag: 'meta',
      attrs: { property: 'og:url', content: 'https://pixelgp.example/' },
    });
    expect(tags).toContainEqual({
      tag: 'meta',
      attrs: { property: 'og:image', content: 'https://pixelgp.example/og-image.png' },
    });
  });

  it('adds nothing without a site URL', () => {
    expect(buildHeadTags(null)).toEqual([]);
  });
});

describe('buildRobotsTxt', () => {
  it('allows everything and links the sitemap', () => {
    const robots = buildRobotsTxt('https://pixelgp.example');
    expect(robots).toContain('User-agent: *\nAllow: /');
    expect(robots).toContain('Sitemap: https://pixelgp.example/sitemap.xml');
  });

  it('omits the sitemap line without a site URL', () => {
    expect(buildRobotsTxt(null)).not.toContain('Sitemap:');
  });
});

describe('buildSitemapXml', () => {
  it('lists the landing page and the /play page', () => {
    const xml = buildSitemapXml('https://pixelgp.example');
    expect(xml).toContain('<loc>https://pixelgp.example/</loc>');
    expect(xml).toContain('<loc>https://pixelgp.example/play</loc>');
    expect(xml.match(/<url>/g)).toHaveLength(2);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });
});

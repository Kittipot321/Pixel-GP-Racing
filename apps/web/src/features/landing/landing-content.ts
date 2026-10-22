// Values on the landing page that are meant to be edited by hand.
//
// Screenshots: drop 16:9 PNGs (1280×720 works well) into
// apps/web/public/landing/ under these names. Until a file exists, its slot
// shows a pixel placeholder instead of a broken image.
//
// Links: the social and legal links are placeholders ('#') until the real
// pages exist. Replace each href; external links open in a new tab.

export type ShotKey = 'hero' | 'start' | 'race' | 'finish';

export const SCREENSHOTS: Record<ShotKey, string> = {
  hero: '/landing/hero.png',
  start: '/landing/start.png',
  race: '/landing/race.png',
  finish: '/landing/finish.png',
};

/** Gallery order, left to right. */
export const GALLERY_SHOTS: readonly ShotKey[] = ['start', 'race', 'finish'];

export interface FooterLink {
  label: string;
  href: string;
}

// TODO: replace '#' with the real Discord / X / YouTube URLs.
export const SOCIAL_LINKS: readonly FooterLink[] = [
  // { label: 'Discord', href: '#' },
  // { label: 'X', href: '#' },
  // { label: 'YouTube', href: '#' },
];

// TODO: replace '#' once the terms and privacy pages exist.
export const LEGAL_LINKS = {
  terms: '#',
  privacy: '#',
} as const;

/** True for a link that leaves the site (gets target="_blank"). */
export function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href);
}

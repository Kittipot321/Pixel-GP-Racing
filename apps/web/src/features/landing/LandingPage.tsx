// Landing page at "/": introduces the game to new visitors and search engines.
//
// Sections follow WIREFRAME_LANDING_PAGE.md: header, hero, why play, how to
// play, screenshots, a final call to action, and the footer. Every call to
// action goes to /play, where guests can start right away. The page has its own
// header and footer, so it sits outside AppLayout.
//
// The score sentence in "how to play" only shows when accounts are on: with
// VITE_AUTH_ENABLED=false nobody can log in to earn points.
//
// Screenshots and the footer's social/legal links come from landing-content.ts.

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CAR_COLORS } from '@pixel-race/shared-types';
import { useAuth } from '../auth/auth-context.tsx';
import { useI18n } from '../../i18n/i18n-context.tsx';
import { LanguageToggle } from '../../i18n/LanguageToggle.tsx';
import { ThemeToggle } from '../../theme/ThemeToggle.tsx';
import { useCanonicalPath, useDocumentTitle } from '../../app/use-document-title.ts';
import { SITE_NAME } from '../../seo/site-meta.ts';
import { CAR_CSS } from '../../game/colors.ts';
import {
  pixelButtonCompactPrimary,
  pixelButtonPrimary,
  pixelHeading,
  pixelPanel,
} from '../../app/ui.ts';
import { ScreenshotSlot } from './ScreenshotSlot.tsx';
import {
  GALLERY_SHOTS,
  LEGAL_LINKS,
  SCREENSHOTS,
  SOCIAL_LINKS,
  isExternal,
} from './landing-content.ts';

const section = 'mx-auto w-full max-w-[1040px] px-4 py-12 sm:px-6 sm:py-16';
const sectionHeading = `${pixelHeading} text-center`;
// `!` so these sizes beat the button's own px/py/text classes.
const bigCta = `${pixelButtonPrimary} px-6! py-4! text-sm! sm:text-base!`;
const footerLink =
  'text-muted underline-offset-4 hover:text-snow hover:underline focus-visible:outline-2 focus-visible:outline-accent';

/** Seconds each car takes to cross the hero strip; different so they overtake. */
const STRIP_DURATIONS = [5.2, 4.6, 5.8, 4.9];

export function LandingPage() {
  const { t } = useI18n();
  const { authEnabled } = useAuth();
  useDocumentTitle(null);
  useCanonicalPath('/');
  const l = t.landing;

  return (
    <div className="min-h-screen" data-testid="landing-page">
      <header className="sticky top-0 z-30 border-b-4 border-black bg-panel">
        <nav
          aria-label={l.navLabel}
          className="mx-auto flex max-w-[1040px] items-center gap-3 px-3 py-2 sm:gap-4 sm:px-6 sm:py-3"
        >
          <Link
            to="/"
            className="flex items-center gap-2 font-pixel text-[0.6rem] leading-relaxed text-accent-text no-underline sm:text-xs"
            data-testid="landing-logo"
          >
            <img
              src="/favicon.svg"
              alt=""
              width={28}
              height={28}
              className="[image-rendering:pixelated]"
            />
            <span className="hidden min-[400px]:inline">{SITE_NAME}</span>
          </Link>
          <span className="flex-1" />
          <a
            href="#how-to-play"
            className="hidden font-pixel text-[0.7rem] leading-relaxed text-muted no-underline hover:text-snow sm:inline"
            data-testid="landing-guide-link"
          >
            {l.guide}
          </a>
          <LanguageToggle className="hidden sm:inline-flex" />
          <ThemeToggle />
          <Link to="/play" className={pixelButtonCompactPrimary} data-testid="landing-header-cta">
            {l.playNow} <span aria-hidden="true">🎮</span>
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className={`${section} grid items-center gap-10 lg:grid-cols-2`}>
          <div className="flex flex-col items-start gap-5">
            <h1 className="font-pixel text-2xl leading-snug text-accent-text [text-shadow:3px_3px_0_#000] sm:text-4xl light:[text-shadow:none]">
              <span aria-hidden="true">🏁 </span>
              {SITE_NAME}
              <span className="mt-3 block font-body text-lg font-bold text-snow [text-shadow:none] sm:text-2xl">
                {l.heroSlogan}
              </span>
            </h1>
            <p className="text-base text-muted sm:text-lg">
              {l.heroIntro}
              <br />
              {l.heroIntro2}
            </p>
            <Link to="/play" className={bigCta} data-testid="landing-hero-cta">
              ▶ {l.heroCta}
            </Link>
            <LanguageToggle className="sm:hidden" />
          </div>
          <ScreenshotSlot src={SCREENSHOTS.hero} alt={l.shots.hero} eager testId="shot-hero" />
        </section>

        {/* Racing strip: four cars overtaking each other (decorative). */}
        <div
          aria-hidden="true"
          className="relative h-16 overflow-hidden border-y-4 border-black bg-[#3a3f4b]"
        >
          <div className="absolute inset-x-0 top-1/2 border-t-4 border-dashed border-white/40" />
          {CAR_COLORS.map((color, i) => (
            <span
              key={color}
              className="absolute h-3 w-10 border-2 border-black motion-safe:animate-drive"
              style={{
                top: `${8 + i * 12}px`,
                left: '-48px',
                backgroundColor: CAR_CSS[color],
                animationDuration: `${STRIP_DURATIONS[i]}s`,
              }}
            />
          ))}
        </div>

        {/* Why play */}
        <section className={section} aria-labelledby="why-title">
          <h2 id="why-title" className={sectionHeading}>
            <span aria-hidden="true">🎯 </span>
            {l.whyTitle}
          </h2>
          <ul className="mt-8 grid list-none gap-6 p-0 md:grid-cols-3">
            {l.features.map((feature) => (
              <li key={feature.title} className={`${pixelPanel} flex flex-col gap-3`}>
                <span
                  aria-hidden="true"
                  className="flex h-14 w-14 items-center justify-center border-4 border-black bg-ink text-2xl"
                >
                  {feature.icon}
                </span>
                <h3 className="font-pixel text-xs leading-relaxed text-snow">{feature.title}</h3>
                <p className="text-muted">{feature.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* How to play */}
        <section
          id="how-to-play"
          className="scroll-mt-20 border-y-4 border-black bg-panel"
          aria-labelledby="how-title"
        >
          <div className={section}>
            <h2 id="how-title" className={sectionHeading}>
              <span aria-hidden="true">🕹️ </span>
              {l.howTitle}
            </h2>
            <ol className="mt-8 grid list-none gap-6 p-0 md:grid-cols-3">
              {l.steps.map((step, i) => (
                <li
                  key={step.title}
                  className="flex flex-col gap-3 border-4 border-edge bg-ink p-4"
                >
                  <span className="self-start border-4 border-black bg-accent px-2 py-1 font-pixel text-[0.6rem] leading-relaxed text-on-accent">
                    {l.step(i + 1)}
                  </span>
                  <h3 className="font-pixel text-xs leading-relaxed text-snow">{step.title}</h3>
                  <p className="text-muted">{step.body}</p>
                  {i === 0 && (
                    <div aria-hidden="true" className="flex gap-2">
                      {CAR_COLORS.map((color) => (
                        <span
                          key={color}
                          className="h-6 w-6 border-4 border-black"
                          style={{ backgroundColor: CAR_CSS[color] }}
                        />
                      ))}
                    </div>
                  )}
                  {i === 1 && (
                    <div aria-hidden="true" className="flex gap-2">
                      {[0, 1, 2, 3, 4].map((n) => (
                        <span
                          key={n}
                          className="h-5 w-5 rounded-full border-4 border-black bg-car-red"
                        />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
            {authEnabled && (
              <p className="mt-6 text-center text-muted" data-testid="landing-score-note">
                {l.scoreNote}
              </p>
            )}
          </div>
        </section>

        {/* Screenshots */}
        <section className={section} aria-labelledby="gallery-title">
          <h2 id="gallery-title" className={sectionHeading}>
            <span aria-hidden="true">📸 </span>
            {l.galleryTitle}
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {GALLERY_SHOTS.map((key) => (
              <ScreenshotSlot
                key={key}
                src={SCREENSHOTS[key]}
                alt={l.shots[key]}
                testId={`shot-${key}`}
              />
            ))}
          </div>
        </section>

        {/* Final call to action */}
        <section className="border-t-4 border-black bg-panel">
          <div className={`${section} flex flex-col items-center gap-6 text-center`}>
            <h2 className={`${pixelHeading} mb-0`}>{l.finalTitle}</h2>
            <Link
              to="/play"
              className={`${pixelButtonPrimary} px-8! py-5! text-sm! sm:text-lg! motion-safe:animate-pulse`}
              data-testid="landing-final-cta"
            >
              ▶ {l.finalCta}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t-4 border-black bg-panel">
        <div className="mx-auto flex max-w-[1040px] flex-col gap-4 px-4 py-6 text-sm text-muted sm:px-6 md:flex-row md:items-center md:justify-between">
          <p className="m-0">
            © 2026 {SITE_NAME}. {l.footerRights} | {l.footerPowered}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <nav aria-label={l.socialLabel} className="flex gap-4">
              {SOCIAL_LINKS.map((link) => (
                <FooterAnchor key={link.label} href={link.href} className={footerLink}>
                  {link.label}
                </FooterAnchor>
              ))}
            </nav>
            <nav aria-label={l.legalLabel} className="flex gap-4">
              <FooterAnchor href={LEGAL_LINKS.terms} className={footerLink}>
                {l.terms}
              </FooterAnchor>
              <FooterAnchor href={LEGAL_LINKS.privacy} className={footerLink}>
                {l.privacy}
              </FooterAnchor>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterAnchor({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  return isExternal(href) ? (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

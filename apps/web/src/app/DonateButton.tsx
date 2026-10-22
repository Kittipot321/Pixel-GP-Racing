// Floating "Buy me a coffee" donate button.
//
// Pinned to the bottom-right corner of the viewport (position: fixed), so it
// stays visible while the page scrolls. It is rendered once next to the route
// table, outside every page, so it also stays mounted across route changes.
// z-40 keeps it above page content but below full-screen modals (z-50).
//
// The link target comes from VITE_BUY_ME_A_COFFEE_URL; set it in apps/web/.env.

import { useI18n } from '../i18n/i18n-context.tsx';

/** Fallback used when VITE_BUY_ME_A_COFFEE_URL is not set. Replace with your page. */
const DEFAULT_DONATE_URL = 'https://buymeacoffee.com/your-username';

export const donateUrl = import.meta.env.VITE_BUY_ME_A_COFFEE_URL?.trim() || DEFAULT_DONATE_URL;

export function DonateButton() {
  const { t } = useI18n();
  return (
    <a
      href={donateUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t.donate.ariaLabel}
      className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 border-4 border-black bg-accent px-2 py-2 sm:px-3 font-pixel text-[0.6rem] leading-relaxed text-on-accent no-underline shadow-[4px_4px_0_0_#000] transition-transform hover:brightness-110 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-snow active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_0_#000] sm:bottom-6 sm:right-6 sm:text-xs"
      data-testid="donate-button"
    >
      <span aria-hidden="true" className="text-base leading-none">
        ☕
      </span>
      <span className="hidden sm:inline">Buy me a coffee</span>
    </a>
  );
}

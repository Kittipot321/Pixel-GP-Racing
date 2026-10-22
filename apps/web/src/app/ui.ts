// Shared Tailwind class strings for the pixel theme.
//
// Pages compose these instead of repeating the same long utility lists, so the
// chunky borders, block shadows, and pixel font stay consistent everywhere.
// Tailwind scans this file, so every class here is generated at build time.
// Colors come from the theme tokens in index.css, so each string works in both
// the light and the dark theme.

/** Focus ring and press effect shared by every button variant. */
const pixelButtonInteraction =
  'inline-flex cursor-pointer items-center justify-center gap-2 font-pixel leading-relaxed transition-transform focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-accent active:translate-x-[2px] active:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-50';

/** Shape shared by every button variant (no colors, so variants never conflict). */
const pixelButtonBase = `${pixelButtonInteraction} border-4 px-4 py-2 text-xs shadow-[4px_4px_0_0_#000] active:shadow-[2px_2px_0_0_#000]`;

/** Smaller shape on phones, the normal one from the `sm` breakpoint up. */
const pixelButtonCompactBase = `${pixelButtonInteraction} border-2 px-2 py-1 text-[0.6rem] shadow-[2px_2px_0_0_#000] active:shadow-[1px_1px_0_0_#000] sm:border-4 sm:px-3 sm:py-2 sm:text-xs sm:shadow-[4px_4px_0_0_#000]`;

const neutralColors = 'border-edge bg-panel text-snow hover:bg-edge';
const primaryColors = 'border-black bg-accent text-on-accent hover:brightness-110';

/** Chunky pixel button with a block shadow that "presses" on click. */
export const pixelButton = `${pixelButtonBase} ${neutralColors}`;

/** Primary variant: accent fill for the main action on a screen. */
export const pixelButtonPrimary = `${pixelButtonBase} ${primaryColors}`;

/** Compact neutral button for tight spots (track controls, header). */
export const pixelButtonCompact = `${pixelButtonCompactBase} ${neutralColors}`;

/** Compact primary button. */
export const pixelButtonCompactPrimary = `${pixelButtonCompactBase} ${primaryColors}`;

/** Pixel frame without padding (wrap tables so rows run edge to edge). */
export const pixelFrame = 'border-4 border-edge bg-panel shadow-[6px_6px_0_0_#000]';

/** Framed panel used for forms and results. */
export const pixelPanel = `${pixelFrame} p-3 sm:p-4`;

/** Text input styled to match the pixel frame. */
export const pixelInput =
  'w-full border-4 border-edge bg-ink px-3 py-2 font-body text-base text-snow focus:border-accent focus:outline-none';

/** Page heading in the pixel font with a hard drop shadow. */
export const pixelHeading =
  'mb-4 font-pixel text-base leading-relaxed tracking-wide text-accent-text [text-shadow:2px_2px_0_#000] sm:text-xl sm:[text-shadow:3px_3px_0_#000] light:[text-shadow:none]';

/** Table cell (th or td). */
export const tableCell = 'border-b-2 border-edge px-2 py-2 text-left sm:px-3';

/** Scroll wrapper so wide tables scroll sideways on phones instead of the page. */
export const tableScroll = 'w-full overflow-x-auto';

/** Pixel-styled text link. */
export const pixelLink = 'font-bold text-accent-text underline underline-offset-4 hover:text-snow';

/** Inline error message. */
export const errorText = 'text-sm text-danger';

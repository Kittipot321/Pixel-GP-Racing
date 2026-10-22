// Accessible modal dialog in the pixel theme.
//
// Rendered through a portal (into document.body by default) with role="dialog",
// aria-modal="true", and aria-labelledby pointing at its title. While open,
// focus moves inside (to an element marked data-autofocus, else the first
// focusable one), Tab / Shift+Tab wrap around inside the dialog, and Esc or
// the close button call onClose. When it closes, focus returns to the element
// that had it when the dialog opened (the button that opened it), if that
// element is still on the page. `canClose={false}` holds the dialog open, for
// example while a request it started is still running.
//
// A component can provide a different host element through ModalHostContext
// (the game frame does this). A modal rendered under that provider mounts
// inside the host and covers only the host instead of the whole viewport. This
// keeps the dialog visible when the host itself is fullscreen, because the
// browser only paints the fullscreen element and its descendants.
// On phones (below the `sm` breakpoint) a 16:9 host is too short to hold a
// dialog, so the host is used only while it is fullscreen; otherwise the modal
// opens over the whole viewport as usual. `stayInHost` overrides that for a
// small dialog that must stay centered on the host on every screen size, and
// `compact` gives it the narrow, tight card that fits a phone-sized host.

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n/i18n-context.tsx';
import { pixelButton, pixelButtonCompact, pixelFrame, pixelPanel } from './ui.ts';
import { SM_UP, useMediaQuery } from './use-media-query.ts';

/**
 * Element that modals below this provider mount into. The element must be
 * positioned (e.g. `relative`) so the modal's backdrop can fill it. `null`
 * (the default) means document.body with a full-viewport backdrop.
 */
export const ModalHostContext = createContext<HTMLElement | null>(null);

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  /** When false, Esc and the close button do nothing. Defaults to true. */
  canClose?: boolean;
  /** Change this value to move focus back to the initial element (e.g. on a step change). */
  focusKey?: string | number;
  /** data-testid of the dialog; the close button gets `${testId}-close`. */
  testId?: string;
  /** Mount in the ModalHostContext host on every screen size (phones included). */
  stayInHost?: boolean;
  /** Narrow card with tight spacing, for short confirmations. */
  compact?: boolean;
  children: ReactNode;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** True while `el` is the fullscreen element. */
function useIsFullscreen(el: HTMLElement | null): boolean {
  const [isFullscreen, setIsFullscreen] = useState(
    () => el !== null && document.fullscreenElement === el,
  );
  useEffect(() => {
    if (!el) {
      return;
    }
    const update = () => setIsFullscreen(document.fullscreenElement === el);
    update();
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, [el]);
  return isFullscreen;
}

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getAttribute('aria-hidden') !== 'true',
  );
}

function focusInitial(dialog: HTMLElement): void {
  const preferred = dialog.querySelector<HTMLElement>('[data-autofocus]:not([disabled])');
  (preferred ?? focusableIn(dialog)[0] ?? dialog).focus();
}

/** Keep Tab / Shift+Tab inside the dialog. */
function trapTab(event: KeyboardEvent, dialog: HTMLElement): void {
  const items = focusableIn(dialog);
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (!first || !last) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  if (!dialog.contains(active)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && (active === first || active === dialog)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

export function Modal({
  open,
  title,
  onClose,
  canClose = true,
  focusKey,
  testId = 'modal',
  stayInHost = false,
  compact = false,
  children,
}: ModalProps) {
  const hostElement = useContext(ModalHostContext);
  const wideScreen = useMediaQuery(SM_UP);
  const hostFullscreen = useIsFullscreen(hostElement);
  const host = stayInHost || wideScreen || hostFullscreen ? hostElement : null;
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const canCloseRef = useRef(canClose);
  canCloseRef.current = canClose;

  // Remember the opener before focus moves in; give focus back on close.
  useEffect(() => {
    if (!open) {
      return;
    }
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (opener?.isConnected) {
        opener.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (open && dialogRef.current) {
      focusInitial(dialogRef.current);
    }
  }, [open, focusKey]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }
      if (event.key === 'Escape') {
        if (canCloseRef.current) {
          event.preventDefault();
          onCloseRef.current();
        }
      } else if (event.key === 'Tab') {
        trapTab(event, dialog);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) {
    return null;
  }

  // In a host: fill the host (above its own controls) and never grow past it.
  const backdropClass = host
    ? 'absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-2 sm:p-4'
    : 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4';
  const heightClass = host ? 'max-h-full' : 'max-h-[90dvh]';
  const cardClass = compact
    ? `${pixelFrame} max-w-sm gap-2 p-2 sm:gap-4 sm:p-4`
    : `${pixelPanel} max-w-xl gap-4`;

  return createPortal(
    <div className={backdropClass} data-testid={`${testId}-backdrop`}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`${cardClass} flex ${heightClass} w-full flex-col overflow-y-auto focus:outline-none`}
        data-testid={testId}
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id={titleId}
            className="font-pixel text-xs leading-relaxed text-accent-text sm:text-sm"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={() => canClose && onClose()}
            disabled={!canClose}
            className={compact ? pixelButtonCompact : pixelButton}
            aria-label={t.common.close}
            data-testid={`${testId}-close`}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        {children}
      </div>
    </div>,
    host ?? document.body,
  );
}

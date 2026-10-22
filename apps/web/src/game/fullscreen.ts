// Fullscreen helpers for the race track.
//
// Only the element passed in (the track frame, with its overlay buttons) goes
// fullscreen, not the whole page. Both the element and the document are
// injectable so jsdom tests can use fakes (jsdom has no Fullscreen API). When
// the browser lacks the API, isFullscreenSupported() is false and the UI hides
// its fullscreen button; request/exit failures are logged, never thrown.

import { useCallback, useEffect, useState, type RefObject } from 'react';

/** The element side of the Fullscreen API. */
export interface FullscreenTarget {
  requestFullscreen?: () => Promise<void>;
}

/** The document side of the Fullscreen API. */
export interface FullscreenDocument {
  readonly fullscreenElement: Element | null;
  readonly fullscreenEnabled?: boolean;
  exitFullscreen?: () => Promise<void>;
  addEventListener(type: 'fullscreenchange', listener: () => void): void;
  removeEventListener(type: 'fullscreenchange', listener: () => void): void;
}

function browserDocument(): FullscreenDocument | null {
  return typeof document === 'undefined' ? null : document;
}

/** True when `el` can be made fullscreen in this browser. */
export function isFullscreenSupported(
  el: FullscreenTarget | null | undefined,
  doc: FullscreenDocument | null = browserDocument(),
): boolean {
  if (!el || !doc || typeof el.requestFullscreen !== 'function') {
    return false;
  }
  return doc.fullscreenEnabled !== false;
}

/**
 * Enter fullscreen on `el`, or exit when something is already fullscreen.
 * Resolves either way; a refusal by the browser is logged.
 */
export async function toggleFullscreen(
  el: FullscreenTarget | null | undefined,
  doc: FullscreenDocument | null = browserDocument(),
): Promise<void> {
  if (!doc) {
    return;
  }
  try {
    if (doc.fullscreenElement) {
      await doc.exitFullscreen?.();
    } else if (el && typeof el.requestFullscreen === 'function') {
      await el.requestFullscreen();
    }
  } catch (err) {
    console.warn('Fullscreen: the browser refused the request', err);
  }
}

export interface FullscreenState {
  isSupported: boolean;
  isFullscreen: boolean;
  toggle: () => void;
}

/** React hook: fullscreen support/state for the element in `ref`. */
export function useFullscreen(
  ref: RefObject<HTMLElement | null>,
  doc: FullscreenDocument | null = browserDocument(),
): FullscreenState {
  const [isSupported, setIsSupported] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setIsSupported(isFullscreenSupported(ref.current, doc));
    if (!doc) {
      return;
    }
    const sync = () =>
      setIsFullscreen(doc.fullscreenElement !== null && doc.fullscreenElement === ref.current);
    sync();
    doc.addEventListener('fullscreenchange', sync);
    return () => doc.removeEventListener('fullscreenchange', sync);
  }, [ref, doc]);

  const toggle = useCallback(() => {
    void toggleFullscreen(ref.current, doc);
  }, [ref, doc]);

  return { isSupported, isFullscreen, toggle };
}

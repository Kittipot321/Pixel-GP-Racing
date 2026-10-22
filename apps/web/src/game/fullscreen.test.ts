// Fullscreen helper tests (FR2.2, FR2.4, NFR7) with a fake element and document.

import { describe, it, expect, vi } from 'vitest';
import {
  isFullscreenSupported,
  toggleFullscreen,
  type FullscreenDocument,
  type FullscreenTarget,
} from './fullscreen.ts';

function fakeDocument(fullscreenElement: Element | null = null) {
  const doc = {
    fullscreenElement,
    fullscreenEnabled: true,
    exitFullscreen: vi.fn(() => Promise.resolve()),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  return doc satisfies FullscreenDocument;
}

describe('fullscreen helpers', () => {
  it('is unsupported when the element has no requestFullscreen', () => {
    const doc = fakeDocument();
    expect(isFullscreenSupported({}, doc)).toBe(false);
    expect(isFullscreenSupported(null, doc)).toBe(false);
    expect(isFullscreenSupported({ requestFullscreen: () => Promise.resolve() }, doc)).toBe(true);
    expect(
      isFullscreenSupported(
        { requestFullscreen: () => Promise.resolve() },
        { ...doc, fullscreenEnabled: false },
      ),
    ).toBe(false);
  });

  it('requests fullscreen when not fullscreen, and exits when fullscreen', async () => {
    const el: FullscreenTarget = { requestFullscreen: vi.fn(() => Promise.resolve()) };

    const notFull = fakeDocument(null);
    await toggleFullscreen(el, notFull);
    expect(el.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(notFull.exitFullscreen).not.toHaveBeenCalled();

    const full = fakeDocument(document.createElement('div'));
    await toggleFullscreen(el, full);
    expect(full.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(el.requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('logs and resolves when the browser refuses', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el: FullscreenTarget = {
      requestFullscreen: () => Promise.reject(new Error('not allowed')),
    };

    await expect(toggleFullscreen(el, fakeDocument())).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

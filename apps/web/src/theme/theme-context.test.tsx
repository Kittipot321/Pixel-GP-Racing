// Theme context tests: the first visit follows the system setting, a saved
// choice wins over it, toggling saves the choice and updates <html data-theme>,
// and broken storage or matchMedia falls back to dark without throwing.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { THEME_STORAGE_KEY, ThemeProvider, readTheme, useTheme } from './theme-context.tsx';

function mockSystemLight(isLight: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: isLight && query.includes('light'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

function Probe() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme} data-testid="probe">
      {theme}
    </button>
  );
}

describe('theme context', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
    vi.restoreAllMocks();
  });

  it('defaults to dark without a saved choice or matchMedia (jsdom)', () => {
    expect(readTheme()).toBe('dark');
  });

  it('follows the system setting on the first visit', () => {
    mockSystemLight(true);
    expect(readTheme()).toBe('light');
    mockSystemLight(false);
    expect(readTheme()).toBe('dark');
  });

  it('prefers the saved choice over the system setting', () => {
    mockSystemLight(true);
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(readTheme()).toBe('dark');
  });

  it('ignores an unknown saved value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    expect(readTheme()).toBe('dark');
  });

  it('toggles, saves the choice, and mirrors it to <html data-theme>', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull(); // nothing written until a switch

    act(() => screen.getByTestId('probe').click());
    expect(screen.getByTestId('probe')).toHaveTextContent('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('falls back to dark when storage throws, and still switches', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('dark');
    act(() => screen.getByTestId('probe').click());
    expect(screen.getByTestId('probe')).toHaveTextContent('light');
  });

  it('gives dark outside a provider', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('dark');
  });
});

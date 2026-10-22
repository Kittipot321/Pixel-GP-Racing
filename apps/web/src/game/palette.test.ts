// Race palette tests: both themes define every color, the dark theme keeps the
// original night colors, and unknown theme values fall back to dark.

import { describe, it, expect } from 'vitest';
import { RACE_PALETTES, RACE_THEMES, themedTexture, toRaceTheme } from './palette.ts';

describe('race palette', () => {
  it('defines the same color keys for every theme', () => {
    const keys = Object.keys(RACE_PALETTES.dark).sort();
    for (const theme of RACE_THEMES) {
      expect(Object.keys(RACE_PALETTES[theme]).sort()).toEqual(keys);
      for (const color of Object.values(RACE_PALETTES[theme])) {
        expect(color).toBeGreaterThanOrEqual(0);
        expect(color).toBeLessThanOrEqual(0xffffff);
      }
    }
  });

  it('keeps the original night colors for the dark theme', () => {
    expect(RACE_PALETTES.dark.standFill).toBe(0x1b1f2a);
    expect(RACE_PALETTES.dark.asphalt).toBe(0x3a3a46);
    expect(RACE_PALETTES.dark.grass).toBe(0x2f6b2f);
  });

  it('builds per-theme texture keys and narrows unknown themes to dark', () => {
    expect(themedTexture('asphalt', 'light')).toBe('asphalt-light');
    expect(toRaceTheme('light')).toBe('light');
    expect(toRaceTheme('dark')).toBe('dark');
    expect(toRaceTheme(undefined)).toBe('dark');
    expect(toRaceTheme('neon')).toBe('dark');
  });
});

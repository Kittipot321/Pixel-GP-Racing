// Race track colors per site theme.
//
// Dark is the original night look; light is a daytime track. Only the scenery
// changes: cars, kerbs, the checkered line, and the start lights keep their
// colors so the race reads the same in both themes. BootScene bakes one copy
// of each themed texture per theme (see themedTexture), and RaceScene swaps
// textures and redraws its scenery when the theme changes mid-game.

export const RACE_THEMES = ['dark', 'light'] as const;
export type RaceTheme = (typeof RACE_THEMES)[number];

export interface RacePalette {
  /** Camera background, behind everything. */
  background: number;
  standFill: number;
  standRoof: number;
  crowdBack: number;
  asphalt: number;
  asphaltSpeck: number;
  grass: number;
  grassBlade: number;
  flagPole: number;
  gantry: number;
  gantryStroke: number;
}

export const RACE_PALETTES: Record<RaceTheme, RacePalette> = {
  dark: {
    background: 0x000000,
    standFill: 0x1b1f2a,
    standRoof: 0x8a8f9c,
    crowdBack: 0x2a2f3d,
    asphalt: 0x3a3a46,
    asphaltSpeck: 0x4a4a5a,
    grass: 0x2f6b2f,
    grassBlade: 0x3a7d3a,
    flagPole: 0xd9d9d9,
    gantry: 0x0b0b0f,
    gantryStroke: 0x555b6b,
  },
  light: {
    background: 0x9fd3f0,
    standFill: 0x8fb8d8,
    standRoof: 0xe8ecf2,
    crowdBack: 0xc7d3e0,
    asphalt: 0x6b6b78,
    asphaltSpeck: 0x7d7d8c,
    grass: 0x4caf50,
    grassBlade: 0x66c26a,
    flagPole: 0x5a5f6b,
    gantry: 0x1b1f2a,
    gantryStroke: 0x8a8f9c,
  },
};

/** Narrow any value to a race theme, defaulting to dark. */
export function toRaceTheme(value: unknown): RaceTheme {
  return value === 'light' ? 'light' : 'dark';
}

/** Texture key for one theme's copy of a themed texture. */
export function themedTexture(key: string, theme: RaceTheme): string {
  return `${key}-${theme}`;
}

/** Game-registry key holding the current theme (set by the React wrapper). */
export const THEME_KEY = 'theme';

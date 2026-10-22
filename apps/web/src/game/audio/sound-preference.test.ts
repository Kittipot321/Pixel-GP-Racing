// Sound preference tests (FR1.5, NFR4): default on, the saved choice round-trips,
// and a throwing storage falls back to the default without throwing.

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  SOUND_STORAGE_KEY,
  readSoundEnabled,
  writeSoundEnabled,
  type PreferenceStorage,
} from './sound-preference.ts';

function memoryStorage(): PreferenceStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('sound preference', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('defaults to sound on when nothing is saved', () => {
    expect(readSoundEnabled(memoryStorage())).toBe(true);
    expect(readSoundEnabled(null)).toBe(true);
  });

  it('reads back a saved "off" and then "on"', () => {
    const storage = memoryStorage();

    writeSoundEnabled(false, storage);
    expect(storage.data.get(SOUND_STORAGE_KEY)).toBe('off');
    expect(readSoundEnabled(storage)).toBe(false);

    writeSoundEnabled(true, storage);
    expect(readSoundEnabled(storage)).toBe(true);
  });

  it('uses window.localStorage by default', () => {
    writeSoundEnabled(false);
    expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe('off');
    expect(readSoundEnabled()).toBe(false);
  });

  it('falls back to sound on and does not throw when storage throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broken: PreferenceStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };

    expect(() => writeSoundEnabled(false, broken)).not.toThrow();
    expect(readSoundEnabled(broken)).toBe(true);
    // Failures are logged, not swallowed silently.
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

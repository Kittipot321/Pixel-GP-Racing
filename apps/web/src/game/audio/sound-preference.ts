// Sound on/off preference, remembered in the browser.
//
// The default is sound ON. The choice lives in localStorage under one key and
// is only written when the player presses the sound button, so simply visiting
// the page never touches storage. Storage can be missing or throw (private
// browsing in some browsers); every access is guarded, the failure is logged,
// and reads fall back to the default so the game keeps working.

export const SOUND_STORAGE_KEY = 'pixel-race.sound';

const SOUND_ON = 'on';
const SOUND_OFF = 'off';

/** The slice of the Web Storage API this module needs (injectable for tests). */
export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Resolve window.localStorage; even reading the property can throw. */
function defaultStorage(): PreferenceStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch (err) {
    console.warn('Sound preference: localStorage is unavailable', err);
    return null;
  }
}

/** Read the saved preference. Returns true (sound on) when nothing usable is saved. */
export function readSoundEnabled(storage: PreferenceStorage | null = defaultStorage()): boolean {
  if (!storage) {
    return true;
  }
  try {
    return storage.getItem(SOUND_STORAGE_KEY) !== SOUND_OFF;
  } catch (err) {
    console.warn('Sound preference: could not read the saved value', err);
    return true;
  }
}

/** Save the preference. A failing storage is logged and otherwise ignored. */
export function writeSoundEnabled(
  enabled: boolean,
  storage: PreferenceStorage | null = defaultStorage(),
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(SOUND_STORAGE_KEY, enabled ? SOUND_ON : SOUND_OFF);
  } catch (err) {
    console.warn('Sound preference: could not save the value', err);
  }
}

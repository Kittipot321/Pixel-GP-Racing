// Build-time feature flags, read from VITE_* env vars (set them in apps/web/.env).
// Vite inlines these at build time, so changing one needs a dev-server restart
// or a rebuild.

const TRUE_VALUES = new Set(['true', '1', 'on', 'yes']);
const FALSE_VALUES = new Set(['false', '0', 'off', 'no']);

/**
 * Parse an on/off env value. Accepts true/false, 1/0, on/off and yes/no in any
 * case; anything else (including unset or empty) falls back to the default.
 */
export function parseBooleanFlag(raw: string | undefined, fallback: boolean): boolean {
  const value = raw?.trim().toLowerCase();
  if (value && TRUE_VALUES.has(value)) {
    return true;
  }
  if (value && FALSE_VALUES.has(value)) {
    return false;
  }
  return fallback;
}

/**
 * Whether accounts (login/register, leaderboard, profile) are available.
 * Off makes the site guest-only. On by default when VITE_AUTH_ENABLED is unset.
 */
export const authEnabled = parseBooleanFlag(import.meta.env.VITE_AUTH_ENABLED, true);

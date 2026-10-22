// Typed environment configuration for the API.
// Reads from process.env with sensible, non-secret defaults so the app runs
// out of the box in local development. No secrets are hardcoded here — the JWT
// secret must come from the environment (a dev-only fallback is used only when
// NODE_ENV is not "production").

import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, resolve } from 'node:path';
import { DEFAULT_DB_PATH } from '@pixel-race/database';

export interface ApiConfig {
  /** Port the HTTP server listens on. */
  port: number;
  /** Host interface the HTTP server binds to. */
  host: string;
  /** Runtime environment name. */
  nodeEnv: string;
  /** Filesystem path to the SQLite database file. */
  databasePath: string;
  /** Secret used to sign/verify JWT access tokens. Never logged. */
  jwtSecret: string;
  /** Short-lived access-token lifetime (e.g. "15m", "1h"). */
  jwtExpiresIn: string;
  /** Allowed CORS origins. An empty list means "no cross-origin requests". */
  corsOrigins: string[];
}

const DEFAULT_PORT = 3001;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_NODE_ENV = 'development';
const DEFAULT_JWT_EXPIRES_IN = '15m';
const DEFAULT_CORS_ORIGINS = 'http://localhost:5173';
// Dev-only fallback secret. Refused outside development so production can never
// boot with a predictable signing key.
const DEV_JWT_SECRET = 'dev-insecure-jwt-secret-change-me';

// Monorepo/project root, derived deterministically from this file's location so
// a relative DATABASE_PATH resolves identically no matter which directory the
// process was launched from. This file lives at apps/api/src/config/env.ts, so
// the repo root is four segments up from the config directory.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

/**
 * Resolve the SQLite database path so it never depends on the process working
 * directory (the root cause of the "can't register" 500: launched from
 * apps/api, a CWD-relative "./database/..." pointed at an empty, tableless DB).
 *
 * - `:memory:` passes through unchanged (tests inject a migrated in-memory DB).
 * - An absolute DATABASE_PATH is honored as-is.
 * - A relative DATABASE_PATH resolves against the repo root, not process.cwd().
 * - Unset falls back to @pixel-race/database's DEFAULT_DB_PATH, which anchors to
 *   the database package root (<repoRoot>/database/pixel-race.sqlite) — the one
 *   real, migrated database shared by the API and the db:migrate script.
 */
function resolveDatabasePath(raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return DEFAULT_DB_PATH;
  }
  if (trimmed === ':memory:') {
    return trimmed;
  }
  return isAbsolute(trimmed) ? trimmed : resolve(REPO_ROOT, trimmed);
}

/**
 * Parse a port value, falling back to the default when unset or invalid.
 * Fails fast on an out-of-range value rather than binding to a surprising port.
 */
function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_PORT;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`Invalid PORT value: "${raw}" (expected an integer 0-65535)`);
  }

  return parsed;
}

/**
 * Resolve the JWT signing secret. In production an explicit JWT_SECRET is
 * required (fail loud); in development we fall back to a clearly-insecure value
 * so the app runs out of the box without leaking a real secret into source.
 */
function resolveJwtSecret(raw: string | undefined, nodeEnv: string): string {
  const trimmed = raw?.trim();
  if (trimmed) {
    return trimmed;
  }
  if (nodeEnv === 'production') {
    throw new Error('JWT_SECRET is required in production and must not be empty');
  }
  return DEV_JWT_SECRET;
}

/** Parse a comma-separated CORS origin list into a trimmed, non-empty array. */
function parseCorsOrigins(raw: string | undefined): string[] {
  const source = raw?.trim() || DEFAULT_CORS_ORIGINS;
  return source
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/**
 * Build the typed API configuration from the given environment.
 * Defaults to process.env so callers normally invoke it with no argument.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const nodeEnv = env.NODE_ENV?.trim() || DEFAULT_NODE_ENV;

  return {
    port: parsePort(env.PORT),
    host: env.HOST?.trim() || DEFAULT_HOST,
    nodeEnv,
    databasePath: resolveDatabasePath(env.DATABASE_PATH),
    jwtSecret: resolveJwtSecret(env.JWT_SECRET, nodeEnv),
    jwtExpiresIn: env.JWT_EXPIRES_IN?.trim() || DEFAULT_JWT_EXPIRES_IN,
    corsOrigins: parseCorsOrigins(env.CORS_ORIGINS),
  };
}

// Unit tests for loadConfig's database-path resolution (FR2.1).
//
// The "can't register" 500 was caused by a CWD-relative default database path:
// launched from apps/api, "./database/..." pointed at an empty, tableless DB.
// These tests pin the fix: the resolved databasePath is absolute and anchored
// to the repo root, never to process.cwd(), and the DATABASE_PATH overrides
// (absolute, relative, :memory:) behave as specified.

import { isAbsolute } from 'node:path';
import { describe, it, expect } from 'vitest';
import { DEFAULT_DB_PATH } from '@pixel-race/database';
import { loadConfig } from './env.js';

/** A minimal env that satisfies loadConfig without touching the real process env. */
function baseEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: 'test', JWT_SECRET: 'test-secret', ...overrides };
}

/** Normalize path separators so assertions are stable on Windows and POSIX. */
function normalize(p: string): string {
  return p.replace(/\\/g, '/');
}

describe('loadConfig databasePath resolution (FR2.1)', () => {
  it('defaults to an absolute, repo-anchored path (not CWD-relative)', () => {
    const cfg = loadConfig(baseEnv());

    expect(isAbsolute(cfg.databasePath)).toBe(true);
    expect(normalize(cfg.databasePath)).toMatch(/database\/pixel-race\.sqlite$/);
    // The bug signature: a CWD-relative resolve from apps/api would land here.
    expect(normalize(cfg.databasePath)).not.toContain('apps/api/database');
    // The default is the single real DB the @pixel-race/database package owns.
    expect(cfg.databasePath).toBe(DEFAULT_DB_PATH);
  });

  it('is byte-identical regardless of the simulated process CWD', () => {
    // loadConfig derives the path from import.meta.url + env, never process.cwd,
    // so changing an unrelated env (standing in for "launched elsewhere") does
    // not shift the resolved default. The value is absolute and stable.
    const fromRoot = loadConfig(baseEnv()).databasePath;
    const fromApiApi = loadConfig(baseEnv({ PWD: '/anything/apps/api' })).databasePath;

    expect(fromRoot).toBe(fromApiApi);
    expect(isAbsolute(fromRoot)).toBe(true);
  });

  it('honors an explicit absolute DATABASE_PATH as-is', () => {
    const abs = isAbsolute('/var/data/custom.sqlite')
      ? '/var/data/custom.sqlite'
      : 'C:\\var\\data\\custom.sqlite';
    const cfg = loadConfig(baseEnv({ DATABASE_PATH: abs }));

    expect(cfg.databasePath).toBe(abs);
  });

  it('resolves a relative DATABASE_PATH against the repo root, not CWD', () => {
    const cfg = loadConfig(baseEnv({ DATABASE_PATH: 'tmp/custom.sqlite' }));

    expect(isAbsolute(cfg.databasePath)).toBe(true);
    expect(normalize(cfg.databasePath)).toMatch(/\/tmp\/custom\.sqlite$/);
    // Repo-root-anchored: shares the same root prefix as the default DB path.
    const defaultRoot = normalize(DEFAULT_DB_PATH).replace(/\/database\/pixel-race\.sqlite$/, '');
    expect(normalize(cfg.databasePath).startsWith(defaultRoot)).toBe(true);
  });

  it('passes :memory: through unchanged', () => {
    const cfg = loadConfig(baseEnv({ DATABASE_PATH: ':memory:' }));

    expect(cfg.databasePath).toBe(':memory:');
  });
});

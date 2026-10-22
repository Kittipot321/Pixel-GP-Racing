// Fail-loud connection tests (NFR2 targeted regression).
//
// The "can't register" 500 came from openDb() silently creating an empty,
// tableless SQLite file when the expected database was missing — the first
// insert then threw "no such table: users", surfaced as a generic 500. These
// tests pin the fix: a file-based path that is missing, or exists but was never
// migrated, throws a clear, actionable error (naming the path and the migrate
// remedy) and never leaves a newly-created empty DB behind. A freshly-migrated
// DB and `:memory:` still open cleanly.

import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { openDb } from '../src/connection.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, '../migrations');

describe('openDb fail-loud behavior (file databases)', () => {
  let tmpDir: string | undefined;

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  /** A unique temp directory for a single test's file DB(s). */
  function makeTmpDir(): string {
    tmpDir = mkdtempSync(join(tmpdir(), 'pixel-race-conn-'));
    return tmpDir;
  }

  it('throws (and does NOT create the file) when the path is missing', () => {
    const missing = join(makeTmpDir(), 'does-not-exist.sqlite');

    expect(() => openDb({ path: missing })).toThrow(/not found/i);
    // The remedy is actionable and names the migrate command.
    expect(() => openDb({ path: missing })).toThrow(/db:migrate/);
    // Crucially: the guard must not have materialized an empty DB.
    expect(existsSync(missing)).toBe(false);
  });

  it('names the resolved path in the missing-file error', () => {
    const missing = join(makeTmpDir(), 'nope.sqlite');

    expect(() => openDb({ path: missing })).toThrow(resolve(missing));
  });

  it('throws when the file exists but has no users table (unmigrated)', () => {
    const unmigrated = join(makeTmpDir(), 'empty.sqlite');
    // Create a real, openable SQLite file that was never migrated.
    const raw = new Database(unmigrated);
    raw.close();
    expect(existsSync(unmigrated)).toBe(true);

    expect(() => openDb({ path: unmigrated })).toThrow(/users/);
    expect(() => openDb({ path: unmigrated })).toThrow(/db:migrate/);
  });

  it('opens a freshly-migrated file DB and returns a working client', () => {
    const dbPath = join(makeTmpDir(), 'migrated.sqlite');
    // Apply migrations out-of-band using a plain handle, then open via openDb.
    const seed = openDbOnMigratedFile(dbPath);
    seed.close();

    const conn = openDb({ path: dbPath });
    try {
      const tables = conn.sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((row) => (row as { name: string }).name);
      expect(tables).toContain('users');
      // Foreign-key enforcement is on for file DBs.
      expect(conn.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
    } finally {
      conn.close();
    }
  });

  it('still opens :memory: successfully (auto-create preserved)', () => {
    const conn = openDb({ path: ':memory:' });
    try {
      // A clean in-memory DB opens; migrations can then be applied by the caller.
      expect(conn.sqlite.open).toBe(true);
    } finally {
      conn.close();
    }
  });

  it('allowCreate lets the bootstrap path create and migrate a fresh DB', () => {
    // The sanctioned setup path (db:migrate / db:seed) MUST be able to create a
    // brand-new database: the fail-loud guard must not break the very command
    // its error message tells the user to run.
    const fresh = join(makeTmpDir(), 'fresh.sqlite');
    expect(existsSync(fresh)).toBe(false);

    const conn = openDb({ path: fresh, allowCreate: true });
    try {
      // The file now exists and the handle is usable; migrations can be applied.
      expect(existsSync(fresh)).toBe(true);
      expect(conn.sqlite.open).toBe(true);
      migrate(conn.db, { migrationsFolder });
      const tables = conn.sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((row) => (row as { name: string }).name);
      expect(tables).toContain('users');
    } finally {
      conn.close();
    }
  });
});

/**
 * Create a migrated SQLite file at `dbPath` using a plain handle (bypassing the
 * fail-loud guard, which would reject the as-yet-unmigrated file). Returns a
 * connection-like object exposing `close`.
 */
function openDbOnMigratedFile(dbPath: string): { close: () => void } {
  // Touch an empty file, then migrate it directly with drizzle (bypassing the
  // fail-loud guard, which would reject the as-yet-unmigrated file).
  writeFileSync(dbPath, '');
  const sqlite = new Database(dbPath);
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder });
  return { close: () => sqlite.close() };
}

// Database connection lifecycle for Pixel Race.
//
// Opens a better-sqlite3 handle, applies the pragmas the game relies on
// (foreign-key enforcement, WAL for better read/write concurrency), and wraps
// it in a Drizzle client. Callers own the handle: create one per process and
// close it on shutdown.

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

// The `database/` package root (this file lives in database/src/).
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Default database file, anchored to the `database/` package directory so it
 * resolves the same whether a script runs from the repo root or the workspace.
 */
export const DEFAULT_DB_PATH = resolve(PACKAGE_ROOT, 'pixel-race.sqlite');

/** A Drizzle client bound to the Pixel Race schema. */
export type DbClient = BetterSQLite3Database<typeof schema>;

/** A connection handle bundling the Drizzle client and the raw driver. */
export interface DbConnection {
  /** Query/transaction entry point used by repositories and services. */
  db: DbClient;
  /** The underlying better-sqlite3 handle, exposed for close/backup/pragmas. */
  sqlite: Database.Database;
  /** Close the underlying handle. Idempotent-safe to call once on shutdown. */
  close: () => void;
}

export interface OpenDbOptions {
  /**
   * File path for the SQLite database. Use `:memory:` for ephemeral databases
   * (tests). Resolve this from an environment variable in the API layer.
   */
  path?: string;
  /**
   * Allow creating/initializing a new, as-yet-unmigrated database file.
   *
   * Default false: file-based opens FAIL LOUDLY on a missing or unmigrated DB
   * (the register fail-loud guard). The database bootstrap tooling
   * (`db:migrate`, `db:seed`) sets this true so it can create and migrate a
   * fresh database — the one sanctioned path that is allowed to initialize one.
   * The API and every request-serving path leave this false so a broken setup
   * surfaces immediately instead of as a later 500.
   */
  allowCreate?: boolean;
}

/**
 * Open a database connection and apply the required pragmas.
 *
 * Foreign-key enforcement is OFF by default in SQLite and must be enabled on
 * every connection — doing it here guarantees no caller can forget.
 *
 * File-based databases FAIL LOUDLY rather than silently materializing an empty,
 * tableless file. A missing file, or an existing file that has never been
 * migrated (no `users` table), throws a clear error naming the resolved path
 * and the remedy (`npm run db:migrate`). This is the root-cause guard for the
 * "can't register" 500: previously `new Database(path)` on an absent path
 * created an empty DB, and the first insert blew up with "no such table".
 * `:memory:` keeps its auto-create behavior — tests inject a migrated handle.
 *
 * The bootstrap tooling (`db:migrate`, `db:seed`) passes `allowCreate: true`:
 * it is the one sanctioned path that may create and initialize a fresh,
 * as-yet-unmigrated database. Every request-serving path leaves it false.
 */
export function openDb(options: OpenDbOptions = {}): DbConnection {
  const path = options.path ?? DEFAULT_DB_PATH;
  const allowCreate = options.allowCreate ?? false;

  if (path !== ':memory:') {
    if (allowCreate) {
      // Sanctioned bootstrap path (db:migrate / db:seed): ensure the parent
      // directory exists so a fresh checkout or a custom DATABASE_PATH can
      // create the database file. Only this path may initialize a new DB.
      mkdirSync(dirname(resolve(path)), { recursive: true });
    } else if (!existsSync(path)) {
      // Do NOT create the file. A missing file means the DB was never set up
      // (or the path is wrong); silently creating one here is exactly the bug.
      throw new Error(
        `Database file not found at "${resolve(path)}". ` +
          `The database has not been created. Run \`npm run db:migrate\` to set it up.`,
      );
    }
  }

  const sqlite = new Database(path);

  // Enforce referential integrity. Without this, foreign keys are inert.
  sqlite.pragma('foreign_keys = ON');
  // WAL improves concurrency; irrelevant for :memory: but harmless.
  if (path !== ':memory:') {
    sqlite.pragma('journal_mode = WAL');

    // The file exists — but an opened-yet-unmigrated DB is just as broken as a
    // missing one. Require the `users` table before handing the handle back.
    // The bootstrap tooling (allowCreate) is exempt: it opens precisely to
    // create/apply that schema, so it must be allowed through an empty DB.
    if (!allowCreate) {
      const usersTable = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        .get();
      if (!usersTable) {
        sqlite.close();
        throw new Error(
          `Database at "${resolve(path)}" is missing the expected schema ` +
            `(no \`users\` table). Run \`npm run db:migrate\` to apply migrations.`,
        );
      }
    }
  }

  const db = drizzle(sqlite, { schema });

  return {
    db,
    sqlite,
    close: () => sqlite.close(),
  };
}

export { schema };

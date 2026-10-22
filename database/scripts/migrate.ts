// Apply all pending Drizzle migrations to the database.
//
// Usage:
//   npm run db:migrate            # uses DATABASE_PATH or the default path
//   DATABASE_PATH=./x.sqlite npm run db:migrate
//
// Safe to run repeatedly: Drizzle tracks applied migrations and skips them.

import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, resolve } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { openDb, DEFAULT_DB_PATH } from '../src/connection.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, '../migrations');
// Repo root, two segments up from database/scripts/. A relative DATABASE_PATH
// must resolve the SAME way the API resolves it (apps/api/src/config/env.ts),
// never against process.cwd() — otherwise migrations land in one file and the
// API reads another, re-triggering the "no users table" error this fix removes.
const REPO_ROOT = resolve(here, '../..');

/** Resolve DATABASE_PATH consistently with the API: repo-root-anchored. */
function resolveDbPath(): string {
  const raw = process.env.DATABASE_PATH?.trim();
  if (!raw) {
    return DEFAULT_DB_PATH;
  }
  if (raw === ':memory:' || isAbsolute(raw)) {
    return raw;
  }
  return resolve(REPO_ROOT, raw);
}

function run(): void {
  const path = resolveDbPath();
  // allowCreate: this is the sanctioned bootstrap path — it may create and
  // initialize a fresh, as-yet-unmigrated database.
  const { db, close } = openDb({ path, allowCreate: true });

  try {
    migrate(db, { migrationsFolder });
    console.log(`Migrations applied to ${path}`);
  } finally {
    close();
  }
}

run();

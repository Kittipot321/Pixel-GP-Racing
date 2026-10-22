// Shared test harness for API integration tests.
//
// Builds a fully-wired app backed by a fresh in-memory SQLite database (real
// migrations applied), so inject() tests exercise the real routes, plugins,
// services, and schema — not stubs. The injected connection is owned by the
// test, which closes it in teardown.

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { openDb, type DbConnection } from '@pixel-race/database';
import type { ApiConfig } from '../config/env.js';

// database/ package root, relative to this file (apps/api/src/test-support/).
const MIGRATIONS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../database/migrations',
);

/** A config suitable for tests: in-memory DB, fixed test secret, open CORS. */
export function makeTestConfig(): ApiConfig {
  return {
    port: 0,
    host: '127.0.0.1',
    nodeEnv: 'test',
    databasePath: ':memory:',
    jwtSecret: 'test-only-jwt-secret',
    jwtExpiresIn: '15m',
    corsOrigins: ['http://localhost:5173'],
  };
}

/** A fresh in-memory DB connection with all migrations applied. */
export function makeTestDb(): DbConnection {
  const connection = openDb({ path: ':memory:' });
  migrate(connection.db, { migrationsFolder: MIGRATIONS });
  return connection;
}

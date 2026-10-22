// Database access for the API layer.
//
// Opens a single DbConnection from the @pixel-race/database package using the
// API's configured database path and exposes it as a Fastify decorator. The
// connection is created once at startup and closed on shutdown — repositories
// and services receive the Drizzle client, never a raw path.

import { openDb, type DbConnection } from '@pixel-race/database';
import type { ApiConfig } from '../config/env.js';

/**
 * Open the API's database connection. For file-based paths this creates the
 * parent directory and enables foreign-key enforcement + WAL (handled by
 * openDb). Callers own the handle and must close it on shutdown.
 */
export function openApiDb(config: Pick<ApiConfig, 'databasePath'>): DbConnection {
  return openDb({ path: config.databasePath });
}

/** The Drizzle client type, re-exported for repository signatures. */
export type { DbClient, DbConnection } from '@pixel-race/database';

// Data access for users.
//
// Thin wrapper over Drizzle: no business logic, no hashing, no HTTP. The
// service layer owns normalization and password hashing; this module only
// reads and writes rows.

import { eq, or } from 'drizzle-orm';
import { users, type UserRow } from '@pixel-race/database';
import type { DbClient } from '../../shared/db.js';

/** Fields required to create a user. The hash is produced by the service. */
export interface NewUserInput {
  id: string;
  username: string;
  /** Already normalized (lowercased) by the caller. */
  email: string;
  passwordHash: string;
}

/** Insert a new user row. Unique constraints surface as a thrown SQLite error. */
export function insertUser(db: DbClient, input: NewUserInput): UserRow {
  const [row] = db.insert(users).values(input).returning().all();
  return row;
}

/** Look up a user by id. Returns undefined when no row matches. */
export function findUserById(db: DbClient, id: string): UserRow | undefined {
  return db.select().from(users).where(eq(users.id, id)).get();
}

/**
 * Look up a user by username OR normalized email in a single query — used by
 * login, which accepts either in one identifier field.
 */
export function findUserByUsernameOrEmail(
  db: DbClient,
  identifier: string,
): UserRow | undefined {
  const normalized = identifier.trim();
  const lowered = normalized.toLowerCase();
  return db
    .select()
    .from(users)
    .where(or(eq(users.username, normalized), eq(users.email, lowered)))
    .get();
}

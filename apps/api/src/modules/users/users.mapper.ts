// Mapping from the persisted user row to the safe public User shape.
//
// This is the single chokepoint that guarantees the password hash never leaves
// the server: the public `User` type has no hash field, and this mapper is the
// only sanctioned way to turn a row into that shape.

import type { UserRow } from '@pixel-race/database';
import type { User } from '@pixel-race/shared-types';

/** Project a persisted user row to the safe public shape (no password hash). */
export function toPublicUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

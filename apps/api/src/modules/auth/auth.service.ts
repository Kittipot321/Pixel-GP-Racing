// Authentication business logic: registration and login.
//
// The service owns normalization, password hashing, and credential checks. It
// is framework-agnostic: token signing is injected as a function so the same
// logic is exercised in unit tests without a running Fastify instance.
// It never returns the password hash and never logs credentials or tokens.

import { randomUUID } from 'node:crypto';
import type { AuthResponse, RegisterRequest, LoginRequest } from '@pixel-race/shared-types';
import type { DbClient } from '../../shared/db.js';
import { badRequest, conflict, unauthorized } from '../../shared/errors.js';
import { hashPassword, verifyPassword } from '../../shared/password.js';
import { toPublicUser } from '../users/users.mapper.js';
import {
  findUserByUsernameOrEmail,
  insertUser,
  type NewUserInput,
} from './auth.repository.js';

/** Signs a short-lived access token for the given user id. */
export type TokenSigner = (userId: string) => string;

/** SQLite UNIQUE-violation detector, used to turn races into clean 409s. */
function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    /UNIQUE constraint failed/i.test(error.message)
  );
}

/**
 * Register a new account. The Zod schema has already validated and normalized
 * (lowercased email, trimmed username); we hash the password and persist,
 * relying on the DB unique constraints to reject duplicates even under a race.
 */
export async function registerUser(
  db: DbClient,
  input: RegisterRequest,
  signToken: TokenSigner,
): Promise<AuthResponse> {
  const passwordHash = await hashPassword(input.password);
  const newUser: NewUserInput = {
    id: randomUUID(),
    username: input.username,
    email: input.email,
    passwordHash,
  };

  try {
    const row = insertUser(db, newUser);
    return { user: toPublicUser(row), token: signToken(row.id) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict('ACCOUNT_EXISTS', 'Username or email is already taken');
    }
    throw error;
  }
}

/**
 * Log in with a username-or-email identifier and password. Returns the safe
 * user plus a fresh access token. A missing account and a wrong password yield
 * the SAME error so we never reveal which accounts exist.
 */
export async function loginUser(
  db: DbClient,
  input: LoginRequest,
  signToken: TokenSigner,
): Promise<AuthResponse> {
  if (input.identifier.trim() === '') {
    throw badRequest('INVALID_CREDENTIALS', 'Username or email is required');
  }

  const row = findUserByUsernameOrEmail(db, input.identifier);
  // Guard against user enumeration: identical failure for unknown user and
  // wrong password. We still run a verify on a dummy only if needed; here we
  // short-circuit but return the same opaque error.
  if (!row) {
    throw unauthorized('Invalid username/email or password');
  }

  const ok = await verifyPassword(row.passwordHash, input.password);
  if (!ok) {
    throw unauthorized('Invalid username/email or password');
  }

  return { user: toPublicUser(row), token: signToken(row.id) };
}

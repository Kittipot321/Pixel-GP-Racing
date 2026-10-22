// Password hashing with Argon2id.
//
// Argon2id is the recommended default for password storage. We use the library
// defaults (which target the OWASP-recommended parameters) and never store or
// log the plaintext. Hashing is async and CPU-bound by design.

import argon2 from 'argon2';

/** Hash a plaintext password with Argon2id. Returns the encoded hash string. */
export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, { type: argon2.argon2id });
}

/**
 * Verify a plaintext password against a stored Argon2 hash.
 * Returns false (never throws) on a malformed hash so callers can treat it as a
 * failed login rather than a server error.
 */
export async function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}

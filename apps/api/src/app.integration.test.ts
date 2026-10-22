// End-to-end API integration tests via Fastify inject().
//
// Exercises the real routes, plugins, services, and schema against a fresh
// in-memory database. Covers the full happy path plus the security-critical
// negatives: winner hidden pre-settle, guess dedup, guess-after-close, settle
// awards + repeat-settle-no-double-award, and unauthenticated rejection.

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DbConnection } from '@pixel-race/database';
import { buildApp } from './app.js';
import { openApiDb } from './shared/db.js';
import { makeTestConfig, makeTestDb } from './test-support/app-harness.js';

interface Session {
  token: string;
  userId: string;
}

describe('Pixel Race API (integration)', () => {
  let app: FastifyInstance;
  let db: DbConnection;

  beforeEach(async () => {
    db = makeTestDb();
    app = await buildApp({ config: makeTestConfig(), dbConnection: db });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  /** Register a user and return their token + id. */
  async function register(username: string): Promise<Session> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { username, email: `${username}@example.com`, password: 'password123' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    return { token: body.token, userId: body.user.id };
  }

  function auth(token: string): Record<string, string> {
    return { authorization: `Bearer ${token}` };
  }

  it('registers, logs in, and returns the current user (no password hash)', async () => {
    const session = await register('alice');

    // FR1: a valid new registration returns 201 with { user, token } and the
    // response never carries the password hash in any form.
    const reg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { username: 'alice2', email: 'alice2@example.com', password: 'password123' },
    });
    expect(reg.statusCode).toBe(201);
    const regBody = reg.json();
    expect(typeof regBody.token).toBe('string');
    expect(regBody.token.length).toBeGreaterThan(0);
    expect(regBody.user).toMatchObject({ username: 'alice2' });
    expect(regBody.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(regBody)).not.toMatch(/passwordHash|password_hash/i);

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: 'alice', password: 'password123' },
    });
    expect(login.statusCode).toBe(200);

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: auth(session.token),
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().username).toBe('alice');
    expect(me.json()).not.toHaveProperty('passwordHash');
  });

  it('rejects unauthenticated access to a protected route', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/users/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('creates a race and hides the winner while unsettled', async () => {
    const session = await register('bob');
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/races',
      headers: auth(session.token),
    });
    expect(create.statusCode).toBe(201);
    expect(create.json().status).toBe('OPEN');
    expect(create.json().winnerColor).toBeNull();

    const raceId = create.json().id;
    const get = await app.inject({
      method: 'GET',
      url: `/api/v1/races/${raceId}`,
      headers: auth(session.token),
    });
    expect(get.json().winnerColor).toBeNull();
  });

  it('rejects a duplicate guess and a guess after the race closes', async () => {
    const session = await register('carol');
    const raceId = (
      await app.inject({ method: 'POST', url: '/api/v1/races', headers: auth(session.token) })
    ).json().id;

    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/races/${raceId}/guesses`,
      headers: auth(session.token),
      payload: { guessedColor: 'RED' },
    });
    expect(first.statusCode).toBe(201);
    // Winner never leaks in the guess acknowledgement.
    expect(first.json()).not.toHaveProperty('winnerColor');

    const dup = await app.inject({
      method: 'POST',
      url: `/api/v1/races/${raceId}/guesses`,
      headers: auth(session.token),
      payload: { guessedColor: 'BLUE' },
    });
    expect(dup.statusCode).toBe(409);

    // Close the race, then a further guess must be rejected.
    await app.inject({
      method: 'POST',
      url: `/api/v1/races/${raceId}/start`,
      headers: auth(session.token),
    });
    const afterClose = await app.inject({
      method: 'POST',
      url: `/api/v1/races/${raceId}/guesses`,
      headers: auth(session.token),
      payload: { guessedColor: 'YELLOW' },
    });
    expect(afterClose.statusCode).toBe(409);
  });

  it('settles a race, awards points, and does not double-award on repeat', async () => {
    const session = await register('dave');
    const raceId = (
      await app.inject({ method: 'POST', url: '/api/v1/races', headers: auth(session.token) })
    ).json().id;

    // The server's hidden winner is one of the four — read it directly from the
    // DB (not exposed via the API) so we can guess it and assert a correct win.
    const winner = db.sqlite
      .prepare('SELECT winner_color AS w FROM races WHERE id = ?')
      .get(raceId) as { w: string };

    await app.inject({
      method: 'POST',
      url: `/api/v1/races/${raceId}/guesses`,
      headers: auth(session.token),
      payload: { guessedColor: winner.w },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/races/${raceId}/start`,
      headers: auth(session.token),
    });

    const settle = await app.inject({
      method: 'POST',
      url: `/api/v1/races/${raceId}/settle`,
      headers: auth(session.token),
    });
    expect(settle.statusCode).toBe(200);
    expect(settle.json().isCorrect).toBe(true);
    expect(settle.json().pointsAwarded).toBe(1);
    expect(settle.json().winnerColor).toBe(winner.w);

    // Repeat settle: same result, still exactly one ledger entry.
    const again = await app.inject({
      method: 'POST',
      url: `/api/v1/races/${raceId}/settle`,
      headers: auth(session.token),
    });
    expect(again.statusCode).toBe(200);
    expect(again.json().pointsAwarded).toBe(1);

    const ledgerCount = db.sqlite
      .prepare('SELECT COUNT(*) AS c FROM score_ledger WHERE race_id = ?')
      .get(raceId) as { c: number };
    expect(ledgerCount.c).toBe(1);

    // Stats reflect the single settled, correct race.
    const stats = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/stats',
      headers: auth(session.token),
    });
    expect(stats.json().totalPoints).toBe(1);
    expect(stats.json().settledRaces).toBe(1);
    expect(stats.json().accuracy).toBe(1);
  });
});

// Fail-loud wiring regression (NFR2): the original defect was a generic HTTP 500
// at request time because the app silently opened an empty, unmigrated DB. The
// fix surfaces a clear error when the app's database wiring points at a missing
// or unmigrated file. We assert this at the narrowest level that reproduces the
// defect — opening the API's DB connection — rather than booting a full server.
describe('API DB wiring fails loudly against a missing/unmigrated DB (NFR2)', () => {
  let tmpDir: string | undefined;

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  it('surfaces a clear error (not a silent 500) when the DB file is missing', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'pixel-race-api-wiring-'));
    const missing = join(tmpDir, 'pixel-race.sqlite');

    expect(() => openApiDb({ databasePath: missing })).toThrow(/db:migrate/);
    // The guard must not silently materialize an empty DB.
    expect(existsSync(missing)).toBe(false);
  });
});

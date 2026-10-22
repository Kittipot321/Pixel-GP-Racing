import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DbConnection } from '@pixel-race/database';
import { buildApp } from './app.js';
import { makeTestConfig, makeTestDb } from './test-support/app-harness.js';

describe('GET /api/v1/health', () => {
  let app: FastifyInstance;
  let db: DbConnection;

  beforeAll(async () => {
    // Arrange: build the app (in-memory DB, no logger) and wait for readiness.
    db = makeTestDb();
    app = await buildApp({ config: makeTestConfig(), dbConnection: db });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    db.close();
  });

  it('returns 200 with { status: "ok" }', async () => {
    // Act: call the route in-process (no network).
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    // Assert: happy-path contract for the health endpoint.
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});

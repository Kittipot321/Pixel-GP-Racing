import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import { randomUUID } from 'node:crypto';
import type { HealthStatus } from '@pixel-race/shared-types';
import { loadConfig, type ApiConfig } from './config/env.js';
import type { DbConnection } from './shared/db.js';
import { dbPlugin } from './plugins/db.plugin.js';
import { authPlugin } from './plugins/auth.plugin.js';
import { errorHandlerPlugin } from './plugins/error-handler.plugin.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/users/users.routes.js';
import { raceRoutes } from './modules/races/races.routes.js';
import { leaderboardRoutes } from './modules/leaderboard/leaderboard.routes.js';

export interface BuildAppOptions {
  /** Typed config. Defaults to loadConfig() (reads process.env). */
  config?: ApiConfig;
  /** Optional pre-opened DB connection (tests inject an in-memory handle). */
  dbConnection?: DbConnection;
  /** Enable the Fastify logger. Off in tests, on for the server. */
  logger?: boolean;
}

/**
 * Build and configure the Fastify application.
 *
 * Routes and plugins are registered here (not in server.ts) so tests can
 * exercise the app in-process via `app.inject()` without binding to a port.
 */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();

  const app = Fastify({
    logger: options.logger ?? false,
    // Attach a request id to every request for tracing; honour an inbound
    // X-Request-Id when present, otherwise generate one.
    genReqId: (req) => {
      const header = req.headers['x-request-id'];
      return (Array.isArray(header) ? header[0] : header) ?? randomUUID();
    },
  });

  // Echo the request id back so clients/log aggregators can correlate.
  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  // Consistent error envelope + 404 handler.
  await app.register(errorHandlerPlugin);

  // CORS restricted to the configured origins.
  await app.register(fastifyCors, {
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
    credentials: true,
  });

  // Core infrastructure: database client + JWT auth.
  await app.register(dbPlugin, { config, connection: options.dbConnection });
  await app.register(authPlugin, { config });

  // Health probe — used by tests, load balancers, and uptime checks.
  app.get('/api/v1/health', async (): Promise<HealthStatus> => {
    return { status: 'ok' };
  });

  // Feature routes under the versioned prefix.
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(userRoutes, { prefix: '/api/v1/users' });
  await app.register(raceRoutes, { prefix: '/api/v1/races' });
  await app.register(leaderboardRoutes, { prefix: '/api/v1/leaderboard' });

  return app;
}

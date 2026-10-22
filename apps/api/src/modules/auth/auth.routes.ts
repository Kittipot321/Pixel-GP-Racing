// Auth routes: register and login.
//
// Rate limiting is applied here (and ONLY here) per NFR2 — abuse of these
// endpoints is the main brute-force surface. Input is validated with the shared
// Zod schemas; the service owns hashing and token issuance.

import type { FastifyPluginAsync } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';
import { registerRequestSchema, loginRequestSchema } from '@pixel-race/shared-types';
import { registerUser, loginUser } from './auth.service.js';

/**
 * Register the auth routes under their own encapsulated context so the
 * rate-limit plugin applies to these routes only, not the whole API.
 */
export const authRoutes: FastifyPluginAsync = async (app) => {
  // Tight limit on credential endpoints: a handful of attempts per minute.
  await app.register(fastifyRateLimit, {
    max: 10,
    timeWindow: '1 minute',
  });

  app.post('/register', async (request, reply) => {
    const body = registerRequestSchema.parse(request.body);
    const result = await registerUser(app.db, body, app.signAccessToken);
    reply.status(201).send(result);
  });

  app.post('/login', async (request) => {
    const body = loginRequestSchema.parse(request.body);
    return loginUser(app.db, body, app.signAccessToken);
  });
};

// JWT authentication plugin.
//
// Registers @fastify/jwt (signing + verification) and exposes:
//   - `app.signAccessToken(userId)` — mint a short-lived token for a user;
//   - `app.authenticate` — a preHandler that verifies the bearer token and
//     populates `request.userId`, rejecting unauthenticated requests with a
//     consistent 401 (the AppError is mapped by the error handler).
//
// Tokens are signed with the env secret; the subject claim carries the user id.
// Credentials and tokens are never logged.

import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { unauthorized } from '../shared/errors.js';
import type { ApiConfig } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** Sign a short-lived access token whose subject is the given user id. */
    signAccessToken: (userId: string) => string;
    /** preHandler that requires a valid bearer token; sets request.userId. */
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
  interface FastifyRequest {
    /** Authenticated user id, populated by the `authenticate` preHandler. */
    userId?: string;
  }
}

/** Shape of our JWT payload: only the subject (user id) is carried. */
interface AccessTokenPayload {
  sub: string;
}

export interface AuthPluginOptions {
  config: Pick<ApiConfig, 'jwtSecret' | 'jwtExpiresIn'>;
}

const authPluginImpl: FastifyPluginAsync<AuthPluginOptions> = async (app, opts) => {
  await app.register(fastifyJwt, {
    secret: opts.config.jwtSecret,
    sign: { expiresIn: opts.config.jwtExpiresIn },
  });

  app.decorate('signAccessToken', (userId: string): string => {
    // `sub` is the standard subject claim; expiresIn comes from the sign config.
    return app.jwt.sign({ sub: userId });
  });

  app.decorate('authenticate', async (request: FastifyRequest): Promise<void> => {
    try {
      const payload = await request.jwtVerify<AccessTokenPayload>();
      request.userId = payload.sub;
    } catch {
      // Any verification failure (missing, malformed, expired) is a 401.
      throw unauthorized('A valid access token is required');
    }
  });
};

/** Fastify plugin wiring JWT auth. Wrapped with fastify-plugin to share scope. */
export const authPlugin = fp(authPluginImpl, { name: 'auth-plugin' });

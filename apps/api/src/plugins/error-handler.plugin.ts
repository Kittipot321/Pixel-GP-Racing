// Centralized error handling.
//
// Maps every thrown error to the shared ApiError envelope so clients always get
// `{ error: { code, message } }`. Known error types (AppError, ZodError, the
// rate-limit 429, Fastify's own validation/4xx) get specific codes; anything
// else becomes an opaque 500 that never leaks internals or stack traces.

import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyError } from 'fastify';
import { ZodError } from 'zod';
import type { ApiError } from '@pixel-race/shared-types';
import { AppError } from '../shared/errors.js';

/** Build the standard error envelope. */
function envelope(code: string, message: string): ApiError {
  return { error: { code, message } };
}

const errorHandlerImpl: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error: FastifyError | AppError | ZodError, request, reply) => {
    // Domain errors carry their own status + code.
    if (error instanceof AppError) {
      reply.status(error.statusCode).send(envelope(error.code, error.message));
      return;
    }

    // Zod validation failures → 400 with a concise message.
    if (error instanceof ZodError) {
      const first = error.issues[0];
      const message = first ? `${first.path.join('.')}: ${first.message}` : 'Invalid request';
      reply.status(400).send(envelope('VALIDATION_ERROR', message.trim()));
      return;
    }

    const fastifyError = error as FastifyError;

    // Rate limiting surfaces as a 429 from @fastify/rate-limit.
    if (fastifyError.statusCode === 429) {
      reply
        .status(429)
        .send(envelope('RATE_LIMITED', 'Too many requests, please slow down'));
      return;
    }

    // Fastify's own schema/parse errors are client errors in the 4xx range.
    if (fastifyError.statusCode && fastifyError.statusCode >= 400 && fastifyError.statusCode < 500) {
      reply
        .status(fastifyError.statusCode)
        .send(envelope(fastifyError.code ?? 'BAD_REQUEST', fastifyError.message));
      return;
    }

    // Unknown: log server-side (without request body) and return an opaque 500.
    request.log.error({ err: error }, 'Unhandled error');
    reply.status(500).send(envelope('INTERNAL_ERROR', 'An unexpected error occurred'));
  });

  // Consistent 404 envelope for unmatched routes.
  app.setNotFoundHandler((request, reply) => {
    reply
      .status(404)
      .send(envelope('NOT_FOUND', `Route ${request.method} ${request.url} not found`));
  });
};

export const errorHandlerPlugin = fp(errorHandlerImpl, { name: 'error-handler-plugin' });

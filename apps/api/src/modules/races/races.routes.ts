// Race + guess + settlement routes. All require authentication.
//
// Path params are validated with Zod; the race id must be a non-empty string.
// Winner-hiding and owner authorization are enforced in the service layer.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createGuessRequestSchema } from '@pixel-race/shared-types';
import { unauthorized, notFound } from '../../shared/errors.js';
import {
  createRace,
  getCurrentOpenRace,
  getRaceForOwner,
  startRace,
} from './race.service.js';
import { settleRace } from './settlement.service.js';
import { submitGuess } from '../guesses/guesses.service.js';

/** Race id path param. */
const raceParamsSchema = z.object({ raceId: z.string().min(1) });

export const raceRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  // Create a new per-player race (winner chosen + hidden server-side).
  app.post('/', async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      throw unauthorized();
    }
    const race = createRace(app.db, userId);
    reply.status(201).send(race);
  });

  // The caller's latest OPEN race (404 when none exists).
  app.get('/current', async (request) => {
    const userId = request.userId;
    if (!userId) {
      throw unauthorized();
    }
    const race = getCurrentOpenRace(app.db, userId);
    if (!race) {
      throw notFound('No open race');
    }
    return race;
  });

  // Public state of a specific race (owner-authorized, winner hidden pre-settle).
  app.get('/:raceId', async (request) => {
    const userId = request.userId;
    if (!userId) {
      throw unauthorized();
    }
    const { raceId } = raceParamsSchema.parse(request.params);
    return getRaceForOwner(app.db, raceId, userId);
  });

  // Start a race: OPEN → RUNNING, closing guessing.
  app.post('/:raceId/start', async (request) => {
    const userId = request.userId;
    if (!userId) {
      throw unauthorized();
    }
    const { raceId } = raceParamsSchema.parse(request.params);
    return startRace(app.db, raceId, userId);
  });

  // Submit a guess (only while OPEN; dedup via unique constraint).
  app.post('/:raceId/guesses', async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      throw unauthorized();
    }
    const { raceId } = raceParamsSchema.parse(request.params);
    const { guessedColor } = createGuessRequestSchema.parse(request.body);
    const result = submitGuess(app.db, { raceId, userId, guessedColor });
    reply.status(201).send(result);
  });

  // Settle a race: disclose the winner, award points (idempotent).
  app.post('/:raceId/settle', async (request) => {
    const userId = request.userId;
    if (!userId) {
      throw unauthorized();
    }
    const { raceId } = raceParamsSchema.parse(request.params);
    return settleRace(app.db, { raceId, ownerId: userId });
  });
};

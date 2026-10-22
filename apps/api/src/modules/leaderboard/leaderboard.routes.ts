// Leaderboard route. Public ranking (all-time or daily) with pagination.
//
// The leaderboard itself is not user-private, but we still require auth for the
// POC so only signed-in players can read it. Query params are validated with
// the shared Zod schema.

import type { FastifyPluginAsync } from 'fastify';
import { leaderboardQuerySchema } from '@pixel-race/shared-types';
import { unauthorized } from '../../shared/errors.js';
import { getLeaderboard } from './leaderboard.service.js';

export const leaderboardRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (request) => {
    if (!request.userId) {
      throw unauthorized();
    }
    const { period, page, pageSize } = leaderboardQuerySchema.parse(request.query);
    return getLeaderboard(app.db, { period, page, pageSize });
  });
};

// User routes: current user, stats, and history. All require authentication.

import type { FastifyPluginAsync } from 'fastify';
import { paginationQuerySchema } from '@pixel-race/shared-types';
import { unauthorized, notFound } from '../../shared/errors.js';
import { findUserById } from '../auth/auth.repository.js';
import { toPublicUser } from './users.mapper.js';
import { getUserStats, getUserHistory } from '../leaderboard/leaderboard.service.js';

export const userRoutes: FastifyPluginAsync = async (app) => {
  // Every route in this module requires a valid token.
  app.addHook('preHandler', app.authenticate);

  app.get('/me', async (request) => {
    const userId = request.userId;
    if (!userId) {
      throw unauthorized();
    }
    const row = findUserById(app.db, userId);
    if (!row) {
      throw notFound('User not found');
    }
    return toPublicUser(row);
  });

  app.get('/me/stats', async (request) => {
    const userId = request.userId;
    if (!userId) {
      throw unauthorized();
    }
    return getUserStats(app.db, userId);
  });

  app.get('/me/history', async (request) => {
    const userId = request.userId;
    if (!userId) {
      throw unauthorized();
    }
    const { page, pageSize } = paginationQuerySchema.parse(request.query);
    return getUserHistory(app.db, { userId, page, pageSize });
  });
};

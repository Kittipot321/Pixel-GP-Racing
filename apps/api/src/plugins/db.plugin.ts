// Database plugin.
//
// Opens one DbConnection for the app's lifetime and decorates the instance with
// the Drizzle client (`app.db`). Closes the handle on shutdown via an onClose
// hook so tests and the server both release the file cleanly.

import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { openApiDb, type DbClient, type DbConnection } from '../shared/db.js';
import type { ApiConfig } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** Drizzle client bound to the Pixel Race schema. */
    db: DbClient;
  }
}

export interface DbPluginOptions {
  config: Pick<ApiConfig, 'databasePath'>;
  /** Optional pre-opened connection — tests inject an in-memory handle here. */
  connection?: DbConnection;
}

const dbPluginImpl: FastifyPluginAsync<DbPluginOptions> = async (app, opts) => {
  const connection = opts.connection ?? openApiDb(opts.config);
  app.decorate('db', connection.db);

  // Only close a connection we opened ourselves; an injected one is owned by
  // the caller (the test) so it can migrate/assert after the app closes.
  if (!opts.connection) {
    app.addHook('onClose', async () => {
      connection.close();
    });
  }
};

export const dbPlugin = fp(dbPluginImpl, { name: 'db-plugin' });

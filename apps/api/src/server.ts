import { buildApp } from './app.js';
import { loadConfig } from './config/env.js';

/**
 * Boot the API: read env config, build the app, and start listening.
 * Registers graceful-shutdown handlers so SIGINT/SIGTERM close the HTTP server
 * and the database handle cleanly before exit. Any startup failure is logged
 * and exits the process non-zero (fail loud).
 */
async function start(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp({ config, logger: true });

  // Close the app (and its DB handle via the onClose hook) on shutdown signals.
  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Received ${signal}, shutting down gracefully`);
    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`API listening on http://${config.host}:${config.port} (${config.nodeEnv})`);
  } catch (error) {
    app.log.error({ err: error }, 'Failed to start API server');
    process.exit(1);
  }
}

void start();

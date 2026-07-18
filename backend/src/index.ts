import { createApp } from './app';
import { startScheduler } from './sync/scheduler';
import { config } from './config';
import { logger } from './utils/logger';

async function main() {
  logger.info('Starting Crypto H5 Backend...');

  // Run initial sync before starting cron
  logger.info('Running initial data sync...');
  const { runAllSyncJobs } = await import('./sync/scheduler');
  await runAllSyncJobs();
  logger.info('Initial sync complete');

  // Start periodic sync
  startScheduler();
  logger.info('Sync scheduler started');

  // Start HTTP server
  const app = createApp();
  app.listen(config.port, () => {
    logger.info(`Server running on http://localhost:${config.port}`);
    logger.info(`Health check: http://localhost:${config.port}/api/health`);
  });
}

main().catch((err) => {
  logger.error('Fatal error', err);
  process.exit(1);
});

import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { syncMarket } from './syncMarket';
import { syncAllRSS } from './syncRSS';
import { config } from '../config';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

async function saveSyncLog(
  task: string,
  status: string,
  count: number,
  duration: number,
  error?: string
) {
  try {
    await prisma.syncLog.create({
      data: { task, status, count, duration, error: error || null },
    });
  } catch (e) {
    logger.error('Failed to save sync log', e);
  }
}

async function runMarketSync() {
  logger.debug('Running market sync...');
  const start = Date.now();
  try {
    const result = await syncMarket(prisma);
    await saveSyncLog('market', result.status, result.count, Date.now() - start);
  } catch (error: any) {
    await saveSyncLog('market', 'failed', 0, Date.now() - start, error.message);
  }
}

async function runRSSSync() {
  logger.debug('Running RSS sync...');
  const start = Date.now();
  try {
    await syncAllRSS(prisma);
    await saveSyncLog('rss', 'success', 0, Date.now() - start);
  } catch (error: any) {
    await saveSyncLog('rss', 'failed', 0, Date.now() - start, error.message);
  }
}

export async function runAllSyncJobs() {
  logger.info('Running all sync jobs...');
  await Promise.all([runMarketSync(), runRSSSync()]);
}

export function startScheduler() {
  // Market data: every minute
  cron.schedule('*/1 * * * *', runMarketSync);
  logger.info('Market sync scheduled: every 1 min');

  // RSS news: every 5 minutes
  cron.schedule('*/5 * * * *', runRSSSync);
  logger.info('RSS sync scheduled: every 5 min');

  // Cleanup old price data: every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - config.sync.coinPriceRetentionDays);
    const result = await prisma.coinPrice.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });
    logger.info(`Cleaned up ${result.count} old coin prices`);
  });

  // Cleanup old sync logs: daily
  cron.schedule('0 0 * * *', async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - config.sync.syncLogRetentionDays);
    const result = await prisma.syncLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    logger.info(`Cleaned up ${result.count} old sync logs`);
  });

  logger.info('Scheduler started');
}

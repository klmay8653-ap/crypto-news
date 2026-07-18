import express from 'express';
import cors from 'cors';
import { marketRoutes } from './routes/market';
import { newsRoutes } from './routes/news';
import { flashRoutes } from './routes/flash';
import { userRoutes } from './routes/user';
import { logger } from './utils/logger';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Prevent browser caching of API responses
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Request logging
  app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.url}`);
    next();
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Admin: sync status
  app.get('/api/admin/sync-status', async (_req, res) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const logs = await prisma.syncLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      res.json({ code: 0, data: logs });
    } finally {
      await prisma.$disconnect();
    }
  });

  // API routes
  app.use('/api/v1/market', marketRoutes);
  app.use('/api/v1/news', newsRoutes);
  app.use('/api/v1/flash', flashRoutes);
  app.use('/api/v1/user', userRoutes);

  // Home aggregation
  app.get('/api/v1/home', async (_req, res) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const [tickers, flashLatest, recommend] = await Promise.all([
        prisma.coin.findMany({
          orderBy: { marketCapRank: 'asc' },
          take: 10,
          select: {
            id: true, symbol: true, name: true, image: true,
            currentPrice: true, priceChangePercent24h: true,
            marketCapRank: true,
          },
        }),
        prisma.flashNews.findMany({
          orderBy: { publishedAt: 'desc' },
          take: 5,
        }),
        prisma.newsArticle.findMany({
          orderBy: { publishedAt: 'desc' },
          take: 10,
        }),
      ]);
      res.json({
        code: 0,
        data: {
          tickers,
          flashLatest,
          recommend,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      res.status(500).json({ code: -1, message: error.message });
    } finally {
      await prisma.$disconnect();
    }
  });

  // 404
  app.use((_req, res) => {
    res.status(404).json({ code: 404, message: 'Not found' });
  });

  return app;
}

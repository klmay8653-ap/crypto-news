import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();

function getPrisma() {
  return new PrismaClient();
}

// GET /api/v1/flash/list - Cursor-based pagination
router.get('/list', async (req, res) => {
  const prisma = getPrisma();
  try {
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 30));

    const where: any = {};
    if (cursor) {
      where.publishedAt = { lt: new Date(cursor) };
    }

    const list = await prisma.flashNews.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = list.length > limit;
    if (hasMore) list.pop();

    const nextCursor = list.length > 0
      ? list[list.length - 1].publishedAt.toISOString()
      : null;

    res.json({
      code: 0,
      data: { list, nextCursor, hasMore },
    });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  } finally {
    await prisma.$disconnect();
  }
});

// GET /api/v1/flash/latest - Incremental polling
router.get('/latest', async (req, res) => {
  const prisma = getPrisma();
  try {
    const since = req.query.since as string | undefined;

    const where: any = {};
    if (since) {
      where.publishedAt = { gt: new Date(since) };
    }

    const list = await prisma.flashNews.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: 50,
    });

    res.json({
      code: 0,
      data: { list, count: list.length },
    });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  } finally {
    await prisma.$disconnect();
  }
});

export { router as flashRoutes };

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();

function getPrisma() {
  return new PrismaClient();
}

// GET /api/v1/news/list - News list with pagination
router.get('/list', async (req, res) => {
  const prisma = getPrisma();
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const category = req.query.category as string | undefined;
    const sourceKey = req.query.sourceKey as string | undefined;

    const where: any = {};
    if (category) where.category = category;
    if (sourceKey) where.sourceKey = sourceKey;

    const [list, total] = await Promise.all([
      prisma.newsArticle.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.newsArticle.count({ where }),
    ]);

    res.json({
      code: 0,
      data: { list, total, page, pageSize, hasMore: page * pageSize < total },
    });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  } finally {
    await prisma.$disconnect();
  }
});

// GET /api/v1/news/recommend - Latest for homepage
router.get('/recommend', async (_req, res) => {
  const prisma = getPrisma();
  try {
    const list = await prisma.newsArticle.findMany({
      orderBy: { publishedAt: 'desc' },
      take: 20,
    });
    res.json({ code: 0, data: { list } });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  } finally {
    await prisma.$disconnect();
  }
});

// GET /api/v1/news/detail/:id
router.get('/detail/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    const article = await prisma.newsArticle.findUnique({
      where: { id: req.params.id },
    });

    if (!article) {
      res.status(404).json({ code: 404, message: 'Article not found' });
      return;
    }

    // Related articles (same category or source)
    const related = await prisma.newsArticle.findMany({
      where: {
        id: { not: article.id },
        OR: [
          { category: article.category || undefined },
          { sourceKey: article.sourceKey },
        ].filter((c) => Object.keys(c).length > 0),
      },
      orderBy: { publishedAt: 'desc' },
      take: 5,
    });

    res.json({ code: 0, data: { article, related } });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  } finally {
    await prisma.$disconnect();
  }
});

// GET /api/v1/news/search
router.get('/search', async (req, res) => {
  const prisma = getPrisma();
  try {
    const q = (req.query.q as string) || '';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));

    if (!q) {
      res.json({ code: 0, data: { list: [], total: 0, page: 1, pageSize, hasMore: false } });
      return;
    }

    const [list, total] = await Promise.all([
      prisma.newsArticle.findMany({
        where: {
          OR: [
            { title: { contains: q } },
            { description: { contains: q } },
          ],
        },
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.newsArticle.count({
        where: {
          OR: [
            { title: { contains: q } },
            { description: { contains: q } },
          ],
        },
      }),
    ]);

    res.json({
      code: 0,
      data: { list, total, page, pageSize, hasMore: page * pageSize < total },
    });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  } finally {
    await prisma.$disconnect();
  }
});

export { router as newsRoutes };

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();

function getPrisma() {
  return new PrismaClient();
}

// POST /api/v1/user/favorite - Toggle favorite
router.post('/favorite', async (req, res) => {
  const prisma = getPrisma();
  try {
    const { userId, articleId } = req.body;

    if (!userId || !articleId) {
      res.status(400).json({ code: -1, message: 'userId and articleId required' });
      return;
    }

    const existing = await prisma.userFavorite.findUnique({
      where: { userId_articleId: { userId, articleId } },
    });

    if (existing) {
      await prisma.userFavorite.delete({ where: { id: existing.id } });
      res.json({ code: 0, data: { favorited: false } });
    } else {
      await prisma.userFavorite.create({ data: { userId, articleId } });
      res.json({ code: 0, data: { favorited: true } });
    }
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  } finally {
    await prisma.$disconnect();
  }
});

// GET /api/v1/user/favorites
router.get('/favorites', async (req, res) => {
  const prisma = getPrisma();
  try {
    const userId = req.query.userId as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));

    if (!userId) {
      res.status(400).json({ code: -1, message: 'userId required' });
      return;
    }

    const [favorites, total] = await Promise.all([
      prisma.userFavorite.findMany({
        where: { userId },
        include: { article: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.userFavorite.count({ where: { userId } }),
    ]);

    res.json({
      code: 0,
      data: {
        list: favorites,
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
      },
    });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  } finally {
    await prisma.$disconnect();
  }
});

export { router as userRoutes };

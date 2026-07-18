import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();

function getPrisma() {
  return new PrismaClient();
}

// GET /api/v1/market/tickers - Top 10 for homepage
router.get('/tickers', async (_req, res) => {
  const prisma = getPrisma();
  try {
    const coins = await prisma.coin.findMany({
      orderBy: { marketCapRank: 'asc' },
      take: 10,
    });
    res.json({ code: 0, data: { list: coins } });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  } finally {
    await prisma.$disconnect();
  }
});

// GET /api/v1/market/list - Full list with sort/search
router.get('/list', async (req, res) => {
  const prisma = getPrisma();
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const sortBy = (req.query.sortBy as string) || 'market_cap';
    const search = (req.query.search as string) || '';

    let orderBy: any;
    switch (sortBy) {
      case 'price_change':
        orderBy = { priceChangePercent24h: 'desc' as const };
        break;
      case 'volume':
        orderBy = { totalVolume: 'desc' as const };
        break;
      default:
        orderBy = { marketCapRank: 'asc' as const };
    }

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { symbol: { contains: search.toUpperCase() } },
      ];
    }

    const [list, total] = await Promise.all([
      prisma.coin.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.coin.count({ where }),
    ]);

    res.json({
      code: 0,
      data: {
        list,
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

// GET /api/v1/market/detail/:id - Coin detail with sparkline
router.get('/detail/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    const coin = await prisma.coin.findUnique({
      where: { id: req.params.id },
    });

    if (!coin) {
      res.status(404).json({ code: 404, message: 'Coin not found' });
      return;
    }

    // Get 7-day price history for sparkline
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const prices = await prisma.coinPrice.findMany({
      where: {
        coinId: coin.id,
        timestamp: { gte: sevenDaysAgo },
      },
      orderBy: { timestamp: 'asc' },
      select: { price: true, timestamp: true },
    });

    const sparkline = prices.map((p: { price: number }) => p.price);
    const minPrice = sparkline.length > 0 ? Math.min(...sparkline) : null;
    const maxPrice = sparkline.length > 0 ? Math.max(...sparkline) : null;

    // Related news
    const relatedNews = await prisma.newsArticle.findMany({
      where: {
        OR: [
          { title: { contains: coin.name } },
          { title: { contains: coin.symbol } },
        ],
      },
      orderBy: { publishedAt: 'desc' },
      take: 10,
    });

    res.json({
      code: 0,
      data: {
        coin,
        sparkline,
        minPrice,
        maxPrice,
        relatedNews,
      },
    });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  } finally {
    await prisma.$disconnect();
  }
});

// GET /api/v1/market/search - Quick search for autocomplete
router.get('/search', async (req, res) => {
  const prisma = getPrisma();
  try {
    const q = (req.query.q as string) || '';
    if (!q) {
      res.json({ code: 0, data: { list: [] } });
      return;
    }

    const list = await prisma.coin.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { symbol: { contains: q.toUpperCase() } },
        ],
      },
      select: {
        id: true, symbol: true, name: true, image: true,
        currentPrice: true, marketCapRank: true,
      },
      take: 20,
    });

    res.json({ code: 0, data: { list } });
  } catch (error: any) {
    res.status(500).json({ code: -1, message: error.message });
  } finally {
    await prisma.$disconnect();
  }
});

export { router as marketRoutes };

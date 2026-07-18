import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import axios from 'axios';

const router = Router();

function getPrisma() {
  return new PrismaClient();
}

// Fetch and clean article content from original URL
async function fetchArticleContent(url: string): Promise<string> {
  const { data: html } = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  const $ = cheerio.load(html);

  // Remove non-content elements
  $('script, style, nav, footer, header, aside, iframe, .ad, .advertisement, .sidebar, .nav, .footer, .header, .comment, .share, .related, .recommend, [class*="banner"], [class*="popup"], [class*="modal"], noscript').remove();

  // Try to find the main article content
  let content = '';
  const selectors = [
    'article',
    '[class*="article-content"]',
    '[class*="article-body"]',
    '[class*="post-content"]',
    '[class*="post-body"]',
    '[class*="content-wrap"]',
    '[class*="detail-content"]',
    '[class*="news-content"]',
    '.content',
    'main',
  ];

  for (const sel of selectors) {
    const el = $(sel);
    if (el.length && (el.text()?.trim().length ?? 0) > 200) {
      content = el.html() || '';
      break;
    }
  }

  // Fallback: use body
  if (!content) {
    content = $('body').html() || '';
  }

  // Clean attributes and fix URLs on the extracted content
  const $content = cheerio.load(content ?? '');
  const root = $content.root();

  root.find('*').each((_, el) => {
    const attrs = Object.keys($content(el).attr() || {});
    for (const attr of attrs) {
      if (attr !== 'href' && attr !== 'src') {
        $content(el).removeAttr(attr);
      }
    }
  });

  // Convert relative URLs to absolute
  try {
    const baseUrl = new URL(url);
    root.find('a[href]').each((_, el) => {
      const href = $content(el).attr('href');
      if (href && !href.startsWith('http')) {
        $content(el).attr('href', new URL(href, baseUrl.origin).href);
      }
    });
    root.find('img[src]').each((_, el) => {
      const src = $content(el).attr('src');
      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
        $content(el).attr('src', new URL(src, baseUrl.origin).href);
      }
    });
  } catch {}

  // Return inner content without html/head/body wrapper
  const body = $content('body');
  return body.length ? (body.html() || content) : content;
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

// GET /api/v1/news/content/:id - Fetch full article content from original URL
router.get('/content/:id', async (req, res) => {
  const prisma = getPrisma();
  try {
    const article = await prisma.newsArticle.findUnique({
      where: { id: req.params.id },
    });

    if (!article) {
      res.status(404).json({ code: 404, message: 'Article not found' });
      return;
    }

    const content = await fetchArticleContent(article.url);
    res.json({ code: 0, data: { content } });
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

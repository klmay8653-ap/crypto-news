import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { config } from '../config';
import { logger } from '../utils/logger';

interface RSSArticle {
  title: string;
  url: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  author: string | null;
  publishedAt: Date;
}

function extractTextFromHTML(html: string): string | null {
  if (!html) return null;
  const match = html.match(/<p[^>]*>(.*?)<\/p>/s);
  if (match) {
    return match[1].replace(/<[^>]+>/g, '').trim().substring(0, 500);
  }
  return html.replace(/<[^>]+>/g, '').trim().substring(0, 500);
}

function extractImageFromHTML(html: string): string | null {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/);
  return match?.[1] || null;
}

async function fetchAndParseRSS(url: string): Promise<RSSArticle[]> {
  const { data } = await axios.get(url, { timeout: 15000 });
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(data);

  const items = parsed.rss?.channel?.item;
  if (!items) return [];

  const arr = Array.isArray(items) ? items : [items];

  return arr.map((item: any) => {
    const descText = extractTextFromHTML(item.description);
    const descImage = extractImageFromHTML(item.description);
    const mediaImage = item['media:content']?.['@_url'];

    return {
      title: item.title || '',
      url: item.link || '',
      description: descText,
      imageUrl: descImage || mediaImage || null,
      category: Array.isArray(item.category)
        ? item.category.filter((c: string) => c && c.trim()).join(', ') || null
        : item.category || null,
      author: item['dc:creator'] || null,
      publishedAt: new Date(item.pubDate),
    };
  });
}

export async function syncRSS(
  prisma: PrismaClient,
  sourceKey: string,
  sourceName: string,
  rssUrl: string
): Promise<{ count: number; status: string }> {
  const startTime = Date.now();
  let count = 0;

  try {
    const articles = await fetchAndParseRSS(rssUrl);
    logger.debug(`Fetched ${articles.length} from ${sourceKey}`);

    for (const article of articles) {
      if (!article.url) continue;

      try {
        await prisma.newsArticle.create({
          data: {
            sourceKey,
            sourceName,
            title: article.title,
            url: article.url,
            description: article.description,
            imageUrl: article.imageUrl,
            category: article.category,
            author: article.author,
            publishedAt: article.publishedAt,
          },
        });
        count++;

        // Auto-generate flash news for short titles
        if (article.title.length <= 80) {
          await prisma.flashNews.create({
            data: {
              title: article.title,
              content: article.description,
              source: sourceName,
              url: article.url,
              publishedAt: article.publishedAt,
            },
          });
        }
      } catch (error: any) {
        // Skip duplicates (unique constraint on url)
        if (error.code !== 'P2002') {
          logger.warn(`Failed to insert article: ${error.message}`);
        }
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`RSS sync [${sourceKey}]: ${count} new articles in ${duration}ms`);
    return { count, status: 'success' };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`RSS sync [${sourceKey}] failed after ${duration}ms: ${error.message}`);
    return { count, status: 'failed' };
  }
}

export async function syncAllRSS(prisma: PrismaClient): Promise<void> {
  for (const source of config.rssSources) {
    await syncRSS(prisma, source.key, source.name, source.url);
    // Pause between sources
    await new Promise((r) => setTimeout(r, 2000));
  }
}

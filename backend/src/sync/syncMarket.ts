import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { fetchWithRetry } from '../utils/fetcher';
import { logger } from '../utils/logger';

interface CoinLoreTicker {
  id: string;
  symbol: string;
  name: string;
  nameid: string;
  rank: number;
  price_usd: string;
  percent_change_24h: string;
  percent_change_1h: string;
  percent_change_7d: string;
  price_btc: string;
  market_cap_usd: string;
  volume24: number;
  volume24a: number;
  csupply: string;
  tsupply: string;
  msupply: string;
}

interface CoinLoreResponse {
  data: CoinLoreTicker[];
  info: { coins_num: number; time: number };
}

function parseFloatSafe(val: string | null | undefined): number | null {
  if (!val || val === '') return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}

function coinImageUrl(symbol: string): string {
  return `${config.coinImageCdn}/${symbol.toLowerCase()}@2x.png`;
}

export async function syncMarket(prisma: PrismaClient): Promise<{ count: number; status: string }> {
  const startTime = Date.now();
  let count = 0;

  try {
    const pages = 2; // Top 200 coins
    for (let page = 0; page < pages; page++) {
      const url = `${config.coinLore.baseUrl}/tickers/?start=${page * 100}&limit=100`;
      const data = await fetchWithRetry<CoinLoreResponse>(url);

      for (const ticker of data.data) {
        const currentPrice = parseFloatSafe(ticker.price_usd);
        const marketCap = parseFloatSafe(ticker.market_cap_usd);
        const priceChangePercent1h = parseFloatSafe(ticker.percent_change_1h);
        const priceChangePercent24h = parseFloatSafe(ticker.percent_change_24h);
        const priceChangePercent7d = parseFloatSafe(ticker.percent_change_7d);
        const circulatingSupply = parseFloatSafe(ticker.csupply);
        const totalSupply = parseFloatSafe(ticker.tsupply);
        const maxSupply = parseFloatSafe(ticker.msupply);

        await prisma.coin.upsert({
          where: { id: ticker.id },
          update: {
            symbol: ticker.symbol,
            name: ticker.name,
            image: coinImageUrl(ticker.symbol),
            currentPrice,
            marketCap,
            marketCapRank: ticker.rank,
            priceChangePercent1h,
            priceChangePercent24h,
            priceChangePercent7d,
            totalVolume: ticker.volume24 || null,
            circulatingSupply,
            totalSupply,
            maxSupply,
            lastUpdated: new Date(),
          },
          create: {
            id: ticker.id,
            symbol: ticker.symbol,
            name: ticker.name,
            image: coinImageUrl(ticker.symbol),
            currentPrice,
            marketCap,
            marketCapRank: ticker.rank,
            priceChangePercent1h,
            priceChangePercent24h,
            priceChangePercent7d,
            totalVolume: ticker.volume24 || null,
            circulatingSupply,
            totalSupply,
            maxSupply,
            lastUpdated: new Date(),
          },
        });

        // Insert price snapshot
        if (currentPrice !== null) {
          await prisma.coinPrice.create({
            data: {
              coinId: ticker.id,
              price: currentPrice,
              marketCap,
              volume: ticker.volume24 || null,
            },
          });
        }

        count++;
      }

      // Pause between pages
      if (page < pages - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`Market sync: ${count} coins in ${duration}ms`);
    return { count, status: 'success' };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`Market sync failed after ${duration}ms: ${error.message}`);
    return { count, status: 'failed' };
  }
}

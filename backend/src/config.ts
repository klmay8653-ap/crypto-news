import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  coinLore: {
    baseUrl: 'https://api.coinlore.net/api',
  },

  rssSources: [
    {
      key: 'cointelegraph',
      name: 'CoinTelegraph',
      url: 'https://cointelegraph.com/rss',
    },
    {
      key: 'decrypt',
      name: 'Decrypt',
      url: 'https://decrypt.co/feed',
    },
  ],

  sync: {
    marketIntervalMinutes: 1,
    rssIntervalMinutes: 5,
    coinPriceRetentionDays: 7,
    syncLogRetentionDays: 30,
  },

  cache: {
    ttlSeconds: 30,
  },

  // Coin image fallback CDN
  coinImageCdn: 'https://assets.coincap.io/assets/icons',
};

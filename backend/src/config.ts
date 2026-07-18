import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  coinLore: {
    baseUrl: 'https://api.coinlore.net/api',
  },

  // RSSHub base URL — local instance or public instance
  rsshubBase: process.env.RSSHUB_BASE || 'http://rsshub:1200',

  // 中文加密货币 RSS 源（通过 RSSHub 获取）
  // 仅保留已验证可用的路由，失效路由已移除
  rssSources: [
    {
      key: 'jinse-lives',
      name: '金色财经快讯',
      url: '/jinse/lives',
    },
    {
      key: 'theblockbeats',
      name: '律动 BlockBeats',
      url: '/theblockbeats/article',
    },
    {
      key: 'hellobtc',
      name: '币世界',
      url: '/hellobtc/news',
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

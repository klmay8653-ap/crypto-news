# 区块链资讯 H5 站点 — MVP 设计文档

## 1. 项目概述

一个面向移动端的区块链资讯 H5 站点。MVP 阶段采用零成本数据源（免费 API + RSS），通过后端定时同步到自有数据库，H5 前端从自有 API 读取，保证访问速度和稳定性。

### 1.1 核心目标

- 轻量级 H5，秒开体验，适配微信/浏览器
- 实时行情 + 资讯流双驱动
- 零 API 成本，数据自持

### 1.2 MVP 数据策略

```
免费第三方数据源               定时同步 (Cron)          自有数据库            H5 前端
──────────────────       ──────────────         ────────────         ──────────
CoinTelegraph RSS    →   每 5 分钟拉取资讯   →   SQLite         →   资讯列表/详情
Decrypt RSS          →   每 5 分钟拉取资讯   →   SQLite         →   资讯列表/详情
CoinLore API         →   每 60 秒拉取行情    →   SQLite         →   行情榜单/详情
(全部已验证可用，中国大陆直连)
```

---

## 2. 外部数据源验证报告

> **验证时间**: 2026-07-18
> **验证方式**: 实际 curl 调用，确认接口可达性与返回格式
> **网络环境**: 当前开发机在中国大陆，部分海外 API 不可达

### 2.1 验证结果总览

| 数据源 | 类型 | 状态 | 备注 |
|--------|------|------|------|
| **CoinLore API** | 行情 | ✅ 可用 | 免费、无 Key、~14K 币种、实时价格/涨跌幅/市值/成交量 |
| **CoinTelegraph RSS** | 资讯 | ✅ 可用 | 内容质量高，~20 条/次，含配图/摘要/分类 |
| **Decrypt RSS** | 资讯 | ✅ 可用 | 英文内容，含配图/摘要 |
| **cryptocurrency.cv** | 资讯 API | ❌ 已挂 | 返回 "DEPLOYMENT_DISABLED"，服务已下线 |
| **CoinDesk RSS** | 资讯 | ❌ 无响应 | curl 返回空 |
| **The Block RSS** | 资讯 | ❌ 404 | RSS 端点不存在 |
| **CryptoPanic** | 资讯 API | ❌ 被拦 | Cloudflare 拦截 |
| **CoinGecko** | 行情 API | ⚠️ 不稳定 | Cloudflare 屏蔽 VPN IP，部分环境不可达 |
| **CryptoCompare** | 行情 API | ❌ 需付费 | 返回 401，免费层已取消 |
| **Binance API** | 行情 | ⚠️ 网络限制 | 中国大陆不可达 |
| **OKX API** | 行情 | ⚠️ 网络限制 | 中国大陆不可达 |
| **CoinCap API** | 行情 | ❌ 不可达 | 无法解析 |

### 2.2 资讯源 — CoinTelegraph RSS ✅

**端点**: `https://cointelegraph.com/rss`
**格式**: RSS 2.0 XML
**费用**: 免费，无需 API Key
**更新频率**: 约每小时更新
**每页条数**: ~20 条
**实测响应** (2026-07-17 数据):

```xml
<item>
  <title>OKX Europe lets users convert USDT to MiCA-compliant USDC</title>
  <pubDate>Fri, 17 Jul 2026 16:54:37 +0000</pubDate>
  <guid>https://cointelegraph.com/news/okx-europe-lets-users-convert-usdt-to-mica-compliant-usdc</guid>
  <link>https://cointelegraph.com/news/okx-europe-lets-users-convert-usdt-to-mica-compliant-usdc</link>
  <description>
    <![CDATA[
      <img src="https://s3-images.ctmedia.io/.../article-cover.png" />
      <p>The feature offers European customers a voluntary path away from Tether's USDT...</p>
    ]]>
  </description>
  <dc:creator>Cointelegraph by Nate Kostar</dc:creator>
  <media:content url="..." width="528" medium="image"/>
  <category>Latest News</category>
</item>
```

**字段提取逻辑**:
| XML 路径 | 提取内容 | 存储字段 |
|----------|----------|----------|
| `title` | 标题 | `NewsArticle.title` |
| `link` | 原文链接 | `NewsArticle.url` (唯一键) |
| `description` 中 `<p>` 部分 | 摘要 | `NewsArticle.description` |
| `description` 中 `<img src>` | 封面图 | `NewsArticle.imageUrl` |
| `pubDate` | 发布时间 | `NewsArticle.publishedAt` |
| `dc:creator` | 作者 | `NewsArticle.sourceName` |
| `category` | 分类标签 | `NewsArticle.category` |

### 2.3 资讯源 — Decrypt RSS ✅

**端点**: `https://decrypt.co/feed`
**格式**: RSS 2.0 XML
**费用**: 免费，无需 API Key
**实测响应** (2026-07-17 数据):

```xml
<item>
  <title>Cardano Pumps as Network Moves to Further Decentralize Development</title>
  <link>https://decrypt.co/...</link>
  <pubDate>Fri, 17 Jul 2026 ...</pubDate>
  <description>...</description>
</item>
```

**与 CoinTelegraph RSS 并存**，提供更多资讯来源。字段结构一致，可共用同一解析器。

### 2.4 行情源 — CoinLore API ✅ 已验证

**端点一览**:

| 端点 | 说明 |
|------|------|
| `GET /api/tickers/?start=0&limit=100` | 币种列表（分页），默认返回前 100 个 |
| `GET /api/ticker/?id=90` | 单币种详情 |
| `GET /api/global/` | 全球市场总览（总市值、BTC 占比、ETH 占比等） |

**费用**: 完全免费，无需 API Key
**限频**: 宽松（官方建议合理使用，实测无硬限频）
**币种数**: ~14,000+

**实测响应** (`/api/tickers/?limit=5`, 2026-07-18):

```json
{
  "data": [
    {
      "id": "90",
      "symbol": "BTC",
      "name": "Bitcoin",
      "nameid": "bitcoin",
      "rank": 1,
      "price_usd": "64075.57",
      "percent_change_24h": "-0.21",
      "percent_change_1h": "0.14",
      "percent_change_7d": "0.25",
      "price_btc": "1.00",
      "market_cap_usd": "1279643690043.00",
      "volume24": 22037278819.14,
      "volume24a": 21473009332.71,
      "csupply": "19970852.00",
      "tsupply": "19970852",
      "msupply": "21000000"
    },
    ...
  ],
  "info": {
    "coins_num": 14471,
    "time": 1784316002
  }
}
```

**字段映射 CoinLore → 数据库:**

| CoinLore 字段 | DB 字段 | 备注 |
|--------------|---------|------|
| `id` | Coin.id | "90" |
| `symbol` | Coin.symbol | "BTC" |
| `name` | Coin.name | "Bitcoin" |
| `nameid` | — | 备用，如 "bitcoin" |
| `rank` | Coin.marketCapRank | |
| `price_usd` | Coin.currentPrice | 字符串，需转 Float |
| `percent_change_1h` | Coin.priceChangePercent1h | |
| `percent_change_24h` | Coin.priceChangePercent24h | |
| `percent_change_7d` | Coin.priceChangePercent7d | |
| `market_cap_usd` | Coin.marketCap | |
| `volume24` | Coin.totalVolume | |
| `csupply` | Coin.circulatingSupply | |
| `tsupply` | Coin.totalSupply | |
| `msupply` | Coin.maxSupply | |

**CoinLore 缺失的字段 (与 CoinGecko 相比):**
- ❌ `image` (币种图标) — 可用 `https://assets.coincap.io/assets/icons/{symbol.lower()}@2x.png` 替代
- ❌ `sparkline_in_7d` (7 天走势) — 用自建 coin_prices 表的历史数据
- ❌ `high_24h` / `low_24h` — MVP 可跳过
- ❌ `ath` / `ath_date` — MVP 可跳过
- ❌ `priceChange24h` (涨跌额) — 可根据 currentPrice 和 percent_change_24h 推算
- ❌ `priceChangePercent30d` — MVP 可跳过

**单币种接口** (`/api/ticker/?id=90`) 返回字段与列表一致（数组格式，单元素）。

**全局市场接口** (`/api/global/`):
```json
[{
  "coins_count": 14471,
  "active_markets": 29701,
  "total_mcap": 2183403423580.04,
  "total_volume": 87604501168.32,
  "btc_d": "58.62",
  "eth_d": "10.32",
  "mcap_change": "-0.27",
  "volume_change": "1.12",
  "avg_change_percent": "-0.07"
}]
```

### 2.5 行情源备选 — CoinGecko API

CoinGecko 数据更全（含 sparkline、high/low、ath、30d 变化、图标等），但当前验证中 Cloudflare 屏蔽了 VPN IP 导致 TLS 失败。如果未来部署到能直连 CoinGecko 的海外服务器，可作为升级替换。

### 2.6 快讯源

cryptocurrency.cv 的 `/api/breaking` 端点已不可用。MVP 阶段从 RSS 资讯中自动筛选标题短的作为快讯（详见 7.3 节）。

### 2.7 部署策略

**CoinLore + RSS 均可从中国大陆直接访问**，MVP 可以在任意网络环境开发和部署。如果后续想升级到 CoinGecko（数据更全），则需要海外服务器。

---

## 3. 系统架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        H5 Frontend (Vue 3)                        │
│  部署: Nginx + CDN                                                 │
│  数据: 只调自有 BFF API，不直接访问第三方                              │
└───────────────┬──────────────────────────────────────────────────┘
                │  HTTPS (自有 API)
┌───────────────▼──────────────────────────────────────────────────┐
│                     BFF Server (Node.js)                          │
│  框架: Express + TypeScript                                       │
│  ORM:  Prisma + SQLite                                           │
│  API:  RESTful，服务 H5 的读请求                                    │
│  Auth: (MVP 可选) 简单 token / deviceId                           │
└───────┬───────────────────────┬──────────────────────────────────┘
        │  Prisma Client        │  node-cron 定时触发
┌───────▼──────────┐    ┌───────▼──────────────────────────────────┐
│     SQLite        │    │         Sync Workers (内置)              │
│  - coins          │    │  syncMarket()      → CoinLore API 已验证  │
│  - coin_prices    │    │  syncRSS()          → CoinTelegraph RSS   │
│  - news_articles  │    │  syncRSS()          → Decrypt RSS         │
│  - flash_news     │    │  (每个 Worker 内建重试 + 限频控制)        │
│  - user_favorites │    └──────────────────────────────────────────┘
│  - sync_logs      │
└───────────────────┘
```

---

## 4. 技术选型

### 4.1 前端 (H5)

| 层级 | 技术 | 理由 |
|------|------|------|
| 框架 | Vue 3 + Vite | 轻量、生态成熟 |
| UI | Vant 4 | 移动端组件库 |
| 状态 | Pinia | Vue 3 官方推荐 |
| 路由 | Vue Router 4 | SPA 路由 |
| HTTP | Axios | 拦截器、重试 |
| 样式 | Tailwind CSS | 原子化 |
| 图表 | ECharts 5 (按需) | K 线/走势图 |
| 缓存 | localforage | 前端本地缓存 |

### 4.2 后端 (BFF + Sync)

| 层级 | 技术 | 理由 |
|------|------|------|
| 运行时 | Node.js + TypeScript | 前后端统一语言 |
| 框架 | Express | 成熟稳定、中间件丰富 |
| ORM | Prisma | 类型安全、迁移管理、SQLite→PG 可平滑升级 |
| 数据库 | SQLite (MVP) | 零配置单文件，小站点足够；后期可迁 PostgreSQL |
| 定时任务 | node-cron | 轻量，进程内执行 |
| HTTP | axios (服务端) | 调用第三方 API |
| 缓存 | node-cache (内存) | 热点数据内存缓存 |
| 校验 | zod | 请求参数校验 |

### 4.3 数据库升级路径

```
MVP (当前)            ￥0/月
SQLite 单文件
↓ 流量起来后
PostgreSQL           免费层足够 (Supabase/Neon/Railway)
↓ 大规模
PostgreSQL + Redis   读写分离
```

---

## 5. 项目目录结构

```
crypto-h5/
├── frontend/                      # H5 前端
│   ├── src/
│   │   ├── api/                   # BFF API 调用
│   │   │   ├── index.ts           # Axios 实例
│   │   │   ├── news.ts
│   │   │   ├── market.ts
│   │   │   └── user.ts
│   │   ├── components/
│   │   │   ├── common/            # NavBar, TabBar, Loading, Empty, ErrorPage
│   │   │   ├── news/              # NewsCard, NewsList, FlashBar
│   │   │   └── market/            # TickerItem, MiniChart
│   │   ├── composables/           # useNews, useMarket, useInfiniteScroll, useCache
│   │   ├── layout/DefaultLayout.vue
│   │   ├── router/index.ts
│   │   ├── stores/                # newsStore, marketStore, userStore
│   │   ├── utils/                 # format, storage, constants
│   │   └── views/                 # home, flash, market, news, user
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/                       # BFF + Sync 服务
│   ├── src/
│   │   ├── index.ts               # 入口：启动 Express + 注册 cron
│   │   ├── app.ts                 # Express 实例、中间件
│   │   ├── config.ts              # 环境变量、常量
│   │   ├── db/
│   │   │   └── prisma/
│   │   │       ├── schema.prisma  # 数据模型
│   │   │       └── migrations/    # 迁移文件
│   │   ├── routes/
│   │   │   ├── news.ts            # 资讯相关路由
│   │   │   ├── market.ts          # 行情相关路由
│   │   │   ├── flash.ts           # 快讯相关路由
│   │   │   └── user.ts            # 用户相关路由
│   │   ├── services/              # 业务逻辑
│   │   │   ├── newsService.ts
│   │   │   ├── marketService.ts
│   │   │   └── flashService.ts
│   │   ├── sync/                  # 数据同步 Worker
│   │   │   ├── scheduler.ts       # Cron 调度器（启动/停止所有任务）
│   │   │   ├── syncMarket.ts      # 拉取 CoinGecko → 写 DB
│   │   │   ├── syncRSS.ts         # 拉取 CoinTelegraph/Decrypt RSS → 写 DB
│   │   │   └── rssParser.ts       # RSS XML 解析 + 字段提取
│   │   └── utils/
│   │       ├── logger.ts          # 日志
│   │       ├── rateLimiter.ts     # API 调用限频控制
│   │       └── fetcher.ts         # HTTP 请求封装（含重试）
│   ├── data/                      # SQLite 数据文件目录
│   ├── tsconfig.json
│   └── package.json
│
├── docs/
│   └── design.md                  # 本文档
└── docker-compose.yml             # (可选) 一键部署
```

---

## 6. 数据库设计

### 6.1 ER 关系

```
coins 1 ──── * coin_prices     (一个币有多条历史价格)
news_articles * ──── * user_favorites  (多对多收藏)
flash_news (独立，快讯)
sync_logs (独立，记录每次同步)
```

### 6.2 Prisma Schema

```prisma
// ==================== 行情 ====================

model Coin {
  id                  String   @id                    // coingecko id, e.g. "bitcoin"
  symbol              String                           // BTC
  name                String                           // Bitcoin
  image               String                           // 图标 URL
  currentPrice        Float?                          // 当前价 USD
  marketCap           Float?                          // 市值
  marketCapRank       Int?                            // 排名
  priceChange24h      Float?                          // 24h 涨跌额
  priceChangePercent1h  Float?
  priceChangePercent24h Float?
  priceChangePercent7d  Float?
  priceChangePercent30d Float?
  high24h             Float?
  low24h              Float?
  totalVolume         Float?                          // 24h 成交量
  circulatingSupply   Float?
  totalSupply         Float?
  maxSupply           Float?
  ath                 Float?                          // 历史最高
  athDate             DateTime?
  sparklineIn7d       String?   // JSON array, 7 天走势 MiniChart 数据
  lastUpdated         DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  prices              CoinPrice[]

  @@index([marketCapRank])
  @@index([symbol])
}

model CoinPrice {
  id        Int      @id @default(autoincrement())
  coinId    String
  coin      Coin     @relation(fields: [coinId], references: [id])
  price     Float                           // 快照价格 USD
  marketCap Float?
  volume    Float?
  timestamp DateTime  @default(now())

  @@index([coinId, timestamp])
}

// ==================== 资讯 ====================

model NewsArticle {
  id          String   @id @default(cuid())
  sourceKey   String                           // "cointelegraph" / "decrypt"
  sourceName  String                           // "CoinTelegraph" / "Decrypt"
  title       String
  url         String                           // 原文链接 (唯一键去重)
  description String?                          // 摘要 (RSS description 中提取的文本)
  imageUrl    String?                          // 封面图 (RSS description 中提取 img src)
  category    String?                          // RSS <category>
  author      String?                          // RSS <dc:creator>
  publishedAt DateTime                         // RSS <pubDate>
  createdAt   DateTime  @default(now())

  favorites   UserFavorite[]

  @@unique([url])                              // URL 去重
  @@index([publishedAt])
  @@index([category])
  @@index([sourceKey])
}

model FlashNews {
  id          Int      @id @default(autoincrement())
  title       String                           // 快讯标题 (简短)
  content     String?                          // 快讯正文
  source      String?                          // 来源
  url         String?                          // 来源链接
  publishedAt DateTime                         // 发布时间
  createdAt   DateTime  @default(now())

  @@index([publishedAt])
}

// ==================== 用户 ====================

model UserFavorite {
  id        Int      @id @default(autoincrement())
  userId    String                           // 设备 ID / 用户 token
  articleId String
  article   NewsArticle @relation(fields: [articleId], references: [id])
  createdAt DateTime  @default(now())

  @@unique([userId, articleId])
  @@index([userId])
}

// ==================== 运维 ====================

model SyncLog {
  id        Int      @id @default(autoincrement())
  task      String                           // "market" / "news" / "flash"
  status    String                           // "success" / "partial" / "failed"
  count     Int                              // 本次同步条数
  error     String?                          // 错误信息
  duration  Int                              // 耗时 ms
  createdAt DateTime  @default(now())

  @@index([task, createdAt])
}
```

### 6.3 去重策略

| 表 | 去重依据 | 方式 |
|----|----------|------|
| Coin | coingecko `id` | upsert (Prisma `upsert`) |
| CoinPrice | (coinId, timestamp) | insert only，定期清理旧数据 |
| NewsArticle | `url` | `@@unique([url])`，insert 时 skip duplicate |
| FlashNews | (title, publishedAt) | 应用层判断，去重 |
| SyncLog | 每次执行一条 | insert only |

---

## 7. 数据同步设计

### 7.1 同步调度概览

```
Cron Schedule          Sync Task              Source
──────────────────────────────────────────────────────────────────
*/60 * * * * *         syncMarket()           CoinLore API (已验证, 免费)
*/5  * * * *           syncRSS()              CoinTelegraph RSS + Decrypt RSS
0    */6 * * *         cleanupCoinPrices()    清理 7 天前的价格快照
0    0  * * *          cleanupSyncLogs()      清理 30 天前的同步日志
```

### 7.2 syncMarket — 行情同步 ✅ 已验证

**源**: CoinLore API (免费, 无需 Key, ~14K 币种)

```
流程:
1. GET https://api.coinlore.net/api/tickers/?start=0&limit=100
   - 返回 Top 100 市值币种
   - 如需更多: 翻页 start=100, start=200 ...

2. 遍历 data[], 对每个 coin:
   - Coin 表 upsert (按 id)
   - CoinPrice 表 insert 最新价格快照

3. 频率控制:
   - CoinLore 无严格限频, 建议每次间隔 ≥ 2s
   - 每 60s 执行一次
   - 如需翻页 (Top 250), 每页间隔 2s

4. 写入 sync_logs
```

**CoinLore 字段映射:**

| API 字段 | DB 字段 | 备注 |
|----------|---------|------|
| `id` | Coin.id | "90" |
| `symbol` | Coin.symbol | "BTC" |
| `name` | Coin.name | "Bitcoin" |
| `rank` | Coin.marketCapRank | |
| `price_usd` | Coin.currentPrice | 字符串, parseFloat() |
| `percent_change_1h` | Coin.priceChangePercent1h | |
| `percent_change_24h` | Coin.priceChangePercent24h | |
| `percent_change_7d` | Coin.priceChangePercent7d | |
| `market_cap_usd` | Coin.marketCap | |
| `volume24` | Coin.totalVolume | |
| `csupply` | Coin.circulatingSupply | |
| `tsupply` | Coin.totalSupply | |
| `msupply` | Coin.maxSupply | |

**CoinLore 不提供的字段 (MVP 降级处理):**
```
image           → 用 https://assets.coincap.io/assets/icons/{symbol.lower()}@2x.png
sparklineIn7d   → 用 coin_prices 表近 7 天数据自行生成
high24h/low24h  → 设为 null (MVP 不展示)
ath/athDate     → 设为 null (MVP 不展示)
priceChange24h  → 用 currentPrice * percent_change_24h / 100 推算
percent30d      → 设为 null (MVP 不展示)
```

### 7.3 syncRSS — 资讯 RSS 同步 ✅ 已验证

**源**: CoinTelegraph RSS + Decrypt RSS (免费, 无需 API Key, 已验证可用)

**RSS 端点 (已实测)**:
- `https://cointelegraph.com/rss` — 约 20 篇/次, 英文, 每小时更新
- `https://decrypt.co/feed` — 约 20 篇/次, 英文

**syncRSS Worker 流程**:

```
输入: RSS URL + sourceKey 标识
每 5 分钟执行一次

1. HTTP GET RSS URL
2. 解析 XML (使用 fast-xml-parser):
   - 提取 <channel> → 遍历 <item> 子元素
3. 对每个 <item>:
   a. 提取 url = <link> 文本
   b. 查 DB: SELECT id FROM NewsArticle WHERE url = ?
      → 存在则跳过 (去重)
   c. 提取字段:
      title       = <title> 文本
      description = <description> 中 <p> 标签内容 (纯文本摘要)
      imageUrl    = <description> 中 <img src="..."> 或 <media:content url="...">
      category    = <category> 文本
      author      = <dc:creator> 文本
      publishedAt = new Date(<pubDate>)
      sourceKey   = "cointelegraph" | "decrypt"
      sourceName  = "CoinTelegraph" | "Decrypt"
   d. INSERT INTO NewsArticle
   e. 同时 INSERT INTO FlashNews (如果标题适合做快讯)

4. 记录 sync_logs: { task: "rss-{sourceKey}", status, count }
```

**RSS → DB 字段映射**:

| RSS XML 路径 | 提取方式 | DB 字段 |
|-------------|----------|---------|
| `<title>` | 直接读取文本 | NewsArticle.title |
| `<link>` | 直接读取文本 | NewsArticle.url (唯一键) |
| `<description>` 内 `<p>...</p>` | 正则提取第一个 `<p>` 内容 | NewsArticle.description |
| `<description>` 内 `<img src="...">` | 正则提取 src 属性 | NewsArticle.imageUrl |
| `<media:content url="...">` | 备选图片来源 | NewsArticle.imageUrl |
| `<category>` | 直接读取文本 | NewsArticle.category |
| `<dc:creator>` | 直接读取文本 | NewsArticle.author |
| `<pubDate>` | `new Date()` 解析 | NewsArticle.publishedAt |
| 硬编码 | `"cointelegraph"` | NewsArticle.sourceKey |
| 硬编码 | `"CoinTelegraph"` | NewsArticle.sourceName |

**RSS 解析代码示例**:

```typescript
// backend/src/sync/rssParser.ts
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

interface RSSArticle {
  title: string;
  url: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  author: string | null;
  publishedAt: Date;
}

export async function fetchAndParseRSS(url: string): Promise<RSSArticle[]> {
  const { data } = await axios.get(url, { timeout: 10000 });
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(data);

  const items = parsed.rss.channel.item;
  return items.map((item: any) => {
    // 从 description HTML 中提取文本摘要和图片
    const descText = extractTextFromHTML(item.description);
    const descImage = extractImageFromHTML(item.description);
    // 备选: media:content
    const mediaImage = item['media:content']?.['@_url'];

    return {
      title: item.title,
      url: item.link,
      description: descText || null,
      imageUrl: descImage || mediaImage || null,
      category: item.category || null,
      author: item['dc:creator'] || null,
      publishedAt: new Date(item.pubDate),
    };
  });
}

function extractTextFromHTML(html: string): string | null {
  const match = html?.match(/<p[^>]*>(.*?)<\/p>/);
  return match ? match[1].replace(/<[^>]+>/g, '').trim() : null;
}

function extractImageFromHTML(html: string): string | null {
  const match = html?.match(/<img[^>]+src=["']([^"']+)["']/);
  return match?.[1] || null;
}
```

### 7.4 快讯生成策略

cryptocurrency.cv 已不可用，MVP 从 RSS 资讯中自动生成快讯：

**生成规则**:
1. 每次 syncRSS 后，对新增的 NewsArticle 做筛选
2. 标题长度 ≤ 80 字符的自动标记为快讯
3. INSERT INTO FlashNews: title + content(description) + publishedAt + url
4. 或者：手动在 Admin 后台勾选重要资讯为快讯

```sql
-- 自动从 RSS 资讯中提取快讯
INSERT INTO flash_news (title, content, source, url, publishedAt)
SELECT title, description, sourceName, url, publishedAt
FROM news_articles
WHERE LENGTH(title) <= 80
  AND publishedAt > datetime('now', '-1 hour')
  AND url NOT IN (SELECT url FROM flash_news);
```

### 7.5 限频控制器

```typescript
// backend/src/utils/rateLimiter.ts
// 简单的令牌桶,控制对 CoinGecko 的请求频率

class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(private maxTokens: number, private refillRate: number) {}

  async waitForToken(): Promise<void> {
    // 如果没 token 就 sleep 等
  }
}

// CoinGecko: max 15 tokens, refill 15/min
const coingeckoLimiter = new RateLimiter(15, 15 / 60000);
```

### 7.6 同步状态监控

- 每次同步写入 `sync_logs` 表
- 暴露 `GET /api/admin/sync-status` 查看最近 100 条同步记录
- 连续失败 3 次 → console.error（MVP 阶段先打日志，后期接告警）

---

## 8. BFF API 设计（H5 调用）

### 8.1 通用约定

```
Base URL: /api/v1
Content-Type: application/json
Response:
{
  "code": 0,            // 0=成功, 其他=错误码
  "message": "success",
  "data": { ... }
}

分页响应:
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [...],
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "hasMore": true
  }
}
```

### 8.2 行情接口

```
GET  /api/v1/market/tickers
  首页概览, 返回 Top 10 市值币种简要数据

  Response: {
    list: [{ id, symbol, name, image, currentPrice, priceChangePercent24h }]
  }

────────────────────────────────────────

GET  /api/v1/market/list
  行情榜单, 支持排序/搜索

  Query:
    page       int    默认 1
    pageSize   int    默认 20, 最大 100
    sortBy     string market_cap / price_change / volume, 默认 market_cap
    search     string 按 name 或 symbol 模糊搜索

  Response: 标准分页 + Coin 全字段

────────────────────────────────────────

GET  /api/v1/market/detail/:id
  币种详情

  Params: id = "bitcoin" (CoinGecko id)

  Response: {
    coin: { ... Coin 全字段 },
    sparkline: [ 7天价格数组 ],
    minPrice: 7天内最低,
    maxPrice: 7天内最高
  }

────────────────────────────────────────

GET  /api/v1/market/search
  币种搜索 (用于首页搜索栏)

  Query: q=btc

  Response: {
    list: [{ id, symbol, name, image, currentPrice, marketCapRank }]
  }
```

### 8.3 资讯接口

```
GET  /api/v1/news/list
  资讯列表

  Query:
    page       int   默认 1
    pageSize   int   默认 20
    category   string  可选, 分类筛选
    sourceKey  string  可选, 按来源筛选

  Response: 标准分页 + NewsArticle 字段

────────────────────────────────────────

GET  /api/v1/news/recommend
  首页推荐资讯 (最新 20 条,按发布时间倒序)

  Response: { list: [NewsArticle] }

────────────────────────────────────────

GET  /api/v1/news/detail/:id
  资讯详情

  Response: { article: NewsArticle }

────────────────────────────────────────

GET  /api/v1/news/search
  文章搜索

  Query:
    q          string 关键词
    page       int
    pageSize   int

  SQL: WHERE title LIKE '%q%' OR description LIKE '%q%'
```

### 8.4 快讯接口

```
GET  /api/v1/flash/list
  快讯列表 (cursor 分页, 防数据插入导致的偏移)

  Query:
    cursor  string  可选, ISO 时间戳, 取该时间之前的数据
    limit   int     默认 30, 最大 50

  Response: {
    list: [FlashNews],
    nextCursor: "2026-07-18T10:00:00Z" | null
  }

────────────────────────────────────────

GET  /api/v1/flash/latest
  最新快讯 (比 cursor 更新的, 用于轮询增量)

  Query:
    since  string  ISO 时间戳

  Response: {
    list: [FlashNews],
    count: 5
  }
```

### 8.5 用户接口

```
POST  /api/v1/user/favorite
  收藏/取消收藏 (toggle)

  Body: { userId: string, articleId: string }
  Response: { favorited: boolean }

────────────────────────────────────────

GET  /api/v1/user/favorites
  收藏列表

  Query: userId, page, pageSize
  Response: 标准分页 + NewsArticle

────────────────────────────────────────

GET  /api/v1/user/history
  阅读历史 (从客户端 localforage 存储, 可选同步服务端)
```

### 8.6 首页聚合接口

```
GET  /api/v1/home
  首页一站式数据聚合 (减少请求数,首屏更快)

  Response: {
    tickers:     [Coin],        // Top 10 行情
    flashLatest: [FlashNews],   // 最新 5 条快讯
    recommend:   [NewsArticle], // 最新 10 篇文章
    updatedAt:   "2026-07-18T..."
  }
```

---

## 9. 前端数据流

### 9.1 页面级数据流

```
首页加载:
  onMounted → GET /api/v1/home
  → 拆解到各 Pinia store
  → 渲染行情卡片 + 快讯条 + 资讯流
  → 每 30s 轮询 /api/v1/flash/latest (增量快讯)
  → 行情卡片每 60s 刷新 /api/v1/market/tickers

资讯列表:
  首屏 GET /api/v1/news/list?page=1&pageSize=20
  → 滚动到底 useInfiniteScroll 触发下一页
  → 下拉刷新 → 重置 page=1 重新加载

行情榜单:
  onMounted → GET /api/v1/market/list
  → keep-alive 保持排序/滚动位置
  → 回到页面时静默刷新

币种详情:
  onMounted → GET /api/v1/market/detail/:id
  → ECharts 渲染 sparkline 走势图
  → 关联资讯 GET /api/v1/news/list?search=bitcoin
```

### 9.2 Pinia Store 设计

```typescript
// stores/marketStore.ts
{
  tickers: Coin[],           // 首页概览 Top 10
  list: Coin[],              // 行情榜单全量
  total: number,
  currentCoin: Coin | null,  // 详情页币种
  loading: boolean,
  error: string | null
}

// stores/newsStore.ts
{
  recommend: NewsArticle[],  // 首页推荐
  list: NewsArticle[],       // 列表页已加载
  currentArticle: NewsArticle | null,
  page: number,
  hasMore: boolean,
  category: string | null,   // 当前选中分类
  loading: boolean
}

// stores/flashStore.ts
{
  list: FlashNews[],
  cursor: string | null,
  hasMore: boolean
}
```

---

## 10. 页面与路由

```
/                     → 首页 (推荐资讯流 + 行情概览 + 快讯滚动)
/flash                → 快讯流
/market               → 行情榜单
/market/:id           → 币种详情
/news                 → 资讯列表 (分类筛选)
/news/:id             → 资讯详情
/user                 → 我的 (收藏/历史/设置)
```

**底部 TabBar (4 Tab):** 首页 | 行情 | 快讯 | 我的

---

## 11. 核心功能模块

### 11.1 首页

- **行情概览**: Top 10 币种卡片, 左右滑动, 显示价格+24h涨跌幅
- **快讯滚动条**: 最新 5 条自动轮播
- **资讯推荐流**: 无限滚动, 下拉刷新
- **顶部搜索**: 支持币种/资讯关键词

### 11.2 行情

- **榜单**: 按市值/涨跌幅/成交量排序
- **搜索**: 按名称/代号搜索
- **详情**: 7 天走势图 (ECharts sparkline)、24h 高低/成交量、市值排名

### 11.3 快讯

- **快讯流**: 时间倒序, 下拉加载更多
- **增量提示**: 顶部气泡"5 条新快讯", 点击回顶部
- **自动轮询**: 每 60s 检测增量

### 11.4 资讯

- **分类**: 全部 / Bitcoin / Ethereum / DeFi / NFT / Layer2 / 政策
- **列表**: 图文卡片, 无限滚动
- **详情**: 正文渲染  (来源跳转原文)、相关推荐、收藏

### 11.5 用户

- **收藏列表**: 已收藏资讯
- **浏览历史**: 本地 localforage
- **设置**: 语言、清除缓存、关于

---

## 12. H5 性能优化

| 优化项 | 方案 |
|--------|------|
| **首屏** | 首页聚合 API (/api/v1/home)，1 次请求= 3 次请求的数据 |
| **图片** | CDN + WebP + 懒加载 (IntersectionObserver) + 缩略图 |
| **列表** | 虚拟滚动 (>100 条时)；分页每页 20 |
| **包体积** | 路由懒加载；ECharts 按需引入；gzip |
| **前端缓存** | localforage: 首页数据缓存 5min, 详情缓存 10min |
| **后端缓存** | node-cache: 热点 API 数据内存缓存 30s |
| **渲染** | keep-alive 保持列表页状态；行情数字 CSS transition |

---

## 13. 部署方案 (MVP)

### 13.1 部署约束

**CoinLore + RSS 均在中国大陆可直连**，对服务器位置无特殊要求。国内云服务器或任意 VPS 均可。

| 方案 | 费用 | 适合 |
|------|------|------|
| **Railway / Render** | 免费层 | MVP 验证 |
| **国内云服务器** (阿里云/腾讯云) | ~50 元/月 | 生产推荐 (低延迟) |
| **任意 VPS** | ~$5/月 | 生产备选 |
| **Vercel + Railway** | 免费 | 零成本全栈部署 |

### 13.2 推荐部署架构

```
┌──────────────────────────────────────────┐
│              任意 VPS / 云服务器           │
│  (1C 1G 足够)                             │
│                                          │
│  ┌───────────┐  ┌──────────────────────┐ │
│  │  Nginx    │  │  Node.js Backend      │ │
│  │  :80/443  │  │  :3000                │ │
│  │           │  │  Express + Prisma     │ │
│  │  静态文件  │  │  + node-cron Sync     │ │
│  │  (H5)     │  │  + SQLite             │ │
│  └───────────┘  │                       │ │
│                 │  Sync Workers:        │ │
│  CDN            │  ├→ CoinLore API    ✅ │ │
│  (Cloudflare)   │  ├→ CoinTelegraph RSS │ │
│                 │  └→ Decrypt RSS       │ │
│                 └──────────────────────┘ │
└──────────────────────────────────────────┘
```

### 13.3 零成本方案 (开发验证)

- **Frontend**: Vercel / Netlify (纯静态免费)
- **Backend**: Railway (免费 500h/月，美国节点可访问 CoinGecko)
- 前后端分离, API 通过 CORS 通信

---

## 14. 开发路线图 (MVP)

### 第 1 步: 后端基础 (2-3 天)

- [ ] 初始化 Express + TypeScript + Prisma + SQLite
- [ ] 定义 Prisma Schema → migrate → 生成 client
- [ ] 实现 RSS Parser (`rssParser.ts`) — 解析 CoinTelegraph/Decrypt RSS XML
- [ ] 实现 Sync Workers: `syncRSS()` + `syncMarket()`
- [ ] 手动跑一次同步,验证数据入库
- [ ] 实现 BFF API (CRUD) — market/news/flash/home 聚合接口
- [ ] 测试: `curl` 验证各接口返回正确

### 第 2 步: 前端脚手架 + 页面 (3-5 天)

- [ ] Vite + Vue 3 + Vant + Pinia + Tailwind
- [ ] Layout + TabBar + Router
- [ ] 首页 (聚合 API `/api/v1/home`)
- [ ] 行情榜单 + 详情页 (ECharts sparkline)
- [ ] 快讯流 (cursor 分页)
- [ ] 资讯列表 + 详情 (跳转原文)

### 第 3 步: 用户功能 + 优化 (1-2 天)

- [ ] 收藏 toggle + 收藏列表
- [ ] 搜索 (币种 + 资讯模糊搜索)
- [ ] localforage 前端缓存
- [ ] 下拉刷新 + 无限滚动

### 第 4 步: 部署上线 (1 天)

- [ ] 前端 build → 部署静态文件 + CDN
- [ ] 后端部署 + Nginx 反代（国内服务器即可）
- [ ] 验证同步 cron 正常运行
- [ ] 错误监控 (Sentry 免费层)

---

## 15. 关键注意事项

1. **所有数据源已验证可用**: CoinLore API（行情）+ CoinTelegraph RSS + Decrypt RSS（资讯）均在中国大陆可直接访问，无需海外服务器
2. **CoinLore 数据限制**: 不提供 sparkline (7天走势)、high_24h/low_24h、ath、coin image。MVP 阶段：走势图用自建 coin_prices 表数据；图标用 CoinCap CDN；high/low/ath 不展示
3. **RSS 内容版权**: CoinTelegraph/Decrypt RSS 免费提供标题+摘要，商业使用时需确认版权条款。MVP 展示标题+摘要+跳转原文链接，属于合理引用
4. **SQLite 并发**: SQLite 写锁会阻塞读，RSS 同步时写入量小（~20 条/次），影响不大；如果将来扩展更多 RSS 源，考虑迁移 PostgreSQL
5. **微信环境**: 处理微信 JS-SDK 分享、X5 浏览器兼容
6. **内容合规**: 考虑国内政策措辞，"行情"替代"交易"、"数字资产"替代"加密货币"等
7. **XSS 防注入**: 所有来自 RSS description 的 HTML 内容渲染前过 DOMPurify
8. **Sync 启动顺序**: 后端启动时先跑一次完整同步，再注册 cron（避免数据库空窗期）
9. **旧数据清理**: CoinPrice 表每天 ~1440 条新数据（60s * 24h * 1 upsert），需定时清理 7 天旧数据；SyncLog 按月清理
10. **RSS 更新频率**: CoinTelegraph RSS 约每小时更新，syncRSS 每 5 分钟拉取不会造成额外负载；重复内容通过 URL 唯一键自动去重

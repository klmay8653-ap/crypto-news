# 区块链资讯 H5 - 实现与启动指南

## 1. 项目结构

```
crypto1/
├── start.sh                  # 一键启动脚本
├── docs/
│   ├── design.md             # 设计文档
│   └── implementation.md     # 本文档
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env                  # 环境变量
│   ├── prisma/
│   │   ├── schema.prisma     # 数据库模型定义
│   │   └── data/             # SQLite 数据库文件
│   └── src/
│       ├── index.ts          # 入口：启动同步 + HTTP 服务
│       ├── app.ts            # Express 应用配置与路由挂载
│       ├── config.ts         # 集中配置
│       ├── routes/
│       │   ├── market.ts     # 行情 API
│       │   ├── news.ts       # 新闻 API
│       │   ├── flash.ts      # 快讯 API
│       │   └── user.ts       # 用户收藏 API
│       ├── sync/
│       │   ├── scheduler.ts  # 定时任务调度
│       │   ├── syncMarket.ts # 行情数据同步（CoinLore）
│       │   └── syncRSS.ts    # RSS 新闻同步
│       └── utils/
│           ├── fetcher.ts    # HTTP 请求封装（含重试）
│           └── logger.ts     # 日志工具
├── frontend/
│   ├── package.json
│   ├── vite.config.ts        # Vite 配置 + API 代理 + Vant 自动导入
│   ├── index.html            # H5 入口 HTML
│   └── src/
│       ├── main.ts           # Vue 应用入口
│       ├── App.vue           # 根组件
│       ├── router/index.ts   # 路由配置（7 个页面）
│       ├── api/index.ts      # Axios 实例
│       ├── stores/           # Pinia 状态管理
│       │   ├── market.ts
│       │   ├── news.ts
│       │   └── flash.ts
│       ├── views/            # 页面组件
│       │   ├── home/Index.vue       # 首页
│       │   ├── market/Index.vue     # 行情列表
│       │   ├── market/Detail.vue    # 币种详情
│       │   ├── news/Index.vue       # 新闻列表
│       │   ├── news/Detail.vue      # 新闻详情
│       │   ├── flash/Index.vue      # 快讯列表
│       │   └── user/Index.vue       # 个人中心
│       └── layout/
│           └── DefaultLayout.vue    # TabBar 布局
```

## 2. 技术栈

| 层 | 技术 | 说明 |
|---|------|------|
| **后端运行时** | Node.js + Express + TypeScript | tsx 运行开发模式 |
| **ORM** | Prisma | SQLite 数据库（MVP） |
| **定时任务** | node-cron | 行情每 1min，RSS 每 5min |
| **HTTP 客户端** | axios | 请求外部 API + 自动重试 |
| **XML 解析** | fast-xml-parser | 解析 RSS 2.0 |
| **前端框架** | Vue 3 + TypeScript | Composition API |
| **UI 组件库** | Vant 4 | 移动端 H5 组件 |
| **构建工具** | Vite 8 | 开发服务器 + 生产构建 |
| **状态管理** | Pinia 4 | 数据缓存 |
| **路由** | Vue Router 4 | SPA 路由 |
| **自动导入** | unplugin-vue-components | Vant 组件按需导入 |

## 3. 环境要求

- **Node.js** >= 18
- **npm** >= 9

## 4. 安装与启动

### 4.1 安装依赖

```bash
# 后端依赖
cd backend && npm install

# 前端依赖
cd ../frontend && npm install
```

### 4.2 初始化数据库

```bash
cd backend

# 生成 Prisma Client
npx prisma generate

# 推送 schema 到 SQLite（无需迁移）
npx prisma db push
```

数据库文件生成在 `backend/prisma/data/crypto.db`。

### 4.3 启动开发服务器

**方式一：一键启动**

```bash
# 在项目根目录
bash start.sh
```

**方式二：分别启动**

终端 1 - 后端：
```bash
cd backend
npx tsx src/index.ts
```

终端 2 - 前端：
```bash
cd frontend
npx vite --host
```

### 4.4 访问地址

| 服务 | 地址 |
|------|------|
| 前端页面 | `http://localhost:5173` |
| 后端 API | `http://localhost:3000` |
| 健康检查 | `http://localhost:3000/api/health` |
| 同步日志 | `http://localhost:3000/api/admin/sync-status` |

> 前端 Vite 已配置 API 代理，开发时 `/api` 请求自动转发到 `localhost:3000`。

## 5. 配置说明

后端配置文件：`backend/.env`

```bash
DATABASE_URL="file:./data/crypto.db"   # SQLite 数据库路径
PORT=3000                               # HTTP 服务端口
NODE_ENV=development                    # 运行环境
```

同步与数据源配置：`backend/src/config.ts`

```typescript
{
  coinLore: {
    baseUrl: 'https://api.coinlore.net/api',  // 行情数据 API
  },
  rssSources: [
    { key: 'cointelegraph', name: 'CoinTelegraph',
      url: 'https://cointelegraph.com/rss' },
    { key: 'decrypt', name: 'Decrypt',
      url: 'https://decrypt.co/feed' },
  ],
  sync: {
    marketIntervalMinutes: 1,    // 行情同步间隔
    rssIntervalMinutes: 5,        // RSS 同步间隔
    coinPriceRetentionDays: 7,    // 历史价格保留天数
    syncLogRetentionDays: 30,     // 同步日志保留天数
  },
}
```

## 6. 数据库模型（Prisma Schema）

5 张表：`Coin`、`CoinPrice`、`NewsArticle`、`FlashNews`、`UserFavorite`、`SyncLog`

### Coin（币种）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (PK) | CoinLore 币种 ID |
| symbol | String | 交易对符号 |
| name | String | 名称 |
| image | String? | 图标 URL |
| currentPrice | Float? | 当前价格 (USD) |
| marketCap | Float? | 市值 |
| marketCapRank | Int? | 市值排名 |
| priceChangePercent1h | Float? | 1 小时涨跌幅 |
| priceChangePercent24h | Float? | 24 小时涨跌幅 |
| priceChangePercent7d | Float? | 7 天涨跌幅 |
| totalVolume | Float? | 24h 成交量 |
| circulatingSupply | Float? | 流通量 |
| totalSupply | Float? | 总供应量 |
| maxSupply | Float? | 最大供应量 |
| lastUpdated | DateTime? | 数据最后更新时间 |

### CoinPrice（价格快照）

每次同步记录一条历史价格，保留 7 天。用于生成币种详情页的 sparkline 走势图。

### NewsArticle（新闻文章）

`@@unique([url])` 防止重复。按 `publishedAt` 倒序查询。支持按 `category`（分类）和 `sourceKey`（来源）筛选。

### FlashNews（快讯）

从 RSS 标题 <= 80 字符的文章自动生成。按 `publishedAt` 倒序，使用 cursor 分页。

### UserFavorite（用户收藏）

`@@unique([userId, articleId])` 保证同一用户不重复收藏同一文章。

### SyncLog（同步日志）

记录每次同步任务的执行情况（task、status、count、duration、error），保留 30 天。

## 7. 数据同步机制

### 7.1 启动流程

```
服务启动
  → runAllSyncJobs()（并行执行行情同步 + RSS 同步）
  → startScheduler()（启动定时任务）
  → HTTP Server listen
```

### 7.2 定时任务

| 任务 | Cron 表达式 | 说明 |
|------|-------------|------|
| 行情同步 | `*/1 * * * *` | 每分钟拉取 CoinLore top 200 币种 |
| RSS 同步 | `*/5 * * * *` | 每 5 分钟拉取 CoinTelegraph + Decrypt RSS |
| 价格清理 | `0 */6 * * *` | 每 6 小时删除 7 天前的 CoinPrice 记录 |
| 日志清理 | `0 0 * * *` | 每天凌晨删除 30 天前的 SyncLog |

### 7.3 行情同步流程（syncMarket.ts）

```
1. 请求 CoinLore /api/tickers/?start=0&limit=100（第 1 页）
2. 逐币种 upsert Coin 表
3. 插入 CoinPrice 快照
4. 等待 2 秒（避免频率限制）
5. 请求 start=100&limit=100（第 2 页），共 200 个币种
```

### 7.4 RSS 同步流程（syncRSS.ts）

```
1. 依次请求每个 RSS 源
2. fast-xml-parser 解析 XML
3. 提取 title/link/description/img/category/author/pubDate
4. 逐文章 insert（重复 URL 自动跳过，P2002 错误静默处理）
5. 标题 <= 80 字符的文章自动生成 FlashNews
6. 每个 RSS 源之间等待 2 秒
```

## 8. API 接口参考

所有接口统一响应格式：

```json
{ "code": 0, "data": { ... } }
// 错误
{ "code": -1, "message": "..." }
```

### 8.1 聚合首页

**GET `/api/v1/home`** - 首页聚合数据（tickers + flash + news）

```json
{
  "code": 0,
  "data": {
    "tickers": [{ "id": "90", "symbol": "BTC", "name": "Bitcoin",
      "image": "...", "currentPrice": 87000, "priceChangePercent24h": 2.5,
      "marketCapRank": 1 }],
    "flashLatest": [{ "id": 1, "title": "...", "content": "...",
      "source": "CoinTelegraph", "url": "...", "publishedAt": "..." }],
    "recommend": [{ ... }],
    "updatedAt": "2026-07-18T..."
  }
}
```

### 8.2 行情

| 接口 | 说明 |
|------|------|
| `GET /api/v1/market/tickers` | Top 10 币种（首页横幅） |
| `GET /api/v1/market/list?page=1&pageSize=20&sortBy=market_cap&search=` | 行情列表，sortBy: `market_cap` / `price_change` / `volume` |
| `GET /api/v1/market/detail/:id` | 币种详情 + sparkline + 相关新闻 |
| `GET /api/v1/market/search?q=btc` | 快速搜索（自动补全） |

币种详情返回示例：

```json
{
  "code": 0,
  "data": {
    "coin": { "id": "90", "symbol": "BTC", "name": "Bitcoin", ... },
    "sparkline": [86700, 86800, 87000, ...],
    "minPrice": 86500,
    "maxPrice": 87200,
    "relatedNews": [{ ... }]
  }
}
```

### 8.3 新闻

| 接口 | 说明 |
|------|------|
| `GET /api/v1/news/list?page=1&pageSize=20&category=Bitcoin&sourceKey=cointelegraph` | 新闻列表，支持分类和来源筛选 |
| `GET /api/v1/news/recommend` | 最新 20 篇推荐 |
| `GET /api/v1/news/detail/:id` | 新闻详情 + 相关文章 |
| `GET /api/v1/news/search?q=bitcoin&page=1&pageSize=20` | 全文搜索（标题 + 描述） |

### 8.4 快讯

| 接口 | 说明 |
|------|------|
| `GET /api/v1/flash/list?cursor=&limit=30` | 快讯列表（cursor 分页） |
| `GET /api/v1/flash/latest?since=2026-07-18T00:00:00Z` | 增量轮询（获取 since 之后的新快讯） |

### 8.5 用户收藏

| 接口 | 说明 |
|------|------|
| `POST /api/v1/user/favorite` | 切换收藏状态，body: `{ "userId": "u1", "articleId": "xxx" }` |
| `GET /api/v1/user/favorites?userId=u1&page=1&pageSize=20` | 收藏列表 |

### 8.6 管理

| 接口 | 说明 |
|------|------|
| `GET /api/health` | 健康检查 |
| `GET /api/admin/sync-status` | 最近 100 条同步日志 |

## 9. 数据源

### 行情数据：CoinLore

- API：`https://api.coinlore.net/api/tickers/`
- 免费、无需 API Key、无速率限制
- 覆盖约 14,000 个币种
- 当前同步 top 200 个币种（MVP）
- 币种图标通过 CoinCap CDN 获取：`https://assets.coincap.io/assets/icons/{symbol}@2x.png`

### 新闻数据：RSS 订阅

| 来源 | RSS URL | 说明 |
|------|---------|------|
| CoinTelegraph | `https://cointelegraph.com/rss` | 头部区块链媒体 |
| Decrypt | `https://decrypt.co/feed` | 区块链新闻媒体 |

## 10. 前端页面路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | 首页 | 搜索栏 + ticker 滚动横幅 + 快讯 + 新闻流 |
| `/market` | 行情列表 | 搜索 + 排序 + 无限滚动 |
| `/market/:id` | 币种详情 | 价格图表 + 统计指标 + 相关新闻 |
| `/news` | 新闻列表 | 分类筛选 + 无限滚动 |
| `/news/:id` | 新闻详情 | 标题/正文/收藏/查看原文 |
| `/flash` | 快讯列表 | 时间线样式 + 30s 轮询 |
| `/user` | 个人中心 | 收藏/历史/设置/清除缓存 |

## 11. 生产构建与部署

### 后端构建

```bash
cd backend
npx tsc                          # 编译到 dist/
NODE_ENV=production node dist/index.js
```

### 前端构建

```bash
cd frontend
npm run build                    # 输出到 dist/
```

### 部署建议

1. **后端**：将 `backend/dist/` + `backend/prisma/` + `backend/package.json` 部署到服务器
   - 服务端启动：`npm start`（即 `node dist/index.js`）
   - 可使用 PM2 或 systemd 守护进程

2. **前端**：`frontend/dist/` 部署到 Nginx / CDN
   - Nginx 配置示例：将 `/api` 反向代理到后端 3000 端口，静态文件指向 `frontend/dist/`

3. **数据库升级路径**：MVP 使用 SQLite，随着数据量增长可迁移到 PostgreSQL
   - 将 `schema.prisma` 中 datasource provider 改为 `postgresql`
   - 修改 `DATABASE_URL` 环境变量
   - 执行 `prisma migrate dev` 创建迁移

## 12. 常用命令速查

```bash
# 后端开发
cd backend
npm run dev          # tsx watch 热重载
npm run db:push      # 推送 schema 到数据库
npm run db:studio    # Prisma Studio 数据库可视化

# 前端开发
cd frontend
npm run dev          # Vite 开发服务器
npm run build        # 生产构建
npm run preview      # 预览生产构建

# 一键启动
bash start.sh
```

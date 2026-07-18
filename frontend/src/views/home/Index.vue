<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../../api'

const router = useRouter()
const tickers = ref<any[]>([])
const flashList = ref<any[]>([])
const newsList = ref<any[]>([])
const loading = ref(true)
const refreshing = ref(false)
const newFlashCount = ref(0)
let flashTimer: any = null
let lastFlashTime: string | null = null

onMounted(async () => {
  await loadHome()
  lastFlashTime = new Date().toISOString()
  flashTimer = setInterval(checkNewFlash, 30000)
})

onUnmounted(() => { if (flashTimer) clearInterval(flashTimer) })

async function loadHome() {
  try {
    const res = await api.get('/home') as any
    tickers.value = res.data.tickers
    flashList.value = res.data.flashLatest
    newsList.value = res.data.recommend
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

async function checkNewFlash() {
  try {
    const params: any = {}
    if (lastFlashTime) params.since = lastFlashTime
    const res = await api.get('/flash/latest', { params }) as any
    lastFlashTime = new Date().toISOString()
    newFlashCount.value = res.data.count
  } catch (e) {}
}

function onRefresh() {
  refreshing.value = true
  loadHome().finally(() => { refreshing.value = false; newFlashCount.value = 0; lastFlashTime = new Date().toISOString() })
}

function goMarket() { router.push('/market') }
function goFlash() { router.push('/flash'); newFlashCount.value = 0 }
function goNews(id: string) { router.push(`/news/${id}`) }
function goSearch() { router.push('/market') }

function formatPrice(v: number | null) {
  if (v == null) return '--'
  if (v >= 1) return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return '$' + v.toPrecision(4)
}
</script>

<template>
  <div class="page">
    <!-- Header -->
    <div class="home-header">
      <div class="header-brand">
        <div class="brand-icon">₿</div>
        <div>
          <div class="brand-title">CryptoBoard</div>
          <div class="brand-sub">实时区块链资讯</div>
        </div>
      </div>
      <div class="header-actions">
        <van-icon name="search" size="20" @click="goSearch" />
      </div>
    </div>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh" :disabled="loading">
      <!-- Ticker Marquee -->
      <div class="section-header" @click="goMarket">
        <span class="section-title">行情概览</span>
        <span class="section-more">全部 <van-icon name="arrow" /></span>
      </div>
      <div class="ticker-scroll">
        <div v-for="t in tickers" :key="t.id" class="ticker-card" @click="router.push(`/market/${t.id}`)">
          <img :src="t.image" class="ticker-icon" @error="$event.target.style.display='none'" />
          <div class="ticker-symbol">{{ t.symbol?.toUpperCase() }}</div>
          <div class="ticker-price">{{ formatPrice(t.currentPrice) }}</div>
          <div :class="(t.priceChangePercent24h ?? 0) >= 0 ? 'price-up' : 'price-down'" class="ticker-change">
            {{ (t.priceChangePercent24h ?? 0) >= 0 ? '+' : '' }}{{ t.priceChangePercent24h?.toFixed(2) }}%
          </div>
        </div>
      </div>

      <!-- Flash Bar -->
      <div v-if="flashList.length" class="flash-bar" @click="goFlash">
        <div class="flash-icon-wrap">
          <van-icon name="fire-o" color="#ef4444" size="18" />
        </div>
        <div class="flash-content">
          <span v-if="newFlashCount > 0" class="flash-badge">{{ newFlashCount }} 条新快讯</span>
          <span v-else class="flash-text">{{ flashList[0]?.title }}</span>
        </div>
        <van-icon name="arrow" color="#ccc" />
      </div>

      <!-- News Feed -->
      <div class="section-header">
        <span class="section-title">推荐资讯</span>
      </div>
      <div class="news-feed">
        <div v-for="item in newsList" :key="item.id" class="news-card" @click="goNews(item.id)">
          <div class="news-img-wrap">
            <img v-if="item.imageUrl" :src="item.imageUrl" class="news-img" @error="$event.target.style.display='none'" />
            <div v-else class="news-img-placeholder">
              <van-icon name="newspaper-o" size="24" color="#d1d5db" />
            </div>
          </div>
          <div class="news-body">
            <div class="news-title">{{ item.title }}</div>
            <div v-if="item.description" class="news-desc text-secondary">{{ item.description }}</div>
            <div class="news-meta text-secondary">
              {{ item.sourceName }} · {{ new Date(item.publishedAt).toLocaleDateString() }}
            </div>
          </div>
        </div>
      </div>
    </van-pull-refresh>

    <van-skeleton title avatar :row="3" :loading="loading" v-for="i in 3" :key="i" />
  </div>
</template>

<style scoped>
.home-header {
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  padding: 16px 16px 14px;
  display: flex; align-items: center; justify-content: space-between;
  color: #fff;
}
.header-brand { display: flex; align-items: center; gap: 10px; }
.brand-icon {
  width: 40px; height: 40px; background: rgba(255,255,255,.2);
  border-radius: 10px; display: flex; align-items: center; justify-content: center;
  font-size: 20px; font-weight: 700;
}
.brand-title { font-size: 17px; font-weight: 700; }
.brand-sub { font-size: 11px; opacity: 0.75; }
.header-actions { display: flex; gap: 16px; }

.section-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 16px 8px;
}
.section-title { font-size: 16px; font-weight: 700; }
.section-more { font-size: 13px; color: var(--primary); display: flex; align-items: center; gap: 2px; }

.ticker-scroll {
  display: flex; overflow-x: auto; padding: 4px 12px 12px; gap: 8px;
  -webkit-overflow-scrolling: touch;
}
.ticker-scroll::-webkit-scrollbar { display: none; }
.ticker-card {
  background: #fff; border-radius: var(--radius); padding: 12px 16px;
  min-width: 110px; text-align: center; flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}
.ticker-icon { width: 36px; height: 36px; border-radius: 50%; margin-bottom: 6px; }
.ticker-symbol { font-weight: 700; font-size: 13px; color: #374151; }
.ticker-price { font-size: 15px; font-weight: 700; margin: 4px 0; color: #1f2937; }
.ticker-change { font-size: 12px; }

.flash-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; background: #fff; margin: 8px 12px 4px;
  border-radius: var(--radius); box-shadow: var(--shadow-sm);
  border-left: 3px solid #ef4444;
}
.flash-icon-wrap {
  width: 32px; height: 32px; background: var(--red-light);
  border-radius: 8px; display: flex; align-items: center; justify-content: center;
}
.flash-content { flex: 1; font-size: 13px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.flash-badge { color: #ef4444; font-weight: 600; }
.flash-text { color: #374151; }

.news-feed { padding: 0 12px; }
.news-card {
  display: flex; gap: 12px; background: #fff; border-radius: var(--radius);
  padding: 12px; margin-bottom: 8px; box-shadow: var(--shadow-sm);
}
.news-img-wrap { flex-shrink: 0; }
.news-img { width: 110px; height: 72px; border-radius: var(--radius-sm); object-fit: cover; display: block; }
.news-img-placeholder {
  width: 110px; height: 72px; border-radius: var(--radius-sm);
  background: #f3f4f6; display: flex; align-items: center; justify-content: center;
}
.news-body { flex: 1; min-width: 0; }
.news-title { font-size: 15px; font-weight: 500; line-height: 1.4; color: #1f2937; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.news-desc { font-size: 12px; margin-top: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.news-meta { margin-top: 8px; font-size: 12px; }
</style>

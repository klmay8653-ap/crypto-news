<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMarketStore } from '../../stores/market'

const router = useRouter()
const store = useMarketStore()
const activeSort = ref('market_cap')
const searchText = ref('')
const sorts = [
  { key: 'market_cap', label: '市值' },
  { key: 'price_change', label: '涨跌幅' },
  { key: 'volume', label: '成交量' },
]

onMounted(() => { store.fetchList({ page: 1 }) })

function changeSort(key: string) {
  activeSort.value = key
  store.fetchList({ page: 1, sortBy: key, search: searchText.value || undefined })
}

function onSearch() {
  store.fetchList({ page: 1, sortBy: activeSort.value, search: searchText.value || undefined })
}

function goDetail(coin: any) { router.push(`/market/${coin.id}`) }

function onLoad() {
  if (!store.hasMore) return
  store.fetchList({ page: store.page + 1, sortBy: activeSort.value, search: searchText.value || undefined })
}

function formatPrice(v: number | null) {
  if (v == null) return '--'
  if (v >= 1) return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return '$' + v.toPrecision(4)
}

function formatMarketCap(v: number | null) {
  if (v == null) return '--'
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T'
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B'
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M'
  return '$' + v.toLocaleString()
}
</script>

<template>
  <div class="page">
    <van-sticky>
      <van-search v-model="searchText" shape="round" placeholder="搜索币种" @search="onSearch" />
      <div class="sort-bar">
        <div v-for="s in sorts" :key="s.key"
          :class="['sort-item', { active: activeSort === s.key }]"
          @click="changeSort(s.key)">{{ s.label }}</div>
      </div>
    </van-sticky>

    <van-list v-model:loading="store.loading" :finished="!store.hasMore" @load="onLoad" :immediate-check="false">
      <div v-for="coin in store.list" :key="coin.id" class="coin-row" @click="goDetail(coin)">
        <div class="coin-rank" :class="{ 'top3': (coin.marketCapRank ?? 999) <= 3 }">
          {{ coin.marketCapRank }}
        </div>
        <img :src="coin.image" class="coin-icon" @error="$event.target.style.display='none'" />
        <div class="coin-info">
          <div class="coin-name">{{ coin.name }}</div>
          <div class="coin-symbol">{{ coin.symbol?.toUpperCase() }} · 市值 {{ formatMarketCap(coin.marketCap) }}</div>
        </div>
        <div class="coin-price-col">
          <div class="coin-price">{{ formatPrice(coin.currentPrice) }}</div>
          <div :class="(coin.priceChangePercent24h ?? 0) >= 0 ? 'price-up' : 'price-down'" class="coin-change">
            {{ (coin.priceChangePercent24h ?? 0) >= 0 ? '+' : '' }}{{ coin.priceChangePercent24h?.toFixed(2) }}%
          </div>
        </div>
      </div>
    </van-list>

    <van-empty v-if="!store.loading && store.list.length === 0" description="暂无数据" />
  </div>
</template>

<style scoped>
.sort-bar {
  display: flex; background: #fff; border-bottom: 1px solid var(--border);
  padding: 0 16px;
}
.sort-item {
  flex: 1; text-align: center; padding: 10px 0; font-size: 13px;
  color: var(--text-secondary); border-bottom: 2px solid transparent;
  transition: all .2s;
  cursor: pointer;
}
.sort-item.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }

.coin-row {
  display: flex; align-items: center; padding: 12px 16px; background: #fff;
  gap: 10px; border-bottom: 1px solid #f5f5f5; transition: background .15s;
  cursor: pointer;
}
.coin-row:active { background: #f9fafb; }
.coin-rank {
  width: 28px; height: 22px; font-size: 12px; color: var(--text-secondary);
  text-align: center; line-height: 22px; border-radius: 4px; font-weight: 500;
}
.coin-rank.top3 { background: var(--primary-light); color: var(--primary); font-weight: 700; }
.coin-icon { width: 36px; height: 36px; border-radius: 50%; }
.coin-info { flex: 1; min-width: 0; }
.coin-name { font-size: 15px; font-weight: 500; }
.coin-symbol { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
.coin-price-col { text-align: right; }
.coin-price { font-weight: 600; font-size: 15px; }
.coin-change { font-size: 13px; margin-top: 2px; }
</style>

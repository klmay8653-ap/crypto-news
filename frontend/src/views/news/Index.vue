<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNewsStore } from '../../stores/news'

const router = useRouter()
const store = useNewsStore()
const activeCategory = ref('')

const categories = [
  { key: '', label: '全部' },
  { key: 'Bitcoin', label: 'Bitcoin' },
  { key: 'Ethereum', label: 'Ethereum' },
  { key: 'DeFi', label: 'DeFi' },
  { key: 'NFT', label: 'NFT' },
  { key: 'Regulation', label: '政策' },
]

onMounted(() => { store.fetchList({ page: 1 }) })

function changeCat(key: string) {
  activeCategory.value = key
  store.fetchList({ page: 1, category: key || undefined })
}

function goDetail(id: string) { router.push(`/news/${id}`) }

function onLoad() {
  if (!store.hasMore) return
  store.fetchList({ page: store.page + 1, category: activeCategory.value || undefined })
}

function timeAgo(t: string) {
  const diff = Date.now() - new Date(t).getTime()
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return new Date(t).toLocaleDateString('zh-CN')
}
</script>

<template>
  <div class="page">
    <div class="news-header">
      <div class="header-title">区块链资讯</div>
      <div class="header-sub">实时追踪行业动态</div>
    </div>

    <van-sticky offset-top="0">
      <div class="cat-scroll">
        <div v-for="c in categories" :key="c.key"
          :class="['cat-chip', { active: activeCategory === c.key }]"
          @click="changeCat(c.key)">{{ c.label }}</div>
      </div>
    </van-sticky>

    <van-list v-model:loading="store.loading" :finished="!store.hasMore" @load="onLoad" :immediate-check="false">
      <div v-for="item in store.list" :key="item.id" class="news-card" @click="goDetail(item.id)">
        <div class="news-img-wrap">
          <img v-if="item.imageUrl" :src="item.imageUrl" class="news-img" @error="$event.target.style.display='none'" />
          <div v-else class="news-img-placeholder">
            <van-icon name="newspaper-o" size="24" color="#d1d5db" />
          </div>
        </div>
        <div class="news-body">
          <div class="news-title">{{ item.title }}</div>
          <div v-if="item.description" class="news-desc text-secondary">{{ item.description }}</div>
          <div class="news-meta">
            <span v-if="item.category" class="news-cat">{{ item.category }}</span>
            <span class="text-secondary">{{ item.sourceName }} · {{ timeAgo(item.publishedAt) }}</span>
          </div>
        </div>
      </div>
    </van-list>

    <van-empty v-if="!store.loading && store.list.length === 0" description="暂无资讯" />
  </div>
</template>

<style scoped>
.news-header {
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  padding: 20px 16px 16px; color: #fff;
}
.header-title { font-size: 20px; font-weight: 700; }
.header-sub { font-size: 12px; opacity: 0.75; margin-top: 4px; }

.cat-scroll {
  display: flex; gap: 8px; padding: 10px 16px; background: #fff;
  overflow-x: auto; -webkit-overflow-scrolling: touch;
  border-bottom: 1px solid var(--border);
}
.cat-scroll::-webkit-scrollbar { display: none; }
.cat-chip {
  padding: 6px 14px; border-radius: 20px; font-size: 13px;
  background: #f3f4f6; white-space: nowrap; flex-shrink: 0;
  transition: all .2s; cursor: pointer; color: #6b7280;
}
.cat-chip.active { background: var(--primary); color: #fff; font-weight: 500; }

.news-card {
  display: flex; gap: 12px; padding: 14px 16px; background: #fff;
  border-bottom: 1px solid #f5f5f5; cursor: pointer; transition: background .15s;
}
.news-card:active { background: #f9fafb; }
.news-img-wrap { flex-shrink: 0; }
.news-img { width: 110px; height: 72px; border-radius: var(--radius-sm); object-fit: cover; display: block; }
.news-img-placeholder {
  width: 110px; height: 72px; border-radius: var(--radius-sm);
  background: #f3f4f6; display: flex; align-items: center; justify-content: center;
}
.news-body { flex: 1; min-width: 0; }
.news-title { font-size: 15px; font-weight: 500; line-height: 1.4; color: #1f2937; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.news-desc { font-size: 12px; margin-top: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.news-meta { margin-top: 8px; font-size: 12px; display: flex; align-items: center; gap: 8px; }
.news-cat { background: var(--primary-light); color: var(--primary); padding: 1px 8px; border-radius: 4px; font-size: 11px; }
</style>

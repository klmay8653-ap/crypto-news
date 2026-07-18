<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showDialog } from 'vant'
import api from '../../api'

const router = useRouter()
const activeTab = ref(0)
const favorites = ref<any[]>([])
const favLoading = ref(false)
const browseHistory = ref<any[]>([])

function getUserId() {
  let id = localStorage.getItem('deviceId')
  if (!id) { id = Math.random().toString(36).slice(2); localStorage.setItem('deviceId', id) }
  return 'device-' + id
}

onMounted(async () => {
  loadHistory()
  await loadFavorites()
})

function loadHistory() {
  try {
    const raw = localStorage.getItem('browseHistory')
    browseHistory.value = raw ? JSON.parse(raw) : []
  } catch (e) { browseHistory.value = [] }
}

async function loadFavorites() {
  favLoading.value = true
  try {
    const res = await api.get('/user/favorites', { params: { userId: getUserId(), page: 1, pageSize: 100 } }) as any
    const rawList = res.data.list || []
    favorites.value = rawList.map((f: any) => f.article || f)
  } catch (e) { console.error(e) }
  finally { favLoading.value = false }
}

const stats = computed(() => [
  { label: '我的收藏', value: favorites.value.length, icon: 'star-o', color: '#f59e0b' },
  { label: '浏览历史', value: browseHistory.value.length, icon: 'clock-o', color: '#3b82f6' },
])

async function removeFavorite(article: any) {
  try {
    await api.post('/user/favorite', { userId: getUserId(), articleId: article.id })
    favorites.value = favorites.value.filter((f: any) => f.id !== article.id)
    showToast('已取消收藏')
  } catch (e) { showToast('操作失败') }
}

function clearHistory() {
  showDialog({ title: '确认', message: '确定要清除浏览历史吗？' }).then(() => {
    localStorage.removeItem('browseHistory')
    browseHistory.value = []
    showToast('历史已清除')
  }).catch(() => {})
}

function clearCache() {
  showDialog({ title: '确认', message: '确定要清除所有缓存数据吗？' }).then(() => {
    localStorage.clear()
    browseHistory.value = []
    favorites.value = []
    showToast('缓存已清除')
    // Restore deviceId
    const id = Math.random().toString(36).slice(2)
    localStorage.setItem('deviceId', id)
  }).catch(() => {})
}

function goNews(id: string) { router.push(`/news/${id}`) }

function formatTime(t: string) {
  const d = new Date(t)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return d.toLocaleDateString('zh-CN')
}
</script>

<template>
  <div class="page">
    <!-- User Header -->
    <div class="user-header">
      <div class="user-avatar">
        <van-icon name="user-circle-o" size="56" color="#fff" />
      </div>
      <div class="user-name">区块链资讯用户</div>
      <div class="user-id">ID: {{ getUserId().slice(-8) }}</div>
    </div>

    <!-- Stats -->
    <div class="stats-row">
      <div v-for="s in stats" :key="s.label" class="stat-card">
        <van-icon :name="s.icon" :color="s.color" size="22" />
        <div class="stat-num">{{ s.value }}</div>
        <div class="stat-label">{{ s.label }}</div>
      </div>
    </div>

    <!-- Tabs: Favorites / History -->
    <van-tabs v-model:active="activeTab" sticky offset-top="0" class="user-tabs">
      <van-tab title="我的收藏">
        <van-loading v-if="favLoading" class="loading-wrap" />
        <van-empty v-else-if="favorites.length === 0" description="暂无收藏" />
        <div v-else class="list-wrap">
          <div v-for="item in favorites" :key="item.id" class="list-card" @click="goNews(item.id)">
            <img v-if="item.imageUrl" :src="item.imageUrl" class="list-img" />
            <div class="list-body">
              <div class="list-title">{{ item.title }}</div>
              <div class="list-meta">{{ item.sourceName }} · {{ formatTime(item.publishedAt) }}</div>
            </div>
            <van-icon name="cross" class="del-btn" @click.stop="removeFavorite(item)" />
          </div>
        </div>
      </van-tab>
      <van-tab title="浏览历史">
        <van-empty v-if="browseHistory.length === 0" description="暂无浏览记录" />
        <div v-else class="list-wrap">
          <div v-for="item in browseHistory" :key="item.id" class="list-card" @click="goNews(item.id)">
            <img v-if="item.imageUrl" :src="item.imageUrl" class="list-img" />
            <div class="list-body">
              <div class="list-title">{{ item.title }}</div>
              <div class="list-meta">{{ formatTime(item.viewedAt) }} 浏览</div>
            </div>
          </div>
          <div class="clear-row">
            <van-button size="small" type="default" @click="clearHistory">清除历史</van-button>
          </div>
        </div>
      </van-tab>
    </van-tabs>

    <!-- Actions -->
    <div class="action-section">
      <van-cell-group inset>
        <van-cell title="清除缓存" icon="delete-o" is-link @click="clearCache" />
        <van-cell title="关于" icon="info-o" is-link @click="showDialog({ title: '关于', message: '区块链资讯 H5 v1.0\n\n基于 Vue 3 + Vant 4 构建\n数据来源: CoinLore, CoinTelegraph, Decrypt' })" />
      </van-cell-group>
    </div>
  </div>
</template>

<style scoped>
.user-header {
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  padding: 32px 20px 24px;
  text-align: center;
  color: #fff;
}
.user-avatar {
  width: 64px; height: 64px;
  background: rgba(255,255,255,.2);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 10px;
}
.user-name { font-size: 18px; font-weight: 600; }
.user-id { font-size: 12px; opacity: 0.7; margin-top: 4px; }

.stats-row {
  display: flex; gap: 12px;
  padding: 16px; margin-top: -12px;
}
.stat-card {
  flex: 1; background: #fff; border-radius: 12px;
  padding: 16px 12px; text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
}
.stat-num { font-size: 22px; font-weight: 700; margin: 6px 0 2px; }
.stat-label { font-size: 12px; color: var(--text-secondary); }

.user-tabs { margin-top: 4px; }
.loading-wrap { display: flex; justify-content: center; padding: 40px; }

.list-wrap { padding: 0 16px; }
.list-card {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 0; border-bottom: 1px solid #f0f0f0;
  position: relative;
}
.list-img { width: 80px; height: 52px; border-radius: 6px; object-fit: cover; flex-shrink: 0; background: #f0f0f0; }
.list-body { flex: 1; min-width: 0; }
.list-title { font-size: 14px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.list-meta { font-size: 12px; color: var(--text-secondary); margin-top: 6px; }
.del-btn { color: #ccc; flex-shrink: 0; padding: 4px; }
.clear-row { text-align: center; padding: 16px 0; }

.action-section { padding: 16px; }
</style>

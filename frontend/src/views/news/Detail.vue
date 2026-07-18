<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNewsStore } from '../../stores/news'
import api from '../../api'

const route = useRoute()
const router = useRouter()
const store = useNewsStore()
const favorited = ref(false)

function getUserId() {
  let id = localStorage.getItem('deviceId')
  if (!id) { id = Math.random().toString(36).slice(2); localStorage.setItem('deviceId', id) }
  return 'device-' + id
}
const userId = ref(getUserId())

function saveHistory(article: any) {
  try {
    const raw = localStorage.getItem('browseHistory')
    const history: any[] = raw ? JSON.parse(raw) : []
    const idx = history.findIndex((h: any) => h.id === article.id)
    if (idx >= 0) history.splice(idx, 1)
    history.unshift({ id: article.id, title: article.title, sourceName: article.sourceName, imageUrl: article.imageUrl, publishedAt: article.publishedAt, viewedAt: new Date().toISOString() })
    if (history.length > 50) history.length = 50
    localStorage.setItem('browseHistory', JSON.stringify(history))
  } catch (e) {}
}

onMounted(async () => {
  await store.fetchDetail(route.params.id as string)
  if (store.currentArticle) saveHistory(store.currentArticle)
})

function goBack() { router.back() }
function goNews(id: string) { router.push(`/news/${id}`) }
function openOriginal() { if (store.currentArticle?.url) window.open(store.currentArticle.url) }

async function toggleFavorite() {
  if (!store.currentArticle) return
  try {
    const res = await api.post('/user/favorite', { userId: userId.value, articleId: store.currentArticle.id }) as any
    favorited.value = res.data.favorited
  } catch (e) { console.error(e) }
}
</script>

<template>
  <div class="page">
    <van-nav-bar left-arrow @click-left="goBack" fixed placeholder>
      <template #title>
        <span class="nav-title-text">资讯详情</span>
      </template>
      <template #right>
        <van-icon :name="favorited ? 'star' : 'star-o'" size="22" @click="toggleFavorite"
          :color="favorited ? 'var(--orange)' : '#999999'" />
      </template>
    </van-nav-bar>

    <div v-if="store.currentArticle" class="article-content">
      <h1 class="article-title">{{ store.currentArticle.title }}</h1>
      <div class="article-meta">
        <span class="meta-source">{{ store.currentArticle.sourceName }}</span>
        <span class="meta-divider">·</span>
        <span v-if="store.currentArticle.author" class="meta-author">{{ store.currentArticle.author }}</span>
        <span v-if="store.currentArticle.author" class="meta-divider">·</span>
        <span class="meta-time">{{ new Date(store.currentArticle.publishedAt).toLocaleString('zh-CN') }}</span>
        <span v-if="store.currentArticle.category" class="meta-cat">{{ store.currentArticle.category }}</span>
      </div>

      <div class="article-img-wrap" v-if="store.currentArticle.imageUrl">
        <img :src="store.currentArticle.imageUrl" class="article-img" @error="$event.target.style.display='none'" />
      </div>

      <div class="article-desc" v-if="store.currentArticle.description">
        {{ store.currentArticle.description }}
      </div>

      <div class="article-actions">
        <van-button type="primary" block round @click="openOriginal">
          <van-icon name="link-o" /> 查看原文
        </van-button>
      </div>

      <!-- Related -->
      <div v-if="store.relatedArticles.length" class="related-section">
        <div class="related-header">相关推荐</div>
        <div v-for="r in store.relatedArticles" :key="r.id" class="related-item" @click="goNews(r.id)">
          <img v-if="r.imageUrl" :src="r.imageUrl" class="related-img" @error="$event.target.style.display='none'" />
          <div class="related-body">
            <div class="related-title">{{ r.title }}</div>
            <div class="text-secondary">{{ r.sourceName }}</div>
          </div>
          <van-icon name="arrow" color="#ccc" />
        </div>
      </div>
    </div>

    <van-skeleton title :row="6" :loading="!store.currentArticle" />
  </div>
</template>

<style scoped>
.nav-title-text { font-size: 16px; }

.article-content { padding: 16px; }
.article-title { font-size: 22px; font-weight: 700; line-height: 1.5; color: #1f2937; margin-bottom: 12px; }
.article-meta { font-size: 13px; color: var(--text-secondary); margin-bottom: 18px; display: flex; align-items: center; flex-wrap: wrap; gap: 2px; }
.meta-divider { margin: 0 6px; }
.meta-source { color: var(--primary); font-weight: 500; }
.meta-cat { background: #f3f4f6; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px; }

.article-img-wrap { margin-bottom: 18px; border-radius: var(--radius); overflow: hidden; }
.article-img { width: 100%; display: block; }
.article-desc { font-size: 16px; line-height: 1.8; color: #374151; margin-bottom: 24px; word-break: break-word; }
.article-actions { margin-bottom: 28px; }

.related-section { border-top: 1px solid #f0f0f0; padding-top: 18px; }
.related-header { font-size: 17px; font-weight: 700; margin-bottom: 14px; color: #1f2937; }
.related-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f9f9f9; cursor: pointer; }
.related-img { width: 60px; height: 40px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
.related-body { flex: 1; min-width: 0; }
.related-title { font-size: 14px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style>

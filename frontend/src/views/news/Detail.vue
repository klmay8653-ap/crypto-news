<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNewsStore } from '../../stores/news'
import api from '../../api'

const route = useRoute()
const router = useRouter()
const store = useNewsStore()
const favorited = ref(false)
const showFullContent = ref(false)
const fullContent = ref('')
const loadingContent = ref(false)

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

async function loadArticle(id: string) {
  await store.fetchDetail(id)
  if (store.currentArticle) saveHistory(store.currentArticle)
  showFullContent.value = false
  fullContent.value = ''
}

onMounted(() => loadArticle(route.params.id as string))

// Fix: watch route param changes so related article clicks work
watch(() => route.params.id, (newId) => {
  if (newId) loadArticle(newId as string)
})

function goBack() { router.back() }
function goNews(id: string) { router.push(`/news/${id}`) }

async function loadFullContent() {
  if (!store.currentArticle) return
  loadingContent.value = true
  showFullContent.value = true
  try {
    const res = await api.get(`/news/content/${store.currentArticle.id}`) as any
    fullContent.value = res.data.content
  } catch (e) {
    console.error(e)
  } finally {
    loadingContent.value = false
  }
}

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

      <div class="article-desc" v-if="store.currentArticle.description && !showFullContent">
        {{ store.currentArticle.description }}
      </div>

      <div class="article-actions" v-if="!showFullContent">
        <van-button type="primary" block round @click="loadFullContent" :loading="loadingContent">
          <van-icon name="description-o" /> 阅读全文
        </van-button>
      </div>

      <!-- Full content -->
      <div v-if="showFullContent" class="article-full">
        <van-skeleton :row="8" :loading="loadingContent">
          <div class="full-content" v-html="fullContent" />
        </van-skeleton>
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

.article-full { margin-bottom: 28px; }
.full-content { font-size: 16px; line-height: 1.8; color: #374151; word-break: break-word; overflow-wrap: break-word; }
.full-content :deep(img) { max-width: 100%; height: auto; border-radius: 8px; margin: 12px 0; }
.full-content :deep(p) { margin: 0 0 12px; }
.full-content :deep(h1), .full-content :deep(h2), .full-content :deep(h3) { margin: 16px 0 10px; color: #1f2937; }
.full-content :deep(a) { color: var(--primary); word-break: break-all; }
.full-content :deep(blockquote) { border-left: 3px solid var(--primary); padding-left: 12px; margin: 12px 0; color: #6b7280; }
.full-content :deep(ul), .full-content :deep(ol) { padding-left: 20px; margin: 8px 0; }
.full-content :deep(pre) { background: #f3f4f6; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 14px; }
.full-content :deep(table) { width: 100%; border-collapse: collapse; margin: 12px 0; }
.full-content :deep(th), .full-content :deep(td) { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }

.related-section { border-top: 1px solid #f0f0f0; padding-top: 18px; }
.related-header { font-size: 17px; font-weight: 700; margin-bottom: 14px; color: #1f2937; }
.related-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f9f9f9; cursor: pointer; }
.related-img { width: 60px; height: 40px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
.related-body { flex: 1; min-width: 0; }
.related-title { font-size: 14px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useFlashStore } from '../../stores/flash'

const store = useFlashStore()
const newCount = ref(0)
let pollTimer: any = null

onMounted(async () => {
  await store.fetchList(true)
  pollTimer = setInterval(async () => {
    const n = await store.fetchLatest()
    if (n > 0) newCount.value += n
  }, 30000)
})

onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
  newCount.value = 0
  store.fetchList(true)
}

function onLoad() {
  if (!store.hasMore) return
  store.fetchList()
}

function formatTime(t: string) {
  const d = new Date(t)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) {
    return d.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="page">
    <div class="flash-header">
      <div class="header-title">
        <van-icon name="flash-o" size="22" />
        闪电快讯
      </div>
      <div class="header-sub">实时追踪，快人一步</div>
    </div>

    <div v-if="newCount > 0" class="new-tip" @click="scrollToTop">
      <van-icon name="arrow-up" /> {{ newCount }} 条新快讯，点击刷新
    </div>

    <van-list @load="onLoad" :finished="!store.hasMore" :immediate-check="false">
      <div v-for="(item, idx) in store.list" :key="item.id" class="flash-item-wrap">
        <div class="timeline">
          <div class="time-dot" :class="{ latest: idx === 0 }" />
          <div v-if="idx < store.list.length - 1" class="time-line" />
        </div>
        <div class="flash-card">
          <div class="flash-time">
            <van-icon name="clock-o" size="12" />
            {{ formatTime(item.publishedAt) }}
          </div>
          <div class="flash-title">{{ item.title }}</div>
          <div v-if="item.content" class="flash-content">{{ item.content }}</div>
          <div v-if="item.source" class="flash-source">
            <span>{{ item.source }}</span>
            <a v-if="item.url" :href="item.url" target="_blank" class="source-link">查看详情</a>
          </div>
        </div>
      </div>
    </van-list>

    <van-empty v-if="store.list.length === 0" description="暂无快讯">
      <van-icon name="flash-o" size="48" color="var(--border)" />
    </van-empty>
  </div>
</template>

<style scoped>
.flash-header {
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  padding: 20px 16px 16px; color: #fff;
}
.header-title { font-size: 20px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.header-sub { font-size: 12px; opacity: 0.75; margin-top: 4px; }

.new-tip {
  position: sticky; top: 0; z-index: 10;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  color: #fff; text-align: center; padding: 10px; font-size: 14px;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  cursor: pointer; font-weight: 500;
  box-shadow: 0 2px 8px rgba(59,130,246,.3);
}

.flash-item-wrap { display: flex; gap: 12px; padding: 0 12px; margin-bottom: 8px; }
.timeline { display: flex; flex-direction: column; align-items: center; width: 16px; flex-shrink: 0; padding-top: 16px; }
.time-dot {
  width: 12px; height: 12px; border-radius: 50%; background: #d1d5db;
  flex-shrink: 0; transition: background .2s;
}
.time-dot.latest { background: var(--primary); box-shadow: 0 0 0 4px var(--primary-light); }
.time-line { width: 1.5px; flex: 1; background: #f0f0f0; margin-top: 2px; }

.flash-card {
  flex: 1; min-width: 0; padding: 14px;
  background: var(--card); border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  transition: background .15s;
}
.flash-card:active { background: #f9fafb; }
.flash-time {
  font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;
  display: flex; align-items: center; gap: 4px;
}
.flash-title { font-size: 15px; font-weight: 500; line-height: 1.5; color: #1f2937; }
.flash-content { margin-top: 8px; font-size: 13px; line-height: 1.6; color: var(--text-secondary); }
.flash-source { margin-top: 10px; font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 10px; padding-top: 8px; border-top: 1px solid #f5f5f5; }
.source-link { color: var(--primary); text-decoration: none; font-weight: 500; }
</style>

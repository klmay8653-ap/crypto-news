<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

defineProps<{ showTabBar: boolean }>()

const router = useRouter()
const route = useRoute()

const tabs = [
  { name: 'home', label: '首页', icon: 'home-o', path: '/' },
  { name: 'market', label: '行情', icon: 'chart-trending-o', path: '/market' },
  { name: 'flash', label: '快讯', icon: 'fire-o', path: '/flash' },
  { name: 'user', label: '我的', icon: 'user-o', path: '/user' },
]

const active = computed(() => tabs.findIndex((t) => route.path === t.path || (t.path !== '/' && route.path.startsWith(t.path))))
const onChange = (idx: number) => router.push(tabs[idx].path)
</script>

<template>
  <div class="layout">
    <main><slot /></main>
    <van-tabbar v-if="showTabBar" :model-value="active >= 0 ? active : 0" @change="onChange" safe-area-inset-bottom fixed>
      <van-tabbar-item v-for="t in tabs" :key="t.name" :icon="t.icon">{{ t.label }}</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<style scoped>
.layout { min-height: 100vh; background: var(--bg); }
main { padding-bottom: 60px; }
</style>

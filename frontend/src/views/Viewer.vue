<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const url = computed(() => {
  const u = route.query.url as string
  if (!u) return ''
  try {
    return decodeURIComponent(u)
  } catch {
    return u
  }
})

const title = computed(() => {
  return (route.query.title as string) || '查看详情'
})

function goBack() {
  router.back()
}
</script>

<template>
  <div class="page">
    <van-nav-bar :title="title" left-arrow fixed placeholder @click-left="goBack" />

    <div v-if="url" class="iframe-wrap">
      <iframe :src="url" frameborder="0" class="content-iframe" sandbox="allow-scripts allow-same-origin" />
    </div>

    <van-empty v-else description="无效链接">
      <van-button type="primary" size="small" @click="goBack">返回</van-button>
    </van-empty>
  </div>
</template>

<style scoped>
.iframe-wrap {
  position: fixed;
  top: 46px;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
}
.content-iframe {
  width: 100%;
  height: 100%;
  border: none;
}
</style>

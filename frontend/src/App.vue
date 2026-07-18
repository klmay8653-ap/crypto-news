<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import DefaultLayout from './layout/DefaultLayout.vue'

const route = useRoute()
const showTabBar = computed(() => {
  const noTabRoutes = ['newsDetail', 'marketDetail']
  return !noTabRoutes.includes(route.name as string)
})
</script>

<template>
  <DefaultLayout :show-tab-bar="showTabBar">
    <router-view v-slot="{ Component }">
      <keep-alive include="home,market,news,flash">
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </DefaultLayout>
</template>

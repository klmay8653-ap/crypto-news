import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/home/Index.vue') },
  { path: '/flash', name: 'flash', component: () => import('../views/flash/Index.vue') },
  { path: '/market', name: 'market', component: () => import('../views/market/Index.vue') },
  { path: '/market/:id', name: 'marketDetail', component: () => import('../views/market/Detail.vue') },
  { path: '/news', name: 'news', component: () => import('../views/news/Index.vue') },
  { path: '/news/:id', name: 'newsDetail', component: () => import('../views/news/Detail.vue') },
  { path: '/viewer', name: 'viewer', component: () => import('../views/Viewer.vue') },
  { path: '/user', name: 'user', component: () => import('../views/user/Index.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router

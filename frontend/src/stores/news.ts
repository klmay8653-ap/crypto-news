import { defineStore } from 'pinia'
import api from '../api'

interface Article {
  id: string; sourceKey: string; sourceName: string;
  title: string; url: string; description: string | null;
  imageUrl: string | null; category: string | null;
  author: string | null; publishedAt: string;
}

export const useNewsStore = defineStore('news', {
  state: () => ({
    list: [] as Article[],
    currentArticle: null as Article | null,
    relatedArticles: [] as Article[],
    page: 1,
    hasMore: true,
    total: 0,
    category: null as string | null,
    loading: false,
  }),

  actions: {
    async fetchList(params: { page?: number; category?: string; sourceKey?: string } = {}) {
      this.loading = true
      try {
        const res = await api.get('/news/list', { params: { pageSize: 20, ...params } }) as any
        if (params.page === 1) {
          this.list = res.data.list
        } else {
          this.list.push(...res.data.list)
        }
        this.total = res.data.total
        this.page = res.data.page
        this.hasMore = res.data.hasMore
      } catch (e) {
        console.error(e)
      } finally {
        this.loading = false
      }
    },

    async fetchDetail(id: string) {
      try {
        const res = await api.get(`/news/detail/${id}`) as any
        this.currentArticle = res.data.article
        this.relatedArticles = res.data.related || []
      } catch (e) {
        console.error(e)
      }
    },

    async search(q: string, page = 1) {
      try {
        const res = await api.get('/news/search', { params: { q, page, pageSize: 20 } }) as any
        return res.data
      } catch (e) {
        console.error(e)
        return { list: [], total: 0, hasMore: false }
      }
    },
  },
})

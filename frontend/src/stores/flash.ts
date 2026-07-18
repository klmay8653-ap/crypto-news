import { defineStore } from 'pinia'
import api from '../api'

interface Flash {
  id: number; title: string; content: string | null;
  source: string | null; url: string | null; publishedAt: string;
}

export const useFlashStore = defineStore('flash', {
  state: () => ({
    list: [] as Flash[],
    cursor: null as string | null,
    hasMore: true,
    lastFetchTime: null as string | null,
  }),

  actions: {
    async fetchList(reset = false) {
      try {
        const params: any = { limit: 30 }
        if (!reset && this.cursor) params.cursor = this.cursor
        const res = await api.get('/flash/list', { params }) as any
        if (reset) {
          this.list = res.data.list
        } else {
          this.list.push(...res.data.list)
        }
        this.cursor = res.data.nextCursor
        this.hasMore = res.data.hasMore
      } catch (e) {
        console.error(e)
      }
    },

    async fetchLatest() {
      try {
        const params: any = {}
        if (this.lastFetchTime) params.since = this.lastFetchTime
        const res = await api.get('/flash/latest', { params }) as any
        this.lastFetchTime = new Date().toISOString()
        if (res.data.count > 0) return res.data.count
        return 0
      } catch (e) {
        console.error(e)
        return 0
      }
    },
  },
})

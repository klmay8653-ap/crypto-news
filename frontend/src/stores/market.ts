import { defineStore } from 'pinia'
import api from '../api'

interface Coin {
  id: string; symbol: string; name: string; image: string | null;
  currentPrice: number | null; marketCap: number | null;
  marketCapRank: number | null;
  priceChangePercent24h: number | null;
  priceChangePercent1h: number | null;
  priceChangePercent7d: number | null;
  totalVolume: number | null;
}

export const useMarketStore = defineStore('market', {
  state: () => ({
    tickers: [] as Coin[],
    list: [] as Coin[],
    total: 0,
    page: 1,
    hasMore: true,
    currentCoin: null as any,
    sparkline: [] as number[],
    loading: false,
    error: null as string | null,
  }),

  actions: {
    async fetchTickers() {
      try {
        const res = await api.get('/market/tickers') as any
        this.tickers = res.data.list
      } catch (e: any) {
        this.error = e.message
      }
    },

    async fetchList(params: { page?: number; sortBy?: string; search?: string } = {}) {
      this.loading = true
      try {
        const res = await api.get('/market/list', { params: { pageSize: 20, ...params } }) as any
        if (params.page === 1) {
          this.list = res.data.list
        } else {
          this.list.push(...res.data.list)
        }
        this.total = res.data.total
        this.page = res.data.page
        this.hasMore = res.data.hasMore
      } catch (e: any) {
        this.error = e.message
      } finally {
        this.loading = false
      }
    },

    async fetchDetail(id: string) {
      try {
        const res = await api.get(`/market/detail/${id}`) as any
        this.currentCoin = res.data.coin
        this.sparkline = res.data.sparkline || []
      } catch (e: any) {
        this.error = e.message
      }
    },
  },
})

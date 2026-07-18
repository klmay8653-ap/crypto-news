<script setup lang="ts">
import { onMounted, onUnmounted, watch, computed, ref, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMarketStore } from '../../stores/market'

const route = useRoute()
const router = useRouter()
const store = useMarketStore()

onMounted(() => { store.fetchDetail(route.params.id as string) })
watch(() => route.params.id, (id) => { if (id) store.fetchDetail(id as string) })

const coin = computed(() => store.currentCoin)
const sparkline = computed(() => store.sparkline)

const MAX_POINTS = 150

const sampled = computed(() => {
  const data = sparkline.value
  if (data.length <= MAX_POINTS) return data
  const step = data.length / MAX_POINTS
  const result: number[] = []
  for (let i = 0; i < MAX_POINTS; i++) {
    result.push(data[Math.floor(i * step)])
  }
  result.push(data[data.length - 1])
  return result
})

const pctChanges = computed(() => {
  const data = sampled.value
  if (data.length === 0) return []
  const base = data[0]
  return data.map((p) => ((p - base) / base) * 100)
})

const chartStats = computed(() => {
  const changes = pctChanges.value
  if (changes.length < 2) return null
  return {
    current: changes[changes.length - 1],
    high: Math.max(...changes),
    low: Math.min(...changes),
  }
})

const changes = computed(() => [
  { label: '1h', value: coin.value?.priceChangePercent1h },
  { label: '24h', value: coin.value?.priceChangePercent24h },
  { label: '7d', value: coin.value?.priceChangePercent7d },
])

const canvasRef = ref<HTMLCanvasElement | null>(null)
const chartContainer = ref<HTMLDivElement | null>(null)
let resizeObs: ResizeObserver | null = null

function niceTicks(min: number, max: number, count = 5) {
  const range = max - min || 1
  const roughStep = range / (count - 1)
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)))
  const norm = roughStep / mag
  let step: number
  if (norm <= 1.5) step = 1 * mag
  else if (norm <= 3) step = 2 * mag
  else if (norm <= 7) step = 5 * mag
  else step = 10 * mag

  const niceMin = Math.floor(min / step) * step
  const niceMax = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) {
    ticks.push(Math.round(v * 1e6) / 1e6)
  }
  return ticks
}

function drawChart() {
  const canvas = canvasRef.value
  if (!canvas) return
  const data = pctChanges.value
  if (data.length < 2) return

  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  canvas.style.width = rect.width + 'px'
  canvas.style.height = rect.height + 'px'
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  const W = rect.width
  const H = rect.height
  const pad = { top: 16, right: 8, bottom: 24, left: 46 }
  const cw = W - pad.left - pad.right
  const ch = H - pad.top - pad.bottom

  ctx.clearRect(0, 0, W, H)

  const maxV = Math.max(...data, 0)
  const minV = Math.min(...data, 0)
  const vRange = maxV - minV || 1
  const yPad = vRange * 0.2 || 1
  const yMax = maxV + yPad
  const yMin = minV - yPad
  const yRange = yMax - yMin

  const toY = (v: number) => pad.top + ch - ((v - yMin) / yRange) * ch

  // Grid lines + Y labels
  const ticks = niceTicks(yMin, yMax, 5)
  ctx.strokeStyle = '#f3f4f6'
  ctx.lineWidth = 1
  ctx.fillStyle = '#9ca3af'
  ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif'
  ctx.textAlign = 'right'
  for (const t of ticks) {
    const y = toY(t)
    ctx.beginPath()
    ctx.moveTo(pad.left, y)
    ctx.lineTo(W - pad.right, y)
    ctx.stroke()
    ctx.fillText(t.toFixed(1) + '%', pad.left - 6, y + 3)
  }

  // 0% baseline (dashed)
  const zeroY = toY(0)
  ctx.strokeStyle = '#d1d5db'
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(pad.left, zeroY)
  ctx.lineTo(W - pad.right, zeroY)
  ctx.stroke()
  ctx.setLineDash([])

  // Gradient fill
  const isUp = data[data.length - 1] >= 0
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch)
  const color = isUp ? '22, 163, 74' : '220, 38, 38'
  grad.addColorStop(0, `rgba(${color}, 0.25)`)
  grad.addColorStop(1, `rgba(${color}, 0.02)`)

  const stepX = cw / (data.length - 1)
  ctx.beginPath()
  ctx.moveTo(pad.left, toY(data[0]))
  for (let i = 1; i < data.length; i++) {
    ctx.lineTo(pad.left + stepX * i, toY(data[i]))
  }
  ctx.lineTo(pad.left + stepX * (data.length - 1), pad.top + ch)
  ctx.lineTo(pad.left, pad.top + ch)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()

  // Line
  ctx.beginPath()
  ctx.moveTo(pad.left, toY(data[0]))
  for (let i = 1; i < data.length; i++) {
    ctx.lineTo(pad.left + stepX * i, toY(data[i]))
  }
  ctx.strokeStyle = isUp ? '#16a34a' : '#dc2626'
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.stroke()

  // End dot + label
  const lastX = pad.left + stepX * (data.length - 1)
  const lastY = toY(data[data.length - 1])
  ctx.beginPath()
  ctx.arc(lastX, lastY, 4, 0, Math.PI * 2)
  ctx.fillStyle = isUp ? '#16a34a' : '#dc2626'
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  ctx.stroke()

  const label = (data[data.length - 1] >= 0 ? '+' : '') + data[data.length - 1].toFixed(2) + '%'
  ctx.fillStyle = '#374151'
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif'
  const labelX = lastX > W - 60 ? lastX - 8 : lastX + 8
  ctx.textAlign = lastX > W - 60 ? 'right' : 'left'
  ctx.fillText(label, labelX, lastY - 8)
}

watch(pctChanges, () => { nextTick(drawChart) })

onMounted(() => {
  if (chartContainer.value) {
    resizeObs = new ResizeObserver(() => { drawChart() })
    resizeObs.observe(chartContainer.value)
  }
})

onUnmounted(() => {
  resizeObs?.disconnect()
})

function goBack() { router.back() }
function goNews(id: string) { router.push(`/news/${id}`) }

function formatBig(v: number | null, unit: string) {
  if (v == null) return '--'
  if (v >= 1e12) return (v / 1e12).toFixed(2) + 'T ' + unit
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B ' + unit
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M ' + unit
  return v.toLocaleString() + ' ' + unit
}

function formatPrice(v: number | null) {
  if (v == null) return '--'
  if (v >= 1) return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return '$' + v.toPrecision(6)
}
</script>

<template>
  <div class="page">
    <van-nav-bar left-arrow @click-left="goBack" fixed placeholder>
      <template #title>
        <div class="nav-title">
          <img v-if="coin?.image" :src="coin.image" class="nav-icon" @error="($event.target as HTMLImageElement).style.display='none'" />
          <span>{{ coin?.name || '详情' }}</span>
        </div>
      </template>
    </van-nav-bar>

    <div v-if="coin" class="detail-content">
      <!-- Price Header -->
      <div class="price-header">
        <div class="price-tag">{{ coin.symbol?.toUpperCase() }}/USD</div>
        <div class="price-value">{{ formatPrice(coin.currentPrice) }}</div>
        <div class="change-row">
          <div v-for="c in changes" :key="c.label" class="change-chip" :class="(c.value ?? 0) >= 0 ? 'up' : 'down'">
            <span class="change-label">{{ c.label }}</span>
            <span>{{ (c.value ?? 0) >= 0 ? '+' : '' }}{{ c.value?.toFixed(2) ?? '--' }}%</span>
          </div>
        </div>
      </div>

      <!-- Chart -->
      <div v-if="sparkline.length > 1" class="chart-card">
        <div class="chart-header">
          <div class="card-title">7 天走势</div>
          <div v-if="chartStats" class="chart-summary" :class="chartStats.current >= 0 ? 'up' : 'down'">
            {{ chartStats.current >= 0 ? '+' : '' }}{{ chartStats.current.toFixed(2) }}%
          </div>
        </div>
        <div ref="chartContainer" class="chart-canvas-wrap">
          <canvas ref="canvasRef"></canvas>
        </div>
        <div v-if="chartStats" class="chart-stats-row">
          <span>最高 <b :class="chartStats.high >= 0 ? 'up' : 'down'">{{ chartStats.high >= 0 ? '+' : '' }}{{ chartStats.high.toFixed(2) }}%</b></span>
          <span>最低 <b :class="chartStats.low >= 0 ? 'up' : 'down'">{{ chartStats.low >= 0 ? '+' : '' }}{{ chartStats.low.toFixed(2) }}%</b></span>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="card-title">市场数据</div>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-label">市值排名</div>
          <div class="stat-value accent">#{{ coin.marketCapRank }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">市值</div>
          <div class="stat-value">{{ formatBig(coin.marketCap, '') }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">24h 成交量</div>
          <div class="stat-value">{{ formatBig(coin.totalVolume, '') }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">流通量</div>
          <div class="stat-value">{{ formatBig(coin.circulatingSupply, '') }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">总供应量</div>
          <div class="stat-value">{{ formatBig(coin.totalSupply, '') }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">最大供应量</div>
          <div class="stat-value">{{ formatBig(coin.maxSupply, '') }}</div>
        </div>
      </div>
    </div>

    <van-skeleton title :row="4" :loading="!coin" />
  </div>
</template>

<style scoped>
.nav-title { display: flex; align-items: center; gap: 6px; }
.nav-icon { width: 24px; height: 24px; border-radius: 50%; }

.detail-content { padding: 16px; }
.price-header { text-align: center; padding: 20px 0 24px; }
.price-tag { font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; }
.price-value { font-size: 32px; font-weight: 800; color: #1f2937; }
.change-row { display: flex; justify-content: center; gap: 8px; margin-top: 14px; }
.change-chip {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 8px 16px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500;
}
.change-chip.up { background: var(--green-light); color: var(--green); }
.change-chip.down { background: var(--red-light); color: var(--red); }
.change-label { font-size: 11px; opacity: 0.7; }

/* Chart */
.chart-card { background: #fff; border-radius: var(--radius); padding: 16px; margin-bottom: 16px; box-shadow: var(--shadow-sm); }
.card-title { font-size: 14px; font-weight: 600; color: #374151; }
.chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.chart-summary { font-size: 15px; font-weight: 700; }
.chart-summary.up { color: var(--green); }
.chart-summary.down { color: var(--red); }
.chart-canvas-wrap { width: 100%; height: 180px; }
.chart-canvas-wrap canvas { display: block; width: 100%; height: 100%; }
.chart-stats-row { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); margin-top: 6px; }
.chart-stats-row b.up { color: var(--green); font-weight: 600; }
.chart-stats-row b.down { color: var(--red); font-weight: 600; }

/* Stats */
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.stat-item { background: #fff; border-radius: var(--radius-sm); padding: 14px; text-align: center; box-shadow: var(--shadow-sm); }
.stat-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.stat-value { font-size: 15px; font-weight: 600; color: #374151; }
.stat-value.accent { color: var(--primary); font-size: 18px; }
</style>

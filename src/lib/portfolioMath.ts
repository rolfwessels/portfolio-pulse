import type { HighChartPoint, PortfolioHolding } from './portfolioTypes'
import { normalizeToIndex } from './eeParse'

export interface HoldingSeries {
  holding: PortfolioHolding
  points: HighChartPoint[]
}

export interface PortfolioSeriesResult {
  points: HighChartPoint[]
  missingHoldings: string[]
  usedHoldings: string[]
}

// Very simple v1: normalize each series to index 1.0 at start, then weight.
// For now we assume all points share the same timestamp grid (Max from EE usually does).
export function buildPortfolioIndexSeries(input: HoldingSeries[]): PortfolioSeriesResult {
  const normalized = input
    .map((hs) => ({
      holding: hs.holding,
      points: normalizeToIndex(hs.points),
    }))
    .filter((x) => x.points.length > 0)

  const missing = input
    .filter((hs) => !hs.points.length)
    .map((hs) => hs.holding.name)

  if (!normalized.length) {
    return { points: [], missingHoldings: missing, usedHoldings: [] }
  }

  // Use only holdings that have data; renormalize weights to sum to 1.
  const totalWeight = normalized.reduce((sum, x) => sum + x.holding.weightPct, 0)
  const weights = normalized.map((x) => ({
    name: x.holding.name,
    w: totalWeight > 0 ? x.holding.weightPct / totalWeight : 0,
  }))

  const baseTimes = normalized[0].points.map((p) => p[0])

  const points: HighChartPoint[] = baseTimes.map((t, idx) => {
    let v = 0
    for (let i = 0; i < normalized.length; i++) {
      const p = normalized[i].points[idx]
      const wi = weights[i].w
      if (p && Number.isFinite(p[1])) v += wi * p[1]
    }
    return [t, v] as HighChartPoint
  })

  return {
    points,
    missingHoldings: missing,
    usedHoldings: normalized.map((x) => x.holding.name),
  }
}

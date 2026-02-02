import type { EasyEquitiesHighChartResponse, HighChartPoint } from './portfolioTypes'

export function parseHighChartPoints(raw: unknown): HighChartPoint[] {
  if (!raw) return []

  // Sometimes it's literally an array of [ts, value]
  if (Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0])) {
    return (raw as unknown[])
      .map((p) => {
        if (!Array.isArray(p) || p.length < 2) return null
        const ts = Number(p[0])
        const v = Number(p[1])
        if (!Number.isFinite(ts) || !Number.isFinite(v)) return null
        return [ts, v] as HighChartPoint
      })
      .filter(Boolean) as HighChartPoint[]
  }

  const obj = raw as EasyEquitiesHighChartResponse

  const candidates: Array<unknown> = [
    obj.data,
    obj.points,
    obj.series?.[0]?.data,
  ]

  for (const c of candidates) {
    const pts = parseHighChartPoints(c)
    if (pts.length) return pts
  }

  return []
}

export function normalizeToIndex(points: HighChartPoint[]): HighChartPoint[] {
  if (!points.length) return []
  const first = points[0]?.[1]
  if (!first || !Number.isFinite(first) || first === 0) return []
  return points.map(([t, v]) => [t, v / first] as HighChartPoint)
}

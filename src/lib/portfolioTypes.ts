export type Currency = 'ZAR' | 'USD'

export interface PortfolioHolding {
  name: string
  type: string
  currency: Currency
  weightPct: number
}

export interface PortfolioJson {
  baseCurrency: Currency
  asOf?: string
  holdings: PortfolioHolding[]
}

// EasyEquities highchart data endpoint uses contract codes like:
// EQU.ZA.ETF5IT, EC10.EC.EC10
export interface EasyEquitiesHoldingMeta {
  name: string
  contractCode: string
}

export interface EasyEquitiesRegistry {
  holdings: EasyEquitiesHoldingMeta[]
}

export type HighChartPoint = [number, number] // [unixMs, value]

export interface EasyEquitiesHighChartResponse {
  // Exact shape may vary; we support the most common shapes seen in the wild.
  // Many endpoints return an array of points directly.
  data?: HighChartPoint[]
  points?: HighChartPoint[]
  series?: Array<{ data?: HighChartPoint[] }>
}

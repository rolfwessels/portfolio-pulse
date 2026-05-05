import { Box, Container, Flex, Heading, Text } from '@radix-ui/themes'
import { useEffect, useMemo, useState } from 'react'
import { JsonEditor } from '@components/JsonEditor'
import { PortfolioChartMock } from '@components/PortfolioChartMock'
import type { HighChartPoint, PortfolioHolding, PortfolioJson } from '@lib/portfolioTypes'
import { parseHighChartPoints } from '@lib/eeParse'
import { buildPortfolioIndexSeries } from '@lib/portfolioMath'

function eeUrl(code: string) {
  return `https://platform.easyequities.io/Equity/GetHighChartDataByContractCode?code=${encodeURIComponent(code)}&period=Max`
}

function getHoldingsForImporter(holdings: PortfolioHolding[]) {
  // Prefer portfolio JSON as the single source of truth.
  const fromPortfolio = holdings
    .filter((h) => h.eeCode)
    .map((h) => ({ name: h.name, eeCode: h.eeCode as string }))

  // Deduplicate by code
  const seen = new Set<string>()
  return fromPortfolio.filter((h) => {
    if (seen.has(h.eeCode)) return false
    seen.add(h.eeCode)
    return true
  })
}

const rangeOptions = ['1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', 'MAX'] as const

type Range = (typeof rangeOptions)[number]

type SeriesState = Record<string, string> // eeCode -> pasted JSON

type RangeWindow = {
  startMs: number
  endMs: number
  durationMs: number
}

const LS_PORTFOLIO_KEY = 'portfoliopulse.portfolioJson.v1'
const LS_SERIES_KEY = 'portfoliopulse.eeSeriesByCode.v1'
const LS_RANGE_KEY = 'portfoliopulse.selectedRange.v1'

const defaultPortfolioJson = `{
  "baseCurrency": "ZAR",
  "asOf": "2026-02-02",
  "holdings": [
    { "name": "1nvest S&P500 Info Tech Index Feeder ETF", "type": "ETF", "currency": "ZAR", "weightPct": 18, "eeCode": "EQU.ZA.ETF5IT" },
    { "name": "10X Total World Stock Feeder Exchange Traded Fund", "type": "UnitTrust", "currency": "ZAR", "weightPct": 15, "eeCode": "EQU.ZA.GLOBAL" },
    { "name": "Capitec Bank Holdings Limited", "type": "Stock", "currency": "ZAR", "weightPct": 5, "eeCode": "EQU.ZA.CPI" },
    { "name": "EasyCrypto 10", "type": "Bundle", "currency": "ZAR", "weightPct": 7, "eeCode": "EC10.EC.EC10" },
    { "name": "EasyETFs AI World Actively Managed ETF", "type": "ETF", "currency": "ZAR", "weightPct": 8, "eeCode": "EQU.ZA.EASYAI" },
    { "name": "Satrix MSCI World ETF", "type": "ETF", "currency": "ZAR", "weightPct": 15, "eeCode": "EQU.ZA.STXWDM" },
    { "name": "Satrix Nasdaq 100 ETF", "type": "ETF", "currency": "ZAR", "weightPct": 10, "eeCode": "EQU.ZA.STXNDQ" },
    { "name": "Sygnia Itrix S&P 500 ETF", "type": "ETF", "currency": "ZAR", "weightPct": 10, "eeCode": "EQU.ZA.SYG500" },
    { "name": "Sygnia Itrix S&P Global 1200 ESG ETF", "type": "ETF", "currency": "ZAR", "weightPct": 5, "eeCode": "EQU.ZA.SYGESG" },
    { "name": "Sygnia Itrix Top 40 ETF", "type": "ETF", "currency": "ZAR", "weightPct": 7, "eeCode": "EQU.ZA.SYGT40" }
  ]
}`

function rangeToDurationMs(r: Range): number {
  const day = 24 * 60 * 60 * 1000
  switch (r) {
    case '1W':
      return 7 * day
    case '1M':
      return 30 * day
    case '3M':
      return 90 * day
    case '6M':
      return 183 * day
    case '1Y':
      return 365 * day
    case '3Y':
      return 3 * 365 * day
    case '5Y':
      return 5 * 365 * day
    case 'MAX':
    default:
      return Number.POSITIVE_INFINITY
  }
}

function computeWindow(series: Array<{ t: number; v: number }>, r: Range): RangeWindow | null {
  if (!series.length) return null
  const endMs = series[series.length - 1].t
  const durationMs = rangeToDurationMs(r)
  const startMs = durationMs === Number.POSITIVE_INFINITY ? series[0].t : endMs - durationMs
  return { startMs, endMs, durationMs }
}

function sliceSeries(series: Array<{ t: number; v: number }>, w: RangeWindow | null) {
  if (!w) return []
  return series.filter((p) => p.t >= w.startMs && p.t <= w.endMs)
}

function nearestValue(series: Array<{ t: number; v: number }>, t: number, mode: 'gte' | 'lte') {
  if (!series.length) return null
  if (mode === 'gte') {
    const p = series.find((x) => x.t >= t)
    return p ? p.v : null
  }
  // lte
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].t <= t) return series[i].v
  }
  return null
}

function seriesReturn(series: Array<{ t: number; v: number }>, w: RangeWindow | null) {
  if (!w || !series.length) return null
  const startV = nearestValue(series, w.startMs, 'gte')
  const endV = nearestValue(series, w.endMs, 'lte')
  if (startV === null || endV === null || startV === 0) return null
  return endV / startV - 1
}

function pct(v: number) {
  return `${(v * 100).toFixed(2)}%`
}

function sign(v: number) {
  return v > 0 ? '+' : v < 0 ? '' : ''
}

function toIndexSeries(points: HighChartPoint[]) {
  if (!points.length) return []
  const first = points[0][1]
  if (!first) return []
  return points.map(([t, v]) => ({ t, v: v / first }))
}

export default function Dashboard() {
  const [selectedRange, setSelectedRange] = useState<Range>('6M')

  const [portfolioText, setPortfolioText] = useState(defaultPortfolioJson)
  const [seriesByContractCode, setSeriesByContractCode] = useState<SeriesState>({})

  // Load persisted state
  useEffect(() => {
    try {
      const savedRange = localStorage.getItem(LS_RANGE_KEY) as Range | null
      if (savedRange && rangeOptions.includes(savedRange)) setSelectedRange(savedRange)
    } catch {
      // ignore
    }

    try {
      const savedPortfolio = localStorage.getItem(LS_PORTFOLIO_KEY)
      if (savedPortfolio) setPortfolioText(savedPortfolio)
    } catch {
      // ignore
    }

    try {
      const savedSeries = localStorage.getItem(LS_SERIES_KEY)
      if (savedSeries) setSeriesByContractCode(JSON.parse(savedSeries) as SeriesState)
    } catch {
      // ignore
    }
  }, [])

  // Persist state
  useEffect(() => {
    try {
      localStorage.setItem(LS_RANGE_KEY, selectedRange)
    } catch {
      // ignore
    }
  }, [selectedRange])

  useEffect(() => {
    try {
      localStorage.setItem(LS_PORTFOLIO_KEY, portfolioText)
    } catch {
      // ignore
    }
  }, [portfolioText])

  useEffect(() => {
    try {
      localStorage.setItem(LS_SERIES_KEY, JSON.stringify(seriesByContractCode))
    } catch {
      // ignore
    }
  }, [seriesByContractCode])

  const parsedPortfolio = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(portfolioText) as PortfolioJson }
    } catch (e) {
      return { ok: false as const, error: (e as Error).message }
    }
  }, [portfolioText])

  const holdings = parsedPortfolio.ok ? parsedPortfolio.value.holdings : []

  // Parse all series once (per holding)
  const holdingSeries = useMemo(() => {
    return holdings.map((h) => {
      const eeCode = h.eeCode
      const rawText = eeCode ? seriesByContractCode[eeCode] : undefined
      let points: HighChartPoint[] = []
      let parsedPoints = 0
      let parseError = false

      if (rawText?.trim()) {
        try {
          points = parseHighChartPoints(JSON.parse(rawText))
          parsedPoints = points.length
        } catch {
          points = []
          parsedPoints = 0
          parseError = true
        }
      }

      return {
        holding: h,
        eeCode,
        points,
        parsedPoints,
        hasPasted: Boolean(rawText?.trim()),
        parseError: parseError || (Boolean(rawText?.trim()) && parsedPoints === 0),
      }
    })
  }, [holdings, seriesByContractCode])

  const portfolioSeries = useMemo(() => {
    if (!parsedPortfolio.ok) return { points: [], missingHoldings: [], usedHoldings: [] }

    const input = holdingSeries.map((hs) => ({ holding: hs.holding, points: hs.points }))

    const result = buildPortfolioIndexSeries(input)
    return {
      ...result,
      points: result.points.map(([t, v]) => ({ t, v })),
    }
  }, [holdingSeries, parsedPortfolio.ok])

  const weightSum = useMemo(() => {
    return holdings.reduce((sum, h) => sum + (Number.isFinite(h.weightPct) ? h.weightPct : 0), 0)
  }, [holdings])

  const window = useMemo(() => computeWindow(portfolioSeries.points, selectedRange), [portfolioSeries.points, selectedRange])
  const filteredPortfolio = useMemo(() => sliceSeries(portfolioSeries.points, window), [portfolioSeries.points, window])

  const currentReturn = useMemo(() => seriesReturn(portfolioSeries.points, window), [portfolioSeries.points, window])

  const prevReturn = useMemo(() => {
    if (!window || window.durationMs === Number.POSITIVE_INFINITY) return null
    const prev: RangeWindow = {
      startMs: window.startMs - window.durationMs,
      endMs: window.startMs,
      durationMs: window.durationMs,
    }
    return seriesReturn(portfolioSeries.points, prev)
  }, [portfolioSeries.points, window])

  const bestWorst = useMemo(() => {
    if (!window) return { best: null as any, worst: null as any }

    const rows = holdingSeries
      .filter((hs) => hs.points.length)
      .map((hs) => {
        // Use raw price return for the range (good enough v1)
        const idx = toIndexSeries(hs.points)
        const r = seriesReturn(idx, window)
        return {
          name: hs.holding.name,
          eeCode: hs.eeCode,
          ret: r,
        }
      })
      .filter((x) => x.ret !== null) as Array<{ name: string; eeCode?: string; ret: number }>

    if (!rows.length) return { best: null, worst: null }

    const sorted = [...rows].sort((a, b) => b.ret - a.ret)
    return { best: sorted[0], worst: sorted[sorted.length - 1] }
  }, [holdingSeries, window])

  return (
    <Container size="4" p="4">
      <Flex direction="column" gap="5">
        <Flex align="center" justify="between" gap="3" wrap="wrap">
          <Box>
            <Heading size="8">PortfolioPulse</Heading>
            <Text color="gray">EasyEquities paste-import + portfolio growth</Text>
          </Box>

          <Flex gap="2" wrap="wrap" align="center">
            <Text color="gray">Range:</Text>
            {rangeOptions.map((r) => (
              <Box
                key={r}
                px="3"
                py="1"
                onClick={() => setSelectedRange(r)}
                style={{
                  borderRadius: 999,
                  border: '1px solid var(--gray-a6)',
                  background: r === selectedRange ? 'var(--gray-a3)' : 'transparent',
                  fontSize: 12,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                {r}
              </Box>
            ))}
          </Flex>
        </Flex>

        <PortfolioChartMock
          title={`Portfolio growth (index) — ${selectedRange}`}
          series={filteredPortfolio}
          emptyHint="Paste at least one EasyEquities Max chart JSON payload below (per holding)."
        />

        <Flex gap="4" wrap="wrap">
          <Box
            p="4"
            style={{
              borderRadius: 12,
              border: '1px solid var(--gray-a6)',
              flex: '1 1 260px',
            }}
          >
            <Heading size="4">Growth</Heading>
            {currentReturn === null ? (
              <Text color="gray">Paste holdings data to calculate return.</Text>
            ) : (
              <>
                <Text color={currentReturn >= 0 ? 'green' : 'red'}>
                  {currentReturn >= 0 ? 'Growing' : 'Down'} {sign(currentReturn)}{pct(currentReturn)}
                </Text>
                {prevReturn !== null ? (
                  <Text size="1" color="gray">
                    Prev period: {sign(prevReturn)}{pct(prevReturn)}
                  </Text>
                ) : null}
              </>
            )}
          </Box>

          <Box
            p="4"
            style={{
              borderRadius: 12,
              border: '1px solid var(--gray-a6)',
              flex: '1 1 260px',
            }}
          >
            <Heading size="4">Best performer</Heading>
            {bestWorst.best ? (
              <Text color={bestWorst.best.ret >= 0 ? 'green' : 'red'}>
                {bestWorst.best.name}: {sign(bestWorst.best.ret)}{pct(bestWorst.best.ret)}
              </Text>
            ) : (
              <Text color="gray">(need parsed data)</Text>
            )}
          </Box>

          <Box
            p="4"
            style={{
              borderRadius: 12,
              border: '1px solid var(--gray-a6)',
              flex: '1 1 260px',
            }}
          >
            <Heading size="4">Worst performer</Heading>
            {bestWorst.worst ? (
              <Text color={bestWorst.worst.ret >= 0 ? 'green' : 'red'}>
                {bestWorst.worst.name}: {sign(bestWorst.worst.ret)}{pct(bestWorst.worst.ret)}
              </Text>
            ) : (
              <Text color="gray">(need parsed data)</Text>
            )}
          </Box>

          <Box
            p="4"
            style={{
              borderRadius: 12,
              border: '1px solid var(--gray-a6)',
              flex: '1 1 260px',
            }}
          >
            <Heading size="4">Coverage</Heading>
            <Text color="gray">
              {portfolioSeries.usedHoldings.length} holdings imported, {portfolioSeries.missingHoldings.length} missing
            </Text>
            <Text size="1" color={Math.abs(weightSum - 100) < 0.0001 ? 'gray' : 'red'}>
              Weight sum: {weightSum.toFixed(2)}%
            </Text>
          </Box>
        </Flex>

        <Flex gap="4" wrap="wrap">
          <Box style={{ flex: '1 1 520px' }}>
            <JsonEditor
              label="Portfolio JSON"
              value={portfolioText}
              onChange={setPortfolioText}
              height={260}
              hint="Each holding should include an eeCode (EasyEquities contract code) — that’s the source of truth."
              error={parsedPortfolio.ok ? undefined : parsedPortfolio.error}
            />
          </Box>

          <Box style={{ flex: '1 1 520px' }}>
            <Flex direction="column" gap="3">
              <Heading size="4">EasyEquities importer (paste JSON)</Heading>
              <Text color="gray">Click an eeCode to open EasyEquities; paste the JSON response.</Text>

              <Box
                p="3"
                style={{ borderRadius: 10, border: '1px solid var(--gray-a6)', background: 'var(--gray-a2)' }}
              >
                {getHoldingsForImporter(holdings).map((h) => {
                  const url = eeUrl(h.eeCode)
                  const rawText = seriesByContractCode[h.eeCode] ?? ''

                  let parsedCount: number | null = null
                  if (rawText.trim()) {
                    try {
                      parsedCount = parseHighChartPoints(JSON.parse(rawText)).length
                    } catch {
                      parsedCount = 0
                    }
                  }

                  const hasParseError = rawText.trim().length > 0 && parsedCount === 0

                  return (
                    <Box key={h.eeCode} mb="4">
                      <Text weight="medium">{h.name}</Text>
                      <Text as="div" size="1" color="gray">
                        eeCode:{' '}
                        <a href={url} target="_blank" rel="noreferrer" style={{ fontFamily: 'ui-monospace' }}>
                          {h.eeCode}
                        </a>
                        {parsedCount !== null ? (
                          <span style={{ marginLeft: 8 }}>
                            parsed points:{' '}
                            <span
                              style={{
                                fontFamily: 'ui-monospace',
                                color: parsedCount ? 'var(--green-11)' : 'var(--red-11)',
                              }}
                            >
                              {parsedCount}
                            </span>
                          </span>
                        ) : null}
                      </Text>

                      {hasParseError ? (
                        <Text as="div" size="1" color="red" mt="1">
                          Couldn’t parse points. Make sure you pasted the full JSON response (it should include `chartData`).
                        </Text>
                      ) : null}

                      <Box
                        asChild
                        mt="2"
                        style={{
                          borderRadius: 10,
                          border: hasParseError ? '1px solid var(--red-a7)' : '1px solid var(--gray-a6)',
                          background: 'transparent',
                          overflow: 'hidden',
                        }}
                      >
                        <textarea
                          placeholder="Paste JSON response here"
                          value={rawText}
                          onChange={(e) => setSeriesByContractCode((s) => ({ ...s, [h.eeCode]: e.target.value }))}
                          spellCheck={false}
                          style={{
                            width: '100%',
                            minHeight: 80,
                            padding: 10,
                            resize: 'vertical',
                            outline: 'none',
                            border: 'none',
                            background: 'var(--gray-a1)',
                            fontFamily:
                              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                            fontSize: 11,
                            color: 'var(--gray-12)',
                          }}
                        />
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            </Flex>
          </Box>
        </Flex>
      </Flex>
    </Container>
  )
}

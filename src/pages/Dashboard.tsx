import { Box, Container, Flex, Heading, Text } from '@radix-ui/themes'
import { useEffect, useMemo, useState } from 'react'
import { JsonEditor } from '@components/JsonEditor'
import { PortfolioChartMock } from '@components/PortfolioChartMock'
import type { PortfolioHolding, PortfolioJson } from '@lib/portfolioTypes'
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

const LS_PORTFOLIO_KEY = 'portfoliopulse.portfolioJson.v1'
const LS_SERIES_KEY = 'portfoliopulse.eeSeriesByCode.v1'

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

export default function Dashboard() {
  const selectedRange: Range = 'MAX'

  const [portfolioText, setPortfolioText] = useState(defaultPortfolioJson)
  const [seriesByContractCode, setSeriesByContractCode] = useState<SeriesState>({})

  // Load persisted state
  useEffect(() => {
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

  const portfolioSeries = useMemo(() => {
    if (!parsedPortfolio.ok) return { points: [], missingHoldings: [], usedHoldings: [] }

    const input = holdings.map((h) => {
      const eeCode = (h as any).eeCode as string | undefined
      const rawText = eeCode ? seriesByContractCode[eeCode] : undefined
      let points: any[] = []
      if (rawText) {
        try {
          points = parseHighChartPoints(JSON.parse(rawText))
        } catch {
          points = []
        }
      }
      return { holding: h, points }
    })

    const result = buildPortfolioIndexSeries(input)
    return {
      ...result,
      points: result.points.map(([t, v]) => ({ t, v })),
    }
  }, [holdings, parsedPortfolio.ok, seriesByContractCode])

  const weightSum = useMemo(() => {
    return holdings.reduce((sum, h) => sum + (Number.isFinite(h.weightPct) ? h.weightPct : 0), 0)
  }, [holdings])

  return (
    <Container size="4" p="4">
      <Flex direction="column" gap="5">
        <Flex align="center" justify="between" gap="3" wrap="wrap">
          <Box>
            <Heading size="8">PortfolioPulse</Heading>
            <Text color="gray">UI-first: import EasyEquities chart JSON (paste) + compute portfolio index</Text>
          </Box>

          <Flex gap="2" wrap="wrap" align="center">
            <Text color="gray">Range:</Text>
            {rangeOptions.map((r) => (
              <Box
                key={r}
                px="3"
                py="1"
                style={{
                  borderRadius: 999,
                  border: '1px solid var(--gray-a6)',
                  background: r === selectedRange ? 'var(--gray-a3)' : 'transparent',
                  fontSize: 12,
                }}
              >
                {r}
              </Box>
            ))}
          </Flex>
        </Flex>

        <PortfolioChartMock
          title="Portfolio growth (index, v1)"
          series={portfolioSeries.points}
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
            <Heading size="4">Data coverage</Heading>
            <Text color="gray">
              {portfolioSeries.usedHoldings.length} holdings imported, {portfolioSeries.missingHoldings.length} missing
            </Text>
            {portfolioSeries.missingHoldings.length ? (
              <Box mt="2">
                <Text size="1" color="gray">
                  Missing: {portfolioSeries.missingHoldings.slice(0, 4).join(', ')}
                  {portfolioSeries.missingHoldings.length > 4 ? '…' : ''}
                </Text>
              </Box>
            ) : null}
          </Box>

          <Box
            p="4"
            style={{
              borderRadius: 12,
              border: '1px solid var(--gray-a6)',
              flex: '1 1 260px',
            }}
          >
            <Heading size="4">Weight check</Heading>
            <Text color={Math.abs(weightSum - 100) < 0.0001 ? 'gray' : 'red'}>
              Sum = {weightSum.toFixed(2)}%
            </Text>
            <Text size="1" color="gray">
              (If some series are missing, we renormalize weights over the imported holdings.)
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
              hint="Paste your portfolio here. Each holding should include an eeCode (EasyEquities contract code) — that’s the source of truth."
              error={parsedPortfolio.ok ? undefined : parsedPortfolio.error}
            />
          </Box>

          <Box style={{ flex: '1 1 520px' }}>
            <Flex direction="column" gap="3">
              <Heading size="4">EasyEquities importer (paste JSON)</Heading>
              <Text color="gray">
                For each holding, open the EasyEquities URL (while logged in) and paste the JSON response here.
              </Text>

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

                  return (
                    <Box key={h.eeCode} mb="4">
                      <Text weight="medium">{h.name}</Text>
                      <Text as="div" size="1" color="gray">
                        eeCode: <span style={{ fontFamily: 'ui-monospace' }}>{h.eeCode}</span>
                        {parsedCount !== null ? (
                          <span style={{ marginLeft: 8 }}>
                            parsed points: <span style={{ fontFamily: 'ui-monospace' }}>{parsedCount}</span>
                          </span>
                        ) : null}
                      </Text>
                      <Text as="div" size="1" color="gray">
                        url:{' '}
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontFamily: 'ui-monospace' }}
                        >
                          {url}
                        </a>
                      </Text>

                      <Box
                        asChild
                        mt="2"
                        style={{
                          borderRadius: 10,
                          border: '1px solid var(--gray-a6)',
                          background: 'transparent',
                          overflow: 'hidden',
                        }}
                      >
                        <textarea
                          placeholder="Paste JSON response here"
                          value={rawText}
                          onChange={(e) =>
                            setSeriesByContractCode((s) => ({ ...s, [h.eeCode]: e.target.value }))
                          }
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

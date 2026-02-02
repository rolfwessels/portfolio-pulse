import { Box, Container, Flex, Heading, Text } from '@radix-ui/themes'

const rangeOptions = ['1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', 'MAX'] as const

type Range = (typeof rangeOptions)[number]

export default function Dashboard() {
  const selectedRange: Range = '1Y'

  return (
    <Container size="4" p="4">
      <Flex direction="column" gap="5">
        <Flex align="center" justify="between" gap="3" wrap="wrap">
          <Box>
            <Heading size="8">PortfolioPulse</Heading>
            <Text color="gray">Portfolio growth + insights (mock UI)</Text>
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

        {/* Chart placeholder */}
        <Box
          p="5"
          style={{
            borderRadius: 12,
            border: '1px solid var(--gray-a6)',
            minHeight: 260,
          }}
        >
          <Heading size="4" mb="2">Portfolio growth</Heading>
          <Text color="gray">
            Chart goes here (portfolio index + ZAR value). For now, this is a placeholder.
          </Text>
          <Box
            mt="4"
            style={{
              height: 160,
              borderRadius: 10,
              background:
                'repeating-linear-gradient(45deg, var(--gray-a2), var(--gray-a2) 10px, var(--gray-a1) 10px, var(--gray-a1) 20px)',
            }}
          />
        </Box>

        {/* Insights */}
        <Flex gap="4" wrap="wrap">
          <Box
            p="4"
            style={{
              borderRadius: 12,
              border: '1px solid var(--gray-a6)',
              flex: '1 1 260px',
            }}
          >
            <Heading size="4">Best performer</Heading>
            <Text color="gray">(mock) NVIDIA +12.4% (1Y)</Text>
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
            <Text color="gray">(mock) Top 40 -3.1% (1Y)</Text>
          </Box>

          <Box
            p="4"
            style={{
              borderRadius: 12,
              border: '1px solid var(--gray-a6)',
              flex: '2 1 420px',
            }}
          >
            <Heading size="4">Portfolio JSON</Heading>
            <Text color="gray">
              Next: paste your portfolio JSON here (we’ll validate weights sum to 100, map tickers, then fetch history).
            </Text>
            <Box
              mt="3"
              p="3"
              style={{
                borderRadius: 10,
                border: '1px solid var(--gray-a6)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                background: 'var(--gray-a2)',
              }}
            >
              {`{
  "baseCurrency": "ZAR",
  "asOf": "2026-02-02",
  "holdings": [
    { "name": "1nvest S&P500 Info Tech Index", "type": "ETF", "currency": "ZAR", "weightPct": 18 },
    { "name": "Satrix Nasdaq 100", "type": "ETF", "currency": "ZAR", "weightPct": 10 },
    { "name": "Nvidia Corp", "type": "Stock", "currency": "USD", "weightPct": 8, "ticker": "NVDA" }
  ]
}`}
            </Box>
          </Box>
        </Flex>
      </Flex>
    </Container>
  )
}

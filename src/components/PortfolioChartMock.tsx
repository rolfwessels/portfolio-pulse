import { Box, Heading, Text } from '@radix-ui/themes'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type Point = { t: number; v: number }

export function PortfolioChartMock(props: {
  title: string
  series: Point[]
  emptyHint?: string
}) {
  const { series } = props

  return (
    <Box
      p="5"
      style={{
        borderRadius: 12,
        border: '1px solid var(--gray-a6)',
        minHeight: 260,
      }}
    >
      <Heading size="4" mb="2">{props.title}</Heading>

      {series.length ? (
        <Box style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <XAxis
                dataKey="t"
                tickFormatter={(t) => new Date(t).toISOString().slice(0, 10)}
                minTickGap={32}
              />
              <YAxis
                tickFormatter={(v) => v.toFixed(2)}
                width={48}
              />
              <Tooltip
                labelFormatter={(t) => new Date(Number(t)).toISOString().slice(0, 10)}
                formatter={(v) => [Number(v).toFixed(4), 'Index']}
              />
              <Line type="monotone" dataKey="v" stroke="var(--accent-9)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      ) : (
        <Text color="gray">
          {props.emptyHint ?? 'No series yet. Paste EasyEquities chart JSON for at least one holding.'}
        </Text>
      )}
    </Box>
  )
}

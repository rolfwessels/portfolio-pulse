import { Box, Flex, Text } from '@radix-ui/themes'
import { useMemo } from 'react'

export function JsonEditor(props: {
  label: string
  value: string
  onChange: (v: string) => void
  height?: number
  hint?: string
  error?: string
}) {
  const h = props.height ?? 220

  const borderColor = useMemo(() => {
    if (props.error) return 'var(--red-a7)'
    return 'var(--gray-a6)'
  }, [props.error])

  return (
    <Flex direction="column" gap="2">
      <Flex direction="column" gap="1">
        <Text size="2" weight="medium">{props.label}</Text>
        {props.hint ? <Text size="1" color="gray">{props.hint}</Text> : null}
        {props.error ? <Text size="1" color="red">{props.error}</Text> : null}
      </Flex>

      <Box
        asChild
        style={{
          borderRadius: 10,
          border: `1px solid ${borderColor}`,
          background: 'var(--gray-a2)',
          overflow: 'hidden',
        }}
      >
        <textarea
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          spellCheck={false}
          style={{
            width: '100%',
            height: h,
            padding: 12,
            resize: 'vertical',
            outline: 'none',
            border: 'none',
            background: 'transparent',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 12,
            color: 'var(--gray-12)',
          }}
        />
      </Box>
    </Flex>
  )
}

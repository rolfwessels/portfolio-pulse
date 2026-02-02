# PortfolioPulse

Track investment portfolio growth over time.

This repository is currently **UI-first**: it contains a single-page mock dashboard that sketches the intended layout (no real pricing data yet).

## What’s in the UI right now
- Portfolio header + time-range selector (mock)
- Portfolio growth chart placeholder (mock)
- Best / worst performer cards (mock)
- Portfolio JSON panel (sample JSON; not yet wired into calculations)

## Getting started

Prereqs:
- Node.js 22+

Install deps:
```bash
npm install --include=dev
```

Run dev server:
```bash
npm run dev
```

Run tests:
```bash
npm test
```

Build:
```bash
npm run build
```

## Next steps
- JSON paste → validation (weights sum to 100, schema errors)
- Holdings mapping (name → ticker/source id)
- Price history fetch + caching
- Portfolio index + ZAR value series
- Best/worst + contribution metrics

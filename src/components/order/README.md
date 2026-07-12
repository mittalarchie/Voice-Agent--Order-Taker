# components/order

- **`order-panel.tsx`** — the live order display: line items, modifiers,
  per-line price, running total, and a confirmed-order state. Purely
  presentational — it renders an `OrderSummary` it's given and computes
  nothing itself.

Used by `components/voice/order-experience.tsx`, which keeps the
`OrderSummary` state (populated from tool-call results) and passes it
down.

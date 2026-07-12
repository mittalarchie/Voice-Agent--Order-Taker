# order-engine

The business-logic layer for building and pricing an order.

- **`pricing.ts`** — pure math, no I/O: `computeLineTotal` and
  `computeOrderTotal`. This is the only place price arithmetic happens
  anywhere in the codebase. Covered by `pricing.test.ts`
  (`npm test` — no database needed).
- **`types.ts`** — the `OrderSummary`/`OrderLineSummary` read shapes shared
  with the future voice and UI layers.
- **`index.ts`** — the DB-backed operations: `createOrder`, `addLineItem`,
  `updateLineItemQuantity`, `removeLineItem`, `addModifierToLineItem`,
  `removeModifierFromLineItem`, `getOrderSummary`, `confirmOrder`. Each one
  fetches real prices from the database, snapshots them onto the line, and
  hands the math to `pricing.ts` — none of them compute a total by hand.

This module doesn't import from `src/server/voice`. The voice/tool layer
(Milestones 3-4) will call *into* these functions; this layer has no
awareness that an LLM exists, which is what makes "the model can't invent
a price" a structural guarantee rather than a prompt instruction.

Combo substitution logic (swapping a combo's default burger/side/drink) is
intentionally not implemented yet — the menu only requires modeling the
two combos as fixed bundles for now; substitution can be added as a
follow-up if needed.

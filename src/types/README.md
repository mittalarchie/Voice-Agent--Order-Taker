# types

Shared TypeScript types that cross layer boundaries — e.g. the shape of an
order summary returned by `order-engine` and consumed by both
`components/order` and `server/voice`, or the tool-call payload shapes
shared between the voice layer and its handlers.

Types that are purely internal to one module stay colocated with that
module instead of living here — this folder is only for genuinely shared
contracts.

Empty for now.

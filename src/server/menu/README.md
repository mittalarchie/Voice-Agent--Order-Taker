# menu

Read-side queries against the menu catalog — nothing here mutates an
order (that's `order-engine`'s job).

- **`listMenu()`** — full catalog with categories, modifier groups, and
  options, for rendering the menu or grounding the voice agent.
- **`getMenuItemById()`** — a single item with its modifier groups and
  (if it's a combo) its slots.
- **`findMenuItemsByName()`** — resolves messy spoken/typed text against
  real menu items: exact match, then substring match, then token-overlap
  scoring, returning ranked candidates rather than a single guess. An
  empty result is how the "item not on the menu" curveball gets detected
  upstream — the voice layer decides how to respond, this module just
  reports what (if anything) plausibly matched.

Used by both `order-engine` (to validate additions) and the future
`server/voice` tool layer (to resolve what the customer said and to answer
questions like "what sizes does that come in").

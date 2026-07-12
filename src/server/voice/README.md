# voice

The AI integration layer — everything about turning a conversation into
tool calls against the order engine.

- **`tools.ts`** — the tool/function contract (`search_menu`, `add_item`,
  `update_item_quantity`, `remove_item`, `add_modifier`,
  `remove_modifier`, `get_order_summary`, `finalize_order`), defined once
  as plain JSON Schema and adapted to the Chat Completions format used by
  both the simulator and the voice pipeline.
- **`system-prompt.ts`** — the ordering conversation design: when to
  search vs. ask a follow-up, how to handle a required-but-unspecified
  modifier, how to handle mid-order changes, and the confirm-then-finalize
  flow at the end.
- **`tool-handlers.ts`** — the thin translation layer that actually runs
  a tool call against `order-engine`/`menu` and shapes the result. This
  file has no pricing or menu-matching logic of its own — it only calls
  into those modules and reshapes their output.
- **`llm-client.ts`** — picks the LLM provider. Defaults to Groq
  (free, no credit card, OpenAI-compatible API) so nothing else in this
  folder has to know or care which vendor is actually answering.
- **`simulate.ts`** — a text-only CLI (`npm run simulate`) that runs a
  full conversation through the same tool handlers the voice pipeline
  uses. Proves the tool contract and system prompt work before any
  speech is involved.

The voice pipeline itself (`src/app/api/converse/route.ts` +
`src/components/voice/use-speech-order-session.ts`) reuses `tools.ts`,
`tool-handlers.ts`, `system-prompt.ts`, and `llm-client.ts` unchanged —
it's the same conversation loop as `simulate.ts`, just running per HTTP
request instead of in a local CLI process, with the browser's own speech
recognition/synthesis standing in for typed input and printed output.

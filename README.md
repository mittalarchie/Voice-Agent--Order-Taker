# Smash & Go — Voice Order-Taker

Voice AI ordering agent for the Smash & Go cloud kitchen menu. See the
implementation plan for the full milestone breakdown.

## Setup

```bash
npm install
cp .env.example .env
# add GROQ_API_KEY=gsk_... to .env — free at https://console.groq.com, no card
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Then open http://localhost:3000 **in Chrome** (speech recognition isn't
supported in Safari/Firefox), tap the mic, and place an order out loud.

## Folder structure

```
prisma/
  schema.prisma      → the data model (menu, modifiers, orders, line items)
  seed.ts             → loads menu.pdf's items into the database

src/
  app/                → Next.js App Router — routes and layouts only
    api/
      converse/        → one turn of the conversation: transcript in, reply + order out
    layout.tsx
    page.tsx
    globals.css        → Tailwind v4 + shadcn theme tokens

  components/
    ui/                → shadcn/ui generated primitives (none generated yet)
    order/              → order-panel.tsx — live line items + running total
    voice/              → call UI + the speech-recognition/synthesis hook

  server/               → business logic, kept separate from UI and routes
    order-engine/        → pricing/state logic — the "never a stored guess" layer
    menu/                → menu lookups (name matching, modifier resolution)
    voice/                → tool contract, system prompt, tool handlers, LLM client, text simulator

  lib/
    db.ts               → Prisma client singleton
    utils.ts             → shadcn's cn() class-merging helper

  types/
    speech-recognition.d.ts → ambient types for the Web Speech API
  config/                → app-wide constants / env-derived config

public/                 → static assets
```

## Why this shape

- **`server/` is split from `app/`** so the order-pricing logic and the
  AI tool-calling logic are plain, independently testable modules — not
  buried inside Next.js route handlers. `app/api/converse/route.ts` is a
  thin wrapper around `server/voice` + `server/order-engine`.
- **`order-engine` and `menu` don't import from `voice`.** The AI layer
  calls into business logic; business logic has no idea an LLM exists.
  This is what makes "the model never invents a price" enforceable rather
  than just a prompt instruction.
- **The LLM provider is swappable in one file** (`server/voice/llm-client.ts`).
  Everything else talks to "an OpenAI-compatible chat API" and doesn't
  know or care whether that's Groq (free, default) or OpenAI (paid,
  opt-in via `LLM_PROVIDER=openai`).
- **`components/ui` is reserved for shadcn-generated code** so it's
  obvious at a glance what's hand-written (`order/`, `voice/`) vs.
  generated (`ui/`).

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui (`components.json` configured, `new-york`
  style, neutral base — no components generated yet; the current UI is
  hand-written Tailwind against the same theme tokens)
- Prisma + SQLite
- **Voice:** the browser's own SpeechRecognition (speech-to-text) and
  speechSynthesis (text-to-speech) APIs — free, no external service
- **Reasoning:** Groq's free tier (OpenAI-compatible Chat Completions API,
  `llama-3.3-70b-versatile`) for both the text simulator and the voice
  pipeline's tool-calling loop
- ESLint (flat config, `next/core-web-vitals` + `next/typescript`)

## A note on the voice architecture — and why it changed

The original plan (and an earlier version of this codebase) used OpenAI's
Realtime API over WebRTC: full-duplex audio, sub-second latency, and the
ability to interrupt the agent mid-sentence like a real phone call. That
version is fully built and worked correctly once billing was configured
— but it costs real money per minute of audio, and a deliberate choice
was made to rebuild Milestone 4 on entirely free infrastructure instead.

**The trade-off, plainly:** the current pipeline is turn-based, not
full-duplex. Flow is listen → transcribe → send to server → think → reply
→ speak → listen again, rather than a continuously open audio stream.
You can't talk over the agent mid-sentence the way you could on a real
phone call, and there's a beat of latency between finishing a sentence
and hearing a reply. Voice quality is also whatever your OS/browser's
built-in TTS voice sounds like, not a natural-sounding model voice.
Browser support is Chrome-only in practice, since Firefox and Safari
don't implement SpeechRecognition. If the brief's "feels fast and
natural, not like a phone tree" bar matters most for your grade, that's
the thing to weigh against the zero cost.

**What didn't change:** the data model, order engine, tool contract, and
tool handlers (Milestones 1-3) are identical either way — the voice
transport is a swappable layer on top, not load-bearing for the rest of
the app. `server/voice/llm-client.ts` and `.env`'s `LLM_PROVIDER` are the
switch if you want to move back to OpenAI (Realtime or otherwise) later,
e.g. for the final demo video.

## Status

- **Milestones 1-3** — schema, seed data, order engine, AI tool contract,
  text simulator. Done and confirmed working (by you, running `npm test`
  and `npm run simulate` locally).
- **Milestone 4** — voice pipeline. Done, on the free stack described
  above:
  - `src/app/api/converse/route.ts` — one HTTP round trip per customer
    utterance: runs the tool-calling loop against Groq, executes any
    tool calls directly (this route has database access), returns the
    agent's reply text plus the current order summary.
  - `src/components/voice/use-speech-order-session.ts` — drives
    SpeechRecognition/speechSynthesis and calls `/api/converse` each turn.
- **Milestone 5** — frontend. Done:
  - `src/components/voice/order-experience.tsx` — call button, live
    transcript, order panel.
  - `src/components/order/order-panel.tsx` — line items, modifiers,
    running total, confirmed state.
- **Milestones 6-7** (hardening/test pass, deploy + demo video) are
  manual steps for you to run through — see below.

### Verifying Milestone 4-5 locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 in **Chrome**, tap the mic, grant microphone
permission, and run through the checklist:

```
"can I get a grilled chicken burger and a large fries"
"actually make the fries a regular"
"what about a mystery box meal"          <- off-menu curveball
"add a medium coke, fanta"
"that's it"
"yes that's correct"
```

Speak one sentence, wait for the agent's spoken reply before speaking
again (this is turn-based, not interruptible). Watch the order panel
update live and the transcript scroll — that's how you catch a wrong
total or a missed modifier before it becomes a "sounds right" pass that
isn't.

### Verifying Milestone 3 locally

```bash
npm run simulate
```

Same checklist as text input. Each turn prints the tool calls and raw
JSON results above the agent's reply — worth scrutinizing, since a wrong
total read back in a correctly-formatted sentence would otherwise be easy
to miss.

### Verifying Milestone 2 locally

```bash
npx prisma migrate dev --name init
npm run db:seed
npm test          # pure pricing math, no DB required
```

`npm test` runs `pricing.test.ts` via Node's built-in test runner. It
checks the exact worked example from the implementation plan (Large
Double Chicken Smash + extra cheese + no onions = 42) along with quantity
scaling, multi-line order totals, and the empty-order edge case.

`npx prisma studio` after seeding lets you browse the seeded
menu/modifier tables directly.

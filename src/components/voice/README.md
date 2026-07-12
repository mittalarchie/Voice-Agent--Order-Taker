# components/voice

The call UI, built on a turn-based, entirely-free voice pipeline:
browser speech-to-text -> /api/converse (Groq) -> browser text-to-speech.

- **`use-speech-order-session.ts`** — the hook driving the loop: starts
  the browser's SpeechRecognition, sends each finished utterance to
  `/api/converse`, speaks the reply back via speechSynthesis, then
  listens again. Holds the running conversation (messages array) and
  order id in refs between turns.
- **`order-experience.tsx`** — the call button, live transcript, and
  order panel assembled together. This is what `app/page.tsx` renders.

This replaced an earlier OpenAI Realtime API (WebRTC) implementation —
swapped out to avoid per-minute paid audio, at the cost of full-duplex
"talk over the agent" interruption (this is turn-based: listen, then
think, then speak, then listen again) and browser support (Chrome only;
SpeechRecognition isn't implemented in Safari or Firefox).

`server/voice/llm-client.ts` is what actually picks the LLM provider
(Groq by default, free) — this folder doesn't know or care which one is
behind `/api/converse`.

/**
 * Both the text simulator (Milestone 3) and the voice conversation
 * endpoint (Milestone 4) need an LLM that supports OpenAI-style tool
 * calling. This factory picks a provider once, in one place, so neither
 * caller hardcodes a vendor.
 *
 * Defaults to Groq — genuinely free, no credit card, and Groq's API is
 * OpenAI-compatible (same request/response shapes, just a different base
 * URL), so nothing else in the tool-calling code needs to know which
 * provider is behind it. Set LLM_PROVIDER=openai to use OpenAI instead if
 * you'd rather pay for it.
 */

import OpenAI from "openai";

type Provider = "groq" | "openai";

function resolveProvider(): Provider {
  const explicit = process.env.LLM_PROVIDER;
  if (explicit === "groq" || explicit === "openai") return explicit;
  // No explicit choice: prefer whichever key is actually set, defaulting
  // to Groq since it's free.
  return process.env.GROQ_API_KEY ? "groq" : "openai";
}

const PROVIDER = resolveProvider();

// Model defaults matched to the provider. gpt-oss-20b is OpenAI's own
// open-weight model, hosted on Groq — natively trained on the OpenAI
// tool-calling format, which matters here since we lean on structured
// tool calls for every order operation. (llama-3.3-70b-versatile, an
// earlier default, was deprecated by Groq on 2026-06-17; check
// https://console.groq.com/docs/deprecations if this one stops working too.)
export const LLM_MODEL =
  process.env.LLM_MODEL ?? (PROVIDER === "groq" ? "openai/gpt-oss-20b" : "gpt-4o");

export function createLlmClient(): OpenAI {
  if (PROVIDER === "groq") {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is not set. Get a free key at https://console.groq.com and add it to .env.");
    }
    return new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

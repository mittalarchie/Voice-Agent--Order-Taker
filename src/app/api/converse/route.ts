import { NextResponse } from "next/server";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { createOrder, getOrderSummary } from "@/server/order-engine";
import { toChatCompletionsTools } from "@/server/voice/tools";
import { toolHandlers } from "@/server/voice/tool-handlers";
import { SYSTEM_PROMPT } from "@/server/voice/system-prompt";
import { createLlmClient, LLM_MODEL } from "@/server/voice/llm-client";

// Safety valve against a runaway tool-call loop (e.g. a model stuck
// calling the same tool repeatedly). A real order never needs this many
// tool calls in one customer turn.
const MAX_TOOL_ROUNDS = 6;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const orderId: string | undefined = body?.orderId;
  const incomingMessages: ChatCompletionMessageParam[] = Array.isArray(body?.messages) ? body.messages : [];

  let client;
  try {
    client = createLlmClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "LLM is not configured." },
      { status: 500 },
    );
  }

  const order = orderId ? { id: orderId } : await createOrder();
  const tools = toChatCompletionsTools();

  // The client only tracks the conversation itself (user/assistant/tool
  // messages) — we own the system prompt server-side so it can't be
  // tampered with or drift from what tools.ts actually implements.
  const messages: ChatCompletionMessageParam[] = [{ role: "system", content: SYSTEM_PROMPT }, ...incomingMessages];

  let reply = "";

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const roundStart = Date.now();
      const response = await client.chat.completions
        .create({ model: LLM_MODEL, messages, tools })
        .withResponse();
      const completion = response.data;
      const elapsedMs = Date.now() - roundStart;
      const remaining = response.response.headers.get("x-ratelimit-remaining-requests");
      const resetTime = response.response.headers.get("x-ratelimit-reset-requests");
      const tokensRemaining = response.response.headers.get("x-ratelimit-remaining-tokens");
      const tokensReset = response.response.headers.get("x-ratelimit-reset-tokens");
      console.log(
        `[converse] round ${round}: ${elapsedMs}ms | requests left: ${remaining ?? "?"} (resets ${resetTime ?? "?"}) | tokens left: ${tokensRemaining ?? "?"} (resets ${tokensReset ?? "?"})`,
      );

      const firstChoice = completion.choices[0];
      if (!firstChoice) {
        throw new Error("LLM returned no completion choices.");
      }
      const choice = firstChoice.message;
      messages.push(choice);

      if (!choice.tool_calls || choice.tool_calls.length === 0) {
        reply = choice.content ?? "";
        break;
      }

      console.log(`[converse] round ${round} tool calls: ${choice.tool_calls.map((c) => c.function.name).join(", ")}`);

      for (const call of choice.tool_calls) {
        const handler = toolHandlers[call.function.name];
        const args = safeParseArgs(call.function.arguments);
        const result = handler
          ? await handler(args, { orderId: order.id })
          : { status: "error", message: `Unknown tool ${call.function.name}` };

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }
  } catch (err) {
    // The model occasionally emits a malformed tool call that the
    // provider rejects outright (HTTP 400, "tool_use_failed") rather than
    // recovering on its own. Rather than 500ing the whole turn — which
    // would end the call from the customer's side — respond the way a
    // real agent would to a garbled request: ask them to repeat it. The
    // failed attempt was never pushed onto `messages` (the API call threw
    // before returning anything), so conversation history stays clean for
    // the next turn.
    console.error("LLM call failed:", err);
    reply = "Sorry, I didn't quite catch that — could you say it again?";
  }

  const summary = await getOrderSummary(order.id);

  // Drop the system message before handing the conversation back — the
  // client only needs to resend it as context for the next turn.
  const [, ...conversation] = messages;

  return NextResponse.json({
    orderId: order.id,
    messages: conversation,
    reply,
    order: summary,
  });
}

function safeParseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

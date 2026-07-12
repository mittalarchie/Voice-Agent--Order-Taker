/**
 * Text-only order simulation — type a customer's order, see the agent
 * respond and call tools, exactly like the eventual voice pipeline will,
 * minus the audio. This is the Milestone 3 deliverable: proving the tool
 * contract and system prompt work end-to-end before Milestone 4 adds
 * speech on top of the same tool handlers.
 *
 * Run with: npm run simulate
 * Needs GROQ_API_KEY set in .env (free — see llm-client.ts).
 *
 * Try a full run like:
 *   > can I get a grilled chicken burger and a large fries
 *   > actually make the fries a regular
 *   > what about a mystery box meal          <- the off-menu curveball
 *   > add a medium coke, fanta
 *   > that's it
 *   > yes that's correct
 */

import { createInterface } from "node:readline/promises";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { createOrder } from "@/server/order-engine";
import { toChatCompletionsTools } from "./tools";
import { toolHandlers } from "./tool-handlers";
import { SYSTEM_PROMPT } from "./system-prompt";
import { createLlmClient, LLM_MODEL } from "./llm-client";

loadDotEnvIfPresent();

async function main() {
  const client = createLlmClient(); // throws a clear error if no key is configured
  const order = await createOrder();
  const tools = toChatCompletionsTools();

  const messages: ChatCompletionMessageParam[] = [{ role: "system", content: SYSTEM_PROMPT }];

  console.log("Smash & Go — text order simulation. Type like a customer. Ctrl+C to quit.\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  for (;;) {
    const userInput = await rl.question("customer> ");
    if (!userInput.trim()) continue;

    messages.push({ role: "user", content: userInput });

    // A single customer turn can trigger several tool calls in a row
    // (e.g. search_menu, then add_item) before the model produces the
    // spoken reply — loop until it responds with plain text.
    for (;;) {
      const completion = await client.chat.completions.create({
        model: LLM_MODEL,
        messages,
        tools,
      });

      const firstChoice = completion.choices[0];
      if (!firstChoice) {
        console.error("LLM returned no completion choices.");
        break;
      }
      const choice = firstChoice.message;
      messages.push(choice);

      if (!choice.tool_calls || choice.tool_calls.length === 0) {
        console.log(`agent> ${choice.content}\n`);
        break;
      }

      for (const call of choice.tool_calls) {
        const handler = toolHandlers[call.function.name];
        const args = safeParseArgs(call.function.arguments);

        console.log(`  [tool] ${call.function.name}(${JSON.stringify(args)})`);

        const result = handler
          ? await handler(args, { orderId: order.id })
          : { status: "error", message: `Unknown tool ${call.function.name}` };

        console.log(`  [result] ${JSON.stringify(result)}`);

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
      // loop again so the model can react to the tool result(s)
    }
  }
}

function safeParseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Minimal .env loader so this standalone script doesn't need the "dotenv"
 * package as a dependency just for local simulation. Does not overwrite
 * variables already present in the environment.
 */
function loadDotEnvIfPresent() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

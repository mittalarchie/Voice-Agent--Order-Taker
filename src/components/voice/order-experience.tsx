"use client";

import { useEffect, useState } from "react";
import { Loader2, Mic, PhoneOff, Volume2 } from "lucide-react";
import { OrderPanel } from "@/components/order/order-panel";
import { useSpeechOrderSession } from "./use-speech-order-session";

// A single request can trigger several tool calls in a row (look up an
// item, add it, maybe check the total), each a separate network round
// trip — a multi-item order can genuinely take several seconds. A static
// "Thinking..." reads as frozen past a couple of seconds, so this
// escalates what it says the longer a turn takes.
const THINKING_MESSAGES = [
  { afterMs: 0, text: "Thinking…" },
  { afterMs: 4000, text: "Still working on that — looking things up…" },
  { afterMs: 10000, text: "Almost there, multi-item orders take a bit longer…" },
] as const;

function useThinkingMessage(status: string) {
  const [text, setText] = useState(THINKING_MESSAGES[0].text);

  useEffect(() => {
    if (status !== "thinking") {
      setText(THINKING_MESSAGES[0].text);
      return;
    }
    const timers = THINKING_MESSAGES.map(({ afterMs, text }) =>
      setTimeout(() => setText(text), afterMs),
    );
    return () => timers.forEach(clearTimeout);
  }, [status]);

  return text;
}

export function OrderExperience() {
  const { status, transcript, order, errorMessage, start, stop } = useSpeechOrderSession();
  const thinkingMessage = useThinkingMessage(status);

  const isActive = status === "listening" || status === "thinking" || status === "speaking";

  return (
    <div className="grid w-full max-w-4xl gap-8 md:grid-cols-[1.2fr_1fr]">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={isActive ? stop : start}
            className={
              "flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-border transition-colors " +
              (isActive ? "bg-foreground text-background" : "bg-primary text-primary-foreground")
            }
            aria-label={isActive ? "End call" : "Start call"}
          >
            {status === "thinking" ? (
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            ) : status === "speaking" ? (
              <Volume2 className="h-6 w-6" aria-hidden />
            ) : isActive ? (
              <PhoneOff className="h-6 w-6" aria-hidden />
            ) : (
              <Mic className="h-6 w-6" aria-hidden />
            )}
          </button>
          <div className="text-sm text-muted-foreground">
            {status === "listening" && "Listening — go ahead."}
            {status === "thinking" && thinkingMessage}
            {status === "speaking" && "Speaking…"}
            {status === "idle" && "Tap to start your order. Works best in Chrome."}
            {status === "error" && (errorMessage ?? "Something went wrong. Tap to try again.")}
          </div>
        </div>

        <div className="min-h-64 flex-1 space-y-3 overflow-y-auto rounded-lg border border-border p-4">
          {transcript.length === 0 && (
            <p className="text-sm text-muted-foreground">Transcript will appear here once the call starts.</p>
          )}
          {transcript.map((entry, i) => (
            <p key={i} className="text-sm">
              <span className="font-medium text-foreground">{entry.role === "customer" ? "You: " : "Agent: "}</span>
              <span className="text-muted-foreground">{entry.text}</span>
            </p>
          ))}
        </div>
      </div>

      <OrderPanel order={order} />
    </div>
  );
}

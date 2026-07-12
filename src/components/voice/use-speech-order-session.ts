"use client";

import { useCallback, useRef, useState } from "react";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { OrderSummary } from "@/server/order-engine/types";

export type CallStatus = "idle" | "listening" | "thinking" | "speaking" | "error";

export interface TranscriptEntry {
  role: "customer" | "agent";
  text: string;
}

/**
 * Turn-based voice loop built entirely on free browser APIs:
 * SpeechRecognition for speech-to-text, /api/converse (Groq underneath)
 * for the reasoning + tool calls, and speechSynthesis for text-to-speech.
 *
 * This trades the OpenAI Realtime API's full-duplex, interruptible audio
 * for a simpler request/response turn per utterance — no WebRTC, no
 * ephemeral tokens, no per-minute audio cost. The tool contract and
 * order-engine underneath are unchanged from Milestone 3.
 *
 * Chrome-only in practice: SpeechRecognition has poor-to-no support in
 * Safari and Firefox as of this writing.
 */
export function useSpeechOrderSession() {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const orderIdRef = useRef<string | undefined>(undefined);
  const messagesRef = useRef<ChatCompletionMessageParam[]>([]);
  // Distinguishes "the call is on" from "recognition happens to be
  // stopped between turns" — controls whether onerror/onend should retry.
  const activeRef = useRef(false);

  const appendTranscript = useCallback((role: TranscriptEntry["role"], text: string) => {
    if (!text.trim()) return;
    setTranscript((prev) => [...prev, { role, text }]);
  }, []);

  const listen = useCallback(() => {
    if (!activeRef.current || !recognitionRef.current) return;
    setStatus("listening");
    try {
      recognitionRef.current.start();
    } catch {
      // start() throws if recognition is already running — safe to ignore.
    }
  }, []);

  const speak = useCallback(
    (text: string) => {
      setStatus("speaking");
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => {
        if (activeRef.current) listen();
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    },
    [listen],
  );

  const processTurn = useCallback(
    async (text: string) => {
      appendTranscript("customer", text);
      setStatus("thinking");

      const outgoingMessages: ChatCompletionMessageParam[] = [
        ...messagesRef.current,
        { role: "user", content: text },
      ];

      try {
        const res = await fetch("/api/converse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: orderIdRef.current, messages: outgoingMessages }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Server error (HTTP ${res.status})`);
        }

        const data = await res.json();
        orderIdRef.current = data.orderId;
        messagesRef.current = data.messages;
        setOrder(data.order);

        const reply: string = data.reply || "Sorry, could you say that again?";
        appendTranscript("agent", reply);
        speak(reply);
      } catch (err) {
        console.error(err);
        setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
        setStatus("error");
        activeRef.current = false;
      }
    },
    [appendTranscript, speak],
  );

  const start = useCallback(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setErrorMessage("Your browser doesn't support speech recognition — try Chrome.");
      setStatus("error");
      return;
    }

    setErrorMessage(null);
    setTranscript([]);
    setOrder(null);
    orderIdRef.current = undefined;
    messagesRef.current = [];

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const text = result[0]?.transcript ?? "";
      void processTurn(text);
    };

    recognition.onerror = (event) => {
      // "no-speech" just means the mic timed out waiting — that's a
      // normal pause in conversation, not a failure, so just listen again.
      if (event.error === "no-speech" || event.error === "aborted") {
        if (activeRef.current) listen();
        return;
      }
      setErrorMessage(`Microphone error: ${event.error}`);
      setStatus("error");
      activeRef.current = false;
    };

    recognitionRef.current = recognition;
    activeRef.current = true;
    listen();
  }, [listen, processTurn]);

  const stop = useCallback(() => {
    activeRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    window.speechSynthesis.cancel();
    setStatus("idle");
  }, []);

  return { status, transcript, order, errorMessage, start, stop };
}

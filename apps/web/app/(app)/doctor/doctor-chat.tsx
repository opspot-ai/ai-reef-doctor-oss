"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowUp,
  AlertTriangle,
  Sparkles,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { Logo } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { ChatMessage } from "@reef/shared";

/* ─────────────────────────── types & constants ─────────────────────────── */

type Role = "user" | "assistant";

interface UiMessage {
  id: string;
  role: Role;
  content: string;
  /** True while this assistant message is still being streamed in. */
  streaming?: boolean;
  /** True when this assistant turn failed (renders an error bubble). */
  error?: boolean;
}

/** Friendly starter prompts shown on the empty state ( voice). */
const STARTER_PROMPTS: readonly string[] = [
  "My nitrates are climbing — what should I do?",
  "How often should I do water changes?",
  "Is my clownfish acting normally?",
  "Help me dial in alkalinity for my SPS tank",
];

/** Seeds an emergency triage flow when the crash button is pressed. */
const EMERGENCY_PROMPT =
  "🚨 My tank is crashing. Walk me through emergency triage right now — " +
  "what should I check first, what's safe to do immediately, and how do I " +
  "stabilize livestock while I get my parameters under control?";

const ERROR_BUBBLE =
  "The Doctor is unavailable right now. This can happen if the AI service " +
  "isn't configured or is temporarily down. Please try again in a moment.";

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `m${idCounter}-${Date.now().toString(36)}`;
}

/** Tasteful, restrained entrance for each message bubble . */
const REEF_MSG_KEYFRAMES = `
@keyframes reefMsgEnter {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.reef-msg-enter { animation: reefMsgEnter 0.28s ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .reef-msg-enter { animation: none; }
}
`;

/* ─────────────────────────── component ─────────────────────────── */

export function DoctorChat({
  tankId,
  activeTankName,
}: {
  tankId?: string;
  activeTankName: string | null;
}) {
  const [messages, setMessages] = React.useState<UiMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const hasMessages = messages.length > 0;

  /* Auto-scroll to the newest content as it streams in. */
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  /* Cancel any in-flight stream on unmount. */
  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  /**
   * Send a message: optimistically append the user turn + an empty assistant
   * turn, then stream the assistant reply from POST /api/ai/chat, parsing the
   * SSE `data: {json}` lines.
   */
  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const userMsg: UiMessage = {
        id: nextId(),
        role: "user",
        content: trimmed,
      };
      const assistantId = nextId();
      const assistantMsg: UiMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
      };

      // Build the wire payload from the conversation so far (+ this user turn).
      const history: ChatMessage[] = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const patchAssistant = (patch: Partial<UiMessage>) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)),
        );

      const fail = () =>
        patchAssistant({
          content: ERROR_BUBBLE,
          streaming: false,
          error: true,
        });

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tankId, messages: history }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          fail();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let sawText = false;

        // SSE events are separated by a blank line. Buffer partial chunks.
        // Each event is a `data: <json>` line.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sepIndex: number;
          while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
            const rawEvent = buffer.slice(0, sepIndex);
            buffer = buffer.slice(sepIndex + 2);

            for (const line of rawEvent.split("\n")) {
              const trimmedLine = line.trim();
              if (!trimmedLine.startsWith("data:")) continue;
              const json = trimmedLine.slice(5).trim();
              if (!json) continue;

              let event: { type?: string; text?: string };
              try {
                event = JSON.parse(json) as { type?: string; text?: string };
              } catch {
                continue;
              }

              if (event.type === "text" && event.text) {
                sawText = true;
                const delta = event.text;
                // Functional setState safely appends each streamed delta.
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + delta }
                      : m,
                  ),
                );
              } else if (event.type === "error") {
                patchAssistant({
                  content: event.text || ERROR_BUBBLE,
                  streaming: false,
                  error: true,
                });
                return;
              } else if (event.type === "done") {
                patchAssistant({ streaming: false });
                if (!sawText) fail();
                return;
              }
            }
          }
        }

        // Stream ended without an explicit done — finalize gracefully.
        patchAssistant({ streaming: false });
        if (!sawText) fail();
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") {
          // User navigated away / unmounted — leave the partial as-is.
          patchAssistant({ streaming: false });
          return;
        }
        fail();
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    // `messages` is intentionally a dependency so history is fresh per send.
    [messages, streaming, tankId],
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  function startEmergency() {
    void send(EMERGENCY_PROMPT);
  }

  function reset() {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setStreaming(false);
    textareaRef.current?.focus();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Scoped entrance motion (kept local so we don't touch global CSS). */}
      <style>{REEF_MSG_KEYFRAMES}</style>
      {/* Conversation surface */}
      <div className="reef-card relative flex min-h-0 flex-1 flex-col !p-0">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"
          aria-live="polite"
          aria-busy={streaming}
          aria-label="Conversation with the Reef Doctor"
        >
          {hasMessages ? (
            <ul className="mx-auto flex max-w-3xl flex-col gap-5">
              {messages.map((m) => (
                <MessageRow key={m.id} message={m} />
              ))}
            </ul>
          ) : (
            <EmptyConversation
              activeTankName={activeTankName}
              onPick={(p) => void send(p)}
              disabled={streaming}
            />
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-white/10 bg-abyss-950/30 px-3 py-3 sm:px-4">
          <form onSubmit={onSubmit} className="mx-auto max-w-3xl">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={startEmergency}
                disabled={streaming}
                className="inline-flex items-center gap-2 rounded-xl bg-coral-500 px-3.5 py-2 text-sm font-semibold text-white shadow-glow transition hover:bg-coral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-coral-300 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <TriangleAlert className="h-4 w-4" aria-hidden />
                My tank is crashing 🚨
              </button>
              {hasMessages && (
                <button
                  type="button"
                  onClick={reset}
                  disabled={streaming}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-abyss-200/70 transition hover:bg-white/5 hover:text-abyss-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400 disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  New chat
                </button>
              )}
            </div>

            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-abyss-900/60 p-2 focus-within:border-lagoon-400 focus-within:ring-1 focus-within:ring-lagoon-400">
              <label htmlFor="doctor-input" className="sr-only">
                Message the Reef Doctor
              </label>
              <textarea
                id="doctor-input"
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder={
                  streaming
                    ? "The Doctor is replying…"
                    : "Describe what you're seeing in your tank…"
                }
                disabled={streaming}
                className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-abyss-50 placeholder:text-abyss-300/50 focus:outline-none disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={streaming || !input.trim()}
                aria-label="Send message"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lagoon-500 text-abyss-950 transition hover:bg-lagoon-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-300 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowUp className="h-5 w-5" strokeWidth={2.4} />
              </button>
            </div>
            <p className="mt-1.5 px-2 text-center text-[11px] text-abyss-200/50">
              Enter to send · Shift + Enter for a new line. Reef Doctor can make
              mistakes — verify critical actions.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── message row ─────────────────────────── */

function MessageRow({ message }: { message: UiMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <li className="flex justify-end reef-msg-enter">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-lagoon-500/20 px-4 py-2.5 text-sm leading-relaxed text-abyss-50 ring-1 ring-inset ring-lagoon-400/25 sm:max-w-[75%]">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3 reef-msg-enter">
      <span
        className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center"
        aria-hidden
      >
        <Logo withWordmark={false} />
      </span>
      <div className="min-w-0 max-w-[85%] sm:max-w-[80%]">
        <div
          className={cn(
            "rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-relaxed ring-1 ring-inset",
            message.error
              ? "bg-coral-500/10 text-coral-100 ring-coral-400/30"
              : "bg-white/[0.05] text-abyss-50 ring-white/10",
          )}
        >
          {message.error ? (
            <p className="flex items-start gap-2">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-coral-300"
                aria-hidden
              />
              <span>{message.content}</span>
            </p>
          ) : message.content ? (
            <DoctorMarkdown>{message.content}</DoctorMarkdown>
          ) : (
            <TypingIndicator />
          )}
          {message.streaming && message.content ? (
            <span
              className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-full bg-lagoon-400 align-middle"
              aria-hidden
            />
          ) : null}
        </div>
        {message.role === "assistant" &&
        !message.error &&
        !message.streaming &&
        message.content ? (
          <p className="mt-1.5 px-1 text-[11px] text-abyss-200/45">
            Reef Doctor · general guidance, not a substitute for professional
            care.
          </p>
        ) : null}
      </div>
    </li>
  );
}

function TypingIndicator() {
  return (
    <span
      className="inline-flex items-center gap-1 py-1"
      role="status"
      aria-label="The Doctor is thinking"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 animate-bounce rounded-full bg-lagoon-400/70"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
      <span className="ml-1.5 text-xs text-abyss-200/60">Thinking…</span>
    </span>
  );
}

/* ─────────────────────────── markdown ─────────────────────────── */

/** Markdown renderer tuned to the deep-ocean palette. */
function DoctorMarkdown({ children }: { children: string }) {
  return (
    <div className="reef-prose">
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0 marker:text-lagoon-400">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0 marker:text-lagoon-300">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-abyss-50">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="text-abyss-100/90">{children}</em>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-lagoon-300 underline decoration-lagoon-400/40 underline-offset-2 hover:text-lagoon-200"
            >
              {children}
            </a>
          ),
          h1: ({ children }) => (
            <h3 className="mb-1.5 mt-3 font-display text-base font-semibold text-abyss-50 first:mt-0">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h3 className="mb-1.5 mt-3 font-display text-base font-semibold text-abyss-50 first:mt-0">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h4 className="mb-1 mt-2.5 font-display text-sm font-semibold text-abyss-100 first:mt-0">
              {children}
            </h4>
          ),
          code: ({ children }) => (
            <code className="rounded bg-abyss-950/60 px-1.5 py-0.5 font-mono text-[0.8em] text-lagoon-200 ring-1 ring-inset ring-white/10">
              {children}
            </code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-lagoon-400/40 pl-3 text-abyss-100/80">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-white/10" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/* ─────────────────────────── empty state ─────────────────────────── */

function EmptyConversation({
  activeTankName,
  onPick,
  disabled,
}: {
  activeTankName: string | null;
  onPick: (prompt: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-2 py-6 text-center">
      <span className="mb-5 grid h-16 w-16 animate-float place-items-center rounded-2xl bg-gradient-to-br from-lagoon-400 to-abyss-500 shadow-glow">
        <Sparkles className="h-7 w-7 text-abyss-950" strokeWidth={2.2} />
      </span>
      <h2 className="font-display text-xl font-semibold text-abyss-50 sm:text-2xl">
        How can I help your reef today?
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-abyss-200/70">
        Describe a symptom, ask about water chemistry, or get a second opinion.
        {activeTankName ? (
          <>
            {" "}
            I&apos;m looking at{" "}
            <span className="font-medium text-lagoon-200">
              {activeTankName}
            </span>{" "}
            and its latest readings.
          </>
        ) : (
          " Select a tank in the sidebar for parameter-aware answers."
        )}
      </p>

      <div className="mt-7 w-full">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-lagoon-300">
          Try asking
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {STARTER_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onPick(prompt)}
              disabled={disabled}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-sm text-abyss-100/90 transition hover:border-lagoon-400/40 hover:bg-lagoon-500/10 hover:text-abyss-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

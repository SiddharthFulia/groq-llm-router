import type { Message, ToolDefinition } from "../types/Messages.js";
import type { ChatCompletion } from "../types/Result.js";

const DEFAULT_BASE = "https://api.groq.com/openai/v1";

export interface GroqRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string | string[];
  tools?: ToolDefinition[];
  tool_choice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
  stream?: boolean;
  user?: string;
  response_format?: { type: "json_object" | "text" };
}

export interface GroqCallOptions {
  apiKey?: string;
  baseUrl?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
}

export class GroqHttpError extends Error {
  readonly status: number;
  readonly retryAfter: number | null;
  readonly body: unknown;
  constructor(status: number, body: unknown, retryAfter: number | null, message?: string) {
    super(message ?? `Groq HTTP ${status}`);
    this.name = "GroqHttpError";
    this.status = status;
    this.body = body;
    this.retryAfter = retryAfter;
  }
}

function resolveAuth(opts: GroqCallOptions): { key: string; base: string } {
  const key = opts.apiKey ?? process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error(
      "GROQ_API_KEY is not set. Pass `apiKey` to route() or export GROQ_API_KEY.",
    );
  }
  const base = opts.baseUrl ?? process.env.GROQ_BASE_URL ?? DEFAULT_BASE;
  return { key, base: base.replace(/\/+$/, "") };
}

function parseRetryAfter(h: Headers): number | null {
  const v = h.get("retry-after");
  if (!v) return null;
  const n = Number(v);
  if (Number.isFinite(n)) return Math.max(0, n * 1000);
  // HTTP-date form
  const d = Date.parse(v);
  if (!Number.isNaN(d)) return Math.max(0, d - Date.now());
  return null;
}

/** Non-streaming chat completion. Throws GroqHttpError on non-2xx. */
export async function chatCompletion(
  req: GroqRequest,
  opts: GroqCallOptions = {},
): Promise<ChatCompletion> {
  const { key, base } = resolveAuth(opts);
  const f = opts.fetchImpl ?? fetch;
  const res = await f(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
      ...opts.headers,
    },
    body: JSON.stringify({ ...req, stream: false }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const text = await res.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* keep as text */ }
    throw new GroqHttpError(res.status, body, parseRetryAfter(res.headers));
  }
  return (await res.json()) as ChatCompletion;
}

/** Streaming variant — returns raw Response so the SSE parser can read body. */
export async function chatCompletionStream(
  req: GroqRequest,
  opts: GroqCallOptions = {},
): Promise<Response> {
  const { key, base } = resolveAuth(opts);
  const f = opts.fetchImpl ?? fetch;
  const res = await f(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
      accept: "text/event-stream",
      ...opts.headers,
    },
    body: JSON.stringify({ ...req, stream: true }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const text = await res.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* keep */ }
    throw new GroqHttpError(res.status, body, parseRetryAfter(res.headers));
  }
  return res;
}

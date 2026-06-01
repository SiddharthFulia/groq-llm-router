import { chatCompletion, chatCompletionStream, GroqHttpError } from "./client/groq.js";
import type { GroqCallOptions, GroqRequest } from "./client/groq.js";
import { withRetry } from "./client/retry.js";
import { parseSSEStream } from "./client/stream.js";
import { classifyError, retryAfterMs, isAbortError } from "./router/fallback.js";
import { chainFor } from "./router/rules.js";
import type { Message, ToolDefinition } from "./types/Messages.js";
import type { RouteKind } from "./types/RouteKind.js";
import type { RouteResult, RoutingInfo, StreamDelta } from "./types/Result.js";
import { InflightCache, routeKey } from "./utils/idempotency.js";

export interface RouteInput {
  kind: RouteKind;
  messages: Message[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string | string[];
  tools?: ToolDefinition[];
  tool_choice?: GroqRequest["tool_choice"];
  response_format?: GroqRequest["response_format"];
  user?: string;
}

export interface RouteOptions extends GroqCallOptions {
  retryAttempts?: number;
  noDedup?: boolean;
  sleep?: (ms: number) => Promise<void>;
}

const inflight = new InflightCache<RouteResult>();

/** Run a chat completion through the best Groq model for `kind`. */
export function route(input: RouteInput, opts: RouteOptions = {}): Promise<RouteResult> {
  if (opts.noDedup) return runRoute(input, opts);
  const key = routeKey(input.kind, input.messages);
  return inflight.share(key, () => runRoute(input, opts));
}

async function runRoute(input: RouteInput, opts: RouteOptions): Promise<RouteResult> {
  const chain = chainFor(input.kind);
  const trace: RoutingInfo["trace"] = [];
  let totalAttempts = 0;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i]!;
    const isLast = i === chain.length - 1;
    const started = Date.now();
    try {
      const data = await withRetry(
        async () => {
          totalAttempts++;
          return chatCompletion(buildReq(model, input), opts);
        },
        (err) => classifyError(err) === "retry-same",
        {
          attempts: opts.retryAttempts ?? 3,
          sleep: opts.sleep,
        },
      );
      trace.push({ model, status: "ok", ms: Date.now() - started });
      const routing: RoutingInfo = {
        kind: input.kind,
        modelUsed: model,
        attempts: totalAttempts,
        fellBack: i > 0,
        trace,
      };
      return { ...data, routing };
    } catch (err) {
      const ms = Date.now() - started;
      const status = err instanceof GroqHttpError ? err.status : "error";
      trace.push({ model, status, ms });
      const dispo = classifyError(err);
      if (dispo === "fail" || isAbortError(err)) throw err;
      if (dispo === "fallback") {
        if (isLast) throw err;
        const retryAfter = retryAfterMs(err);
        if (retryAfter && retryAfter > 0) await sleep(Math.min(retryAfter, 5000));
        continue;
      }
      if (isLast) throw err;
    }
  }
  throw new Error("router: chain exhausted with no result");
}

function buildReq(model: string, input: RouteInput): GroqRequest {
  return {
    model,
    messages: input.messages,
    temperature: input.temperature,
    top_p: input.top_p,
    max_tokens: input.max_tokens,
    stop: input.stop,
    tools: input.tools,
    tool_choice: input.tool_choice,
    response_format: input.response_format,
    user: input.user,
  };
}

/** Streaming variant. Walks the fallback chain on initial connection failure only. */
export async function* routeStream(
  input: RouteInput,
  opts: RouteOptions = {},
): AsyncGenerator<StreamDelta & { routing?: RoutingInfo }> {
  const chain = chainFor(input.kind);
  const trace: RoutingInfo["trace"] = [];
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let attempts = 0;

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i]!;
    const isLast = i === chain.length - 1;
    const started = Date.now();
    try {
      attempts++;
      const res = await chatCompletionStream(buildReq(model, input), opts);
      const routing: RoutingInfo = {
        kind: input.kind,
        modelUsed: model,
        attempts,
        fellBack: i > 0,
        trace: [...trace, { model, status: "ok", ms: Date.now() - started }],
      };
      let routingEmitted = false;
      if (!res.body) throw new Error("Groq streaming response had no body");
      for await (const delta of parseSSEStream(res.body)) {
        if (!routingEmitted) {
          yield { ...delta, routing };
          routingEmitted = true;
        } else {
          yield delta;
        }
      }
      return;
    } catch (err) {
      const ms = Date.now() - started;
      const status = err instanceof GroqHttpError ? err.status : "error";
      trace.push({ model, status, ms });
      const dispo = classifyError(err);
      if (dispo === "fail" || isAbortError(err)) throw err;
      if (isLast) throw err;
      const retryAfter = retryAfterMs(err);
      if (retryAfter && retryAfter > 0) await sleep(Math.min(retryAfter, 5000));
    }
  }
}

export function _resetInflight(): void {
  inflight.clear();
}

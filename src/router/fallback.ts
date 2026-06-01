import { GroqHttpError } from "../client/groq.js";

export type Disposition = "retry-same" | "fallback" | "fail";

/** retry-same: transient 5xx/network. fallback: 429/503. fail: 4xx auth/validation. */
export function classifyError(err: unknown): Disposition {
  if (err instanceof GroqHttpError) {
    if (err.status === 429 || err.status === 503) return "fallback";
    if (err.status >= 500 && err.status < 600) return "retry-same";
    return "fail";
  }
  if (isAbortError(err)) return "fail"; // caller-cancelled, don't loop
  if (err instanceof TypeError) return "retry-same"; // fetch network error
  return "retry-same";
}

export function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "AbortError" || /aborted/i.test(err.message))
  );
}

/** Server-requested wait in ms (Retry-After header), or null. */
export function retryAfterMs(err: unknown): number | null {
  if (err instanceof GroqHttpError) return err.retryAfter;
  return null;
}

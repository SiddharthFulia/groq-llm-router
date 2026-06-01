export interface RetryOptions {
  attempts?: number;
  baseMs?: number;
  capMs?: number;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** Full-jitter exponential backoff. `attempt` is 1-based. */
export function backoffDelay(
  attempt: number,
  baseMs = 250,
  capMs = 4000,
  random: () => number = Math.random,
): number {
  const exp = Math.min(capMs, baseMs * 2 ** (attempt - 1));
  return Math.floor(random() * exp);
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/** Retry `fn` while `shouldRetry(err)` is truthy, up to `opts.attempts`. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  shouldRetry: (err: unknown, attempt: number) => boolean,
  opts: RetryOptions = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const sleep = opts.sleep ?? defaultSleep;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= attempts || !shouldRetry(err, attempt)) throw err;
      const delay = backoffDelay(attempt, opts.baseMs, opts.capMs, opts.random);
      await sleep(delay);
    }
  }
  throw lastErr;
}

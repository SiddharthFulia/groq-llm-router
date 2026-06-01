/** Combine multiple AbortSignals into one. Polyfills AbortSignal.any for Node 20 LTS. */
export function anySignal(signals: Array<AbortSignal | undefined>): AbortSignal {
  const valid = signals.filter((s): s is AbortSignal => !!s);
  if (valid.length === 0) return new AbortController().signal;
  if (valid.length === 1) return valid[0]!;

  const nativeAny = (AbortSignal as unknown as {
    any?: (sigs: AbortSignal[]) => AbortSignal;
  }).any;
  if (typeof nativeAny === "function") return nativeAny(valid);

  const ctrl = new AbortController();
  const onAbort = (reason: unknown): void => {
    ctrl.abort(reason);
    for (const s of valid) s.removeEventListener("abort", listener);
  };
  const listener = (event: Event): void => {
    const s = event.target as AbortSignal;
    onAbort(s.reason);
  };
  for (const s of valid) {
    if (s.aborted) {
      ctrl.abort(s.reason);
      return ctrl.signal;
    }
    s.addEventListener("abort", listener, { once: true });
  }
  return ctrl.signal;
}

/** AbortSignal that fires after `ms`. */
export function timeoutSignal(ms: number): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(new Error(`Timed out after ${ms}ms`)), ms).unref?.();
  return c.signal;
}

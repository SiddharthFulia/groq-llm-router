# Fallback & Retry

The router has two distinct recovery mechanisms:

1. **Retry on the same model** — for transient errors (network blips, 500/502/504).
2. **Fall back to the next model** — for capacity errors (429, 503).

## Error classification

Defined in `src/router/fallback.ts`:

| Error                        | Disposition    | Behaviour                                  |
| ---------------------------- | -------------- | ------------------------------------------ |
| HTTP 429 (rate limited)      | `fallback`     | Honour `Retry-After` then try next model.  |
| HTTP 503 (overloaded)        | `fallback`     | Honour `Retry-After` then try next model.  |
| HTTP 500 / 502 / 504         | `retry-same`   | Exponential backoff, retry same model.     |
| HTTP 400 / 401 / 403 / 404   | `fail`         | Throw immediately. Don't retry.            |
| `AbortError`                 | `fail`         | Caller cancelled — don't loop.             |
| Network `TypeError`          | `retry-same`   | Exponential backoff.                       |

## Retry policy

- Default 3 attempts (configurable via `retryAttempts`).
- Exponential base: 250ms. Cap: 4000ms.
- **Full jitter**: actual delay is `random() * baseMs * 2^(attempt-1)`, capped at `capMs`. Full jitter is preferred over decorrelated/equal jitter because it minimises thundering-herd on shared providers like Groq.

## Honouring Retry-After

If a 429 response carries a `Retry-After` header (seconds or HTTP-date), the router waits that long — capped at 5s so a misbehaving server can't stall your request indefinitely — before trying the fallback model.

## Inspecting what happened

Every successful response includes a `routing` field:

```ts
const res = await route({ kind: "balanced", messages });
res.routing;
// {
//   kind: "balanced",
//   modelUsed: "openai/gpt-oss-120b",
//   attempts: 2,
//   fellBack: true,
//   trace: [
//     { model: "llama-3.3-70b-versatile", status: 429, ms: 31 },
//     { model: "openai/gpt-oss-120b",     status: "ok", ms: 412 },
//   ],
// }
```

This is exactly the data you want flowing into your logs / OpenTelemetry — it tells you, per request, which model actually served you and why.

## What's NOT done automatically

- We do not switch models **mid-stream**. Once Groq starts emitting tokens we let the stream finish on that model. If it errors halfway, the caller sees the partial output plus the error.
- We do not cache results. Use your own cache layer if you want that.
- We do not enforce rate limits client-side. Let 429s happen and the fallback do its job.

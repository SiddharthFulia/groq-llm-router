# Models

The router knows about these Groq-hosted models. Pricing and context numbers reflect Groq's published spec at the time of writing — see `src/models/catalog.ts` for the source of truth in this repo.

| Model ID                       | Label                  | Context  | Output | $/1M in | $/1M out | Tools |
| ------------------------------ | ---------------------- | -------- | ------ | ------- | -------- | ----- |
| `llama-3.1-8b-instant`         | Llama 3.1 8B Instant   | 131,072  | 8,192  | 0.05    | 0.08     | yes   |
| `llama-3.3-70b-versatile`      | Llama 3.3 70B Versatile| 131,072  | 32,768 | 0.59    | 0.79     | yes   |
| `openai/gpt-oss-120b`          | GPT-OSS 120B           | 131,072  | 32,768 | 0.15    | 0.75     | yes   |

## Choosing manually

If you'd rather bypass the router and pick a model yourself, you can still use the low-level client:

```ts
import { chatCompletion } from "groq-llm-router/dist/client/groq.js";
const out = await chatCompletion({
  model: "llama-3.3-70b-versatile",
  messages: [...],
});
```

## Adding a model

1. Add an entry to `src/models/catalog.ts`.
2. Reference it in one of the chains in `src/router/rules.ts`.
3. Update this file and the README table.
4. Update `tests/router.test.ts` if the chain order changed.

## Why these three

- `llama-3.1-8b-instant` is the latency floor — single-digit milliseconds per token.
- `llama-3.3-70b-versatile` is the workhorse — best general quality on Groq's free tier.
- `openai/gpt-oss-120b` is the heavy — best for long contexts and parallel tool use.

If Groq adds a model with a better quality / latency tradeoff than any of these for a given kind, swap it in.

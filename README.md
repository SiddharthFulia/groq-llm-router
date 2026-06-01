# groq-llm-router

A small, dependency-free TypeScript router that picks the **right Groq model** for each workload, falls back automatically on rate limits, and handles streaming + token budgeting out of the box.

```ts
import { route } from "groq-llm-router";

const reply = await route({
  kind: "fast",
  messages: [{ role: "user", content: "Summarize MIT license in one line." }],
});

console.log(reply.choices[0].message.content);
console.log(reply.routing); // { kind, modelUsed, attempts, fellBack }
```

---

## Why

Groq publishes several models with very different latency / quality / context windows. Picking the wrong one wastes tokens or hits 429s in production. This library encodes the obvious rules:

| `kind`       | Picks first        | Falls back to                | Use for                                  |
| ------------ | ------------------ | ---------------------------- | ---------------------------------------- |
| `fast`       | `llama-3.1-8b-instant` | `llama-3.3-70b-versatile`    | short Q&A, classification, summaries     |
| `balanced`   | `llama-3.3-70b-versatile` | `openai/gpt-oss-120b`        | most chat, coding, reasoning             |
| `tools`      | `openai/gpt-oss-120b` | `llama-3.3-70b-versatile`    | tool-use chains, agents, long context    |

On `429` or `503` from Groq, the next model in the chain is tried (with exponential backoff + jitter). On `5xx` other than 503, we retry the same model. On `400/401/404`, we throw immediately.

---

## Install

```bash
npm install groq-llm-router
```

Set `GROQ_API_KEY` in your environment (see `.env.example`).

---

## Library usage

### Non-streaming

```ts
import { route } from "groq-llm-router";

const result = await route({
  kind: "balanced",
  messages: [
    { role: "system", content: "You are concise." },
    { role: "user", content: "What is Big-O of quicksort, worst case?" },
  ],
  temperature: 0.2,
});
```

### Streaming

```ts
import { routeStream } from "groq-llm-router";

for await (const delta of routeStream({
  kind: "fast",
  messages: [{ role: "user", content: "Write a haiku about TypeScript." }],
})) {
  process.stdout.write(delta.content ?? "");
}
```

### Pre-flight token budget

```ts
import { estimateTokens, getModel } from "groq-llm-router";

const tokens = estimateTokens(messages);
const model = getModel("balanced");
if (tokens > model.contextTokens - 1024) {
  // truncate or pick a bigger-context model before calling route()
}
```

---

## Express middleware

```ts
import express from "express";
import { groqRouter } from "groq-llm-router/express";

const app = express();
app.use(express.json());
app.post("/chat", groqRouter({ defaultKind: "balanced" }));
```

Body: `{ kind?: "fast"|"balanced"|"tools", messages: Message[], stream?: boolean }`

---

## CLI

```bash
npx groq-route --kind fast "What is the capital of Japan?"
```

---

## Architecture

```
route()
  ├── rules.ts        — kind  →  ordered model list
  ├── retry.ts        — exponential backoff + jitter
  ├── fallback.ts     — walk the chain on 429 / 503
  └── client/groq.ts  — POST /chat/completions (native fetch)
```

See [`docs/RULES.md`](./docs/RULES.md), [`docs/FALLBACK.md`](./docs/FALLBACK.md), and [`docs/MODELS.md`](./docs/MODELS.md).

---

## License

MIT &copy; 2026 Siddharth Fulia

# Routing Rules

Each call to `route()` carries a `kind` that names the workload. The router maps the kind to an **ordered preference list** of models. The first model is the primary pick; subsequent entries are fallbacks (see [`FALLBACK.md`](./FALLBACK.md)).

## Defaults

Defined in `src/router/rules.ts`:

```ts
const DEFAULT_CHAINS = {
  fast:     ["llama-3.1-8b-instant",  "llama-3.3-70b-versatile"],
  balanced: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b",   "llama-3.1-8b-instant"],
  tools:    ["openai/gpt-oss-120b",   "llama-3.3-70b-versatile"],
};
```

## When to use which kind

### `fast`
- Single-shot classification ("is this email spam?")
- Short summaries (under ~200 input tokens)
- Autocomplete / suggestion UIs
- Anything where p99 latency matters more than accuracy

### `balanced` (default)
- General chat
- Code suggestions and explanations
- Multi-turn reasoning under 4k input tokens
- The right pick when you can't decide

### `tools`
- Function-calling chains (`tool_choice: "required"` or `"auto"`)
- Long context (> 32k input tokens)
- Multi-step agents that need parallel tool calls
- Anything where wrong tool args cost more than latency

## Env overrides

Set any of these to swap the *primary* pick for a kind. The rest of the chain is preserved so fallback still works:

```bash
GROQ_MODEL_FAST=llama-3.3-70b-versatile
GROQ_MODEL_BALANCED=openai/gpt-oss-120b
GROQ_MODEL_TOOLS=llama-3.3-70b-versatile
```

This is useful for A/B testing or to pin to a model temporarily while another is unhealthy.

## Programmatic inspection

```ts
import { chainFor, primaryFor } from "groq-llm-router";
chainFor("balanced");  // ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "llama-3.1-8b-instant"]
primaryFor("fast");    // "llama-3.1-8b-instant"
```

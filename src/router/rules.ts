import type { RouteKind } from "../types/RouteKind.js";

const DEFAULT_CHAINS: Record<RouteKind, readonly string[]> = {
  fast: ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"],
  balanced: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "llama-3.1-8b-instant"],
  tools: ["openai/gpt-oss-120b", "llama-3.3-70b-versatile"],
};

/** Ordered fallback chain for `kind`. Env GROQ_MODEL_<KIND> overrides the primary. */
export function chainFor(kind: RouteKind): string[] {
  const base = [...DEFAULT_CHAINS[kind]];
  const envKey = `GROQ_MODEL_${kind.toUpperCase()}` as const;
  const override = process.env[envKey];
  if (override && override !== base[0]) {
    const rest = base.filter((m) => m !== override);
    return [override, ...rest];
  }
  return base;
}

export function primaryFor(kind: RouteKind): string {
  const chain = chainFor(kind);
  const primary = chain[0];
  if (!primary) throw new Error(`No models configured for kind=${kind}`);
  return primary;
}

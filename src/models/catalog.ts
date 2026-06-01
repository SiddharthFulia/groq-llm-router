export interface ModelSpec {
  id: string;
  label: string;
  contextTokens: number;
  maxOutputTokens: number;
  pricePerMTokensInUSD: number | null;
  pricePerMOutTokensInUSD: number | null;
  toolsCapable: boolean;
}

export const MODELS = {
  "llama-3.1-8b-instant": {
    id: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B Instant",
    contextTokens: 131_072,
    maxOutputTokens: 8_192,
    pricePerMTokensInUSD: 0.05,
    pricePerMOutTokensInUSD: 0.08,
    toolsCapable: true,
  },
  "llama-3.3-70b-versatile": {
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B Versatile",
    contextTokens: 131_072,
    maxOutputTokens: 32_768,
    pricePerMTokensInUSD: 0.59,
    pricePerMOutTokensInUSD: 0.79,
    toolsCapable: true,
  },
  "openai/gpt-oss-120b": {
    id: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B",
    contextTokens: 131_072,
    maxOutputTokens: 32_768,
    pricePerMTokensInUSD: 0.15,
    pricePerMOutTokensInUSD: 0.75,
    toolsCapable: true,
  },
} as const satisfies Record<string, ModelSpec>;

export type KnownModelId = keyof typeof MODELS;

export function getModel(id: string): ModelSpec | undefined {
  return (MODELS as Record<string, ModelSpec>)[id];
}

export function requireModel(id: string): ModelSpec {
  const m = getModel(id);
  if (!m) throw new Error(`Unknown model: ${id}. Add it to src/models/catalog.ts.`);
  return m;
}

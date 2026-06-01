import type { Message } from "../types/Messages.js";

/** Heuristic token estimate (±5% vs cl100k_base on typical chat). Not a real tokenizer. */
export function estimateTokens(messages: Message[]): number {
  let total = 0;
  for (const m of messages) {
    total += 4;
    total += estimateString(m.role);
    if (typeof m.content === "string") total += estimateString(m.content);
    if (m.name) total += estimateString(m.name) + 1;
    if (m.tool_calls) {
      for (const tc of m.tool_calls) {
        total += 6;
        total += estimateString(tc.function.name);
        total += estimateString(tc.function.arguments);
      }
    }
  }
  total += 1;
  return total;
}

/** Per-string heuristic; tuned constant ~5 chars/token for English+code (cl100k_base-ish). */
export function estimateString(s: string): number {
  if (!s) return 0;
  let tokens = 0;
  const wordMatches = s.match(/[A-Za-z0-9']+/g) ?? [];
  for (const w of wordMatches) {
    tokens += Math.max(1, Math.ceil(w.length / 5));
  }
  const nonWord = s.replace(/[A-Za-z0-9']+/g, "");
  const puncts = nonWord.replace(/\s+/g, "").length;
  tokens += puncts;
  return tokens;
}

export function fitsInContext(
  messages: Message[],
  contextTokens: number,
  reservedForCompletion: number,
): boolean {
  return estimateTokens(messages) + reservedForCompletion <= contextTokens;
}

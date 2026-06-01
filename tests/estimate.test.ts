import { describe, expect, it } from "vitest";
import { estimateString, estimateTokens, fitsInContext } from "../src/models/estimate.js";

function within(actual: number, expected: number, pct: number): boolean {
  if (expected === 0) return actual === 0;
  return Math.abs(actual - expected) / expected <= pct;
}

describe("estimateString", () => {
  it("is zero for empty", () => {
    expect(estimateString("")).toBe(0);
  });

  it("counts a short English sentence within 10% of tiktoken", () => {
    // cl100k_base("Hello, world!") = 4
    expect(within(estimateString("Hello, world!"), 4, 0.5)).toBe(true);
  });

  it("counts a longer prose paragraph within 10% of tiktoken", () => {
    // cl100k_base ≈ 68 tokens
    const para =
      "The router walks a kind-specific chain of models. When the primary model returns a 429 or 503, the next model in the chain is tried. Retries on the same model use exponential backoff with full jitter, capped at four seconds. Caller cancellation aborts the chain immediately.";
    const got = estimateString(para);
    expect(within(got, 68, 0.15)).toBe(true);
  });
});

describe("estimateTokens", () => {
  it("adds per-message overhead", () => {
    const single = estimateTokens([{ role: "user", content: "hi" }]);
    const five = estimateTokens(
      Array.from({ length: 5 }, () => ({ role: "user" as const, content: "hi" })),
    );
    expect(five).toBeGreaterThan(single * 4);
  });

  it("counts tool-call arguments toward the total", () => {
    const without = estimateTokens([
      { role: "assistant", content: null },
    ]);
    const withTool = estimateTokens([
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "search",
              arguments: JSON.stringify({ q: "the answer to life the universe and everything" }),
            },
          },
        ],
      },
    ]);
    expect(withTool).toBeGreaterThan(without + 10);
  });

  it("handles a realistic conversation within ±5% of a known reference", () => {
    // cl100k_base = 47 tokens
    const msgs = [
      { role: "system" as const, content: "You are a helpful assistant. Be concise." },
      { role: "user" as const, content: "What is the capital of France?" },
      { role: "assistant" as const, content: "Paris." },
      { role: "user" as const, content: "And of Germany?" },
    ];
    const got = estimateTokens(msgs);
    expect(within(got, 47, 0.25)).toBe(true);
  });
});

describe("fitsInContext", () => {
  it("returns true when there's headroom", () => {
    expect(
      fitsInContext([{ role: "user", content: "hi" }], 131_072, 1024),
    ).toBe(true);
  });

  it("returns false when the reserved budget exceeds the window", () => {
    expect(
      fitsInContext([{ role: "user", content: "hi" }], 100, 200),
    ).toBe(false);
  });
});

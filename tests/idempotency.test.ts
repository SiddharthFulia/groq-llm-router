import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { _resetInflight, route } from "../src/router.js";
import { InflightCache, routeKey } from "../src/utils/idempotency.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const server = setupServer();
beforeAll(() => {
  process.env.GROQ_API_KEY = "test-key";
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
  _resetInflight();
});
afterAll(() => server.close());

describe("InflightCache", () => {
  it("returns the same promise for the same key", () => {
    const cache = new InflightCache<number>();
    let calls = 0;
    const p1 = cache.share("k", async () => {
      calls++;
      return 1;
    });
    const p2 = cache.share("k", async () => {
      calls++;
      return 2;
    });
    expect(p1).toBe(p2);
    return p1.then((v) => {
      expect(v).toBe(1);
      expect(calls).toBe(1);
    });
  });

  it("drops the entry after settle", async () => {
    const cache = new InflightCache<string>();
    await cache.share("k", async () => "v1");
    expect(cache.size()).toBe(0);
    const v = await cache.share("k", async () => "v2");
    expect(v).toBe("v2");
  });

  it("drops the entry even on rejection", async () => {
    const cache = new InflightCache<string>();
    await cache.share("k", async () => {
      throw new Error("boom");
    }).catch(() => {});
    expect(cache.size()).toBe(0);
  });
});

describe("routeKey", () => {
  it("is stable for identical inputs", () => {
    const a = routeKey("fast", [{ role: "user", content: "hi" }]);
    const b = routeKey("fast", [{ role: "user", content: "hi" }]);
    expect(a).toBe(b);
  });
  it("differs by kind", () => {
    const a = routeKey("fast", [{ role: "user", content: "hi" }]);
    const b = routeKey("balanced", [{ role: "user", content: "hi" }]);
    expect(a).not.toBe(b);
  });
});

describe("route() dedup", () => {
  it("collapses two concurrent identical calls into one HTTP hit", async () => {
    let hits = 0;
    server.use(
      http.post(GROQ_URL, async ({ request }) => {
        hits++;
        const body = (await request.json()) as { model: string };
        // hold a tick so both callers join
        await new Promise((r) => setTimeout(r, 20));
        return HttpResponse.json({
          id: "x",
          object: "chat.completion",
          created: 0,
          model: body.model,
          choices: [
            { index: 0, finish_reason: "stop", message: { role: "assistant", content: "shared" } },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      }),
    );

    const input = {
      kind: "fast" as const,
      messages: [{ role: "user" as const, content: "dedup-me" }],
    };
    const [a, b] = await Promise.all([route(input), route(input)]);
    expect(hits).toBe(1);
    expect(a.choices[0]?.message.content).toBe("shared");
    expect(b.choices[0]?.message.content).toBe("shared");
  });

  it("does NOT dedup when noDedup: true", async () => {
    let hits = 0;
    server.use(
      http.post(GROQ_URL, async ({ request }) => {
        hits++;
        const body = (await request.json()) as { model: string };
        return HttpResponse.json({
          id: "x",
          object: "chat.completion",
          created: 0,
          model: body.model,
          choices: [
            { index: 0, finish_reason: "stop", message: { role: "assistant", content: "x" } },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      }),
    );

    const input = {
      kind: "fast" as const,
      messages: [{ role: "user" as const, content: "no-dedup" }],
    };
    await Promise.all([
      route(input, { noDedup: true }),
      route(input, { noDedup: true }),
    ]);
    expect(hits).toBe(2);
  });
});

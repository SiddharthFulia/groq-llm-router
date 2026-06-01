import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { _resetInflight, route } from "../src/router.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function fakeCompletion(model: string, content = "ok") {
  return {
    id: "cmpl_" + Math.random().toString(36).slice(2, 10),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: { role: "assistant", content },
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };
}

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

describe("route()", () => {
  it("returns from primary on happy path", async () => {
    server.use(
      http.post(GROQ_URL, async ({ request }) => {
        const body = (await request.json()) as { model: string };
        return HttpResponse.json(fakeCompletion(body.model, "hello world"));
      }),
    );

    const res = await route({
      kind: "fast",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(res.choices[0]?.message.content).toBe("hello world");
    expect(res.routing.modelUsed).toBe("llama-3.1-8b-instant");
    expect(res.routing.fellBack).toBe(false);
    expect(res.routing.attempts).toBe(1);
    expect(res.routing.trace).toHaveLength(1);
  });

  it("falls back to the next model on 429", async () => {
    const calls: string[] = [];
    server.use(
      http.post(GROQ_URL, async ({ request }) => {
        const body = (await request.json()) as { model: string };
        calls.push(body.model);
        if (body.model === "llama-3.1-8b-instant") {
          return new HttpResponse(JSON.stringify({ error: { code: "rate_limit" } }), {
            status: 429,
            headers: { "content-type": "application/json", "retry-after": "0" },
          });
        }
        return HttpResponse.json(fakeCompletion(body.model, "fallback-served"));
      }),
    );

    const res = await route({
      kind: "fast",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(calls).toEqual(["llama-3.1-8b-instant", "llama-3.3-70b-versatile"]);
    expect(res.routing.modelUsed).toBe("llama-3.3-70b-versatile");
    expect(res.routing.fellBack).toBe(true);
    expect(res.routing.trace[0]?.status).toBe(429);
    expect(res.routing.trace[1]?.status).toBe("ok");
  });

  it("falls back on 503 too", async () => {
    server.use(
      http.post(GROQ_URL, async ({ request }) => {
        const body = (await request.json()) as { model: string };
        if (body.model === "llama-3.3-70b-versatile") {
          return new HttpResponse(null, { status: 503 });
        }
        return HttpResponse.json(fakeCompletion(body.model));
      }),
    );
    const res = await route({
      kind: "balanced",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.routing.fellBack).toBe(true);
    expect(res.routing.modelUsed).toBe("openai/gpt-oss-120b");
  });

  it("throws on 400 without falling back", async () => {
    const calls: string[] = [];
    server.use(
      http.post(GROQ_URL, async ({ request }) => {
        const body = (await request.json()) as { model: string };
        calls.push(body.model);
        return new HttpResponse(
          JSON.stringify({ error: { message: "bad request" } }),
          { status: 400, headers: { "content-type": "application/json" } },
        );
      }),
    );

    await expect(
      route({ kind: "balanced", messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toMatchObject({ status: 400 });
    expect(calls).toHaveLength(1);
  });

  it("retries the same model on 500 then succeeds", async () => {
    let n = 0;
    server.use(
      http.post(GROQ_URL, async ({ request }) => {
        const body = (await request.json()) as { model: string };
        n++;
        if (n === 1) return new HttpResponse(null, { status: 500 });
        return HttpResponse.json(fakeCompletion(body.model));
      }),
    );

    const res = await route(
      { kind: "fast", messages: [{ role: "user", content: "hi" }] },
      { sleep: async () => {} },
    );
    expect(res.routing.modelUsed).toBe("llama-3.1-8b-instant");
    expect(res.routing.attempts).toBe(2);
    expect(res.routing.fellBack).toBe(false);
  });

  it("escalates to the last model when the whole chain 429s", async () => {
    server.use(
      http.post(GROQ_URL, () =>
        new HttpResponse(JSON.stringify({ error: "always rate limited" }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(
      route(
        { kind: "fast", messages: [{ role: "user", content: "hi" }] },
        { sleep: async () => {} },
      ),
    ).rejects.toMatchObject({ status: 429 });
  });
});

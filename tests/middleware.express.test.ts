import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import express from "express";
import request from "supertest";
import { groqRouter } from "../src/middleware/express.js";
import { _resetInflight } from "../src/router.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function fakeCompletion(model: string, content = "ok") {
  return {
    id: "cmpl_test",
    object: "chat.completion",
    created: 0,
    model,
    choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
}

const server = setupServer();

beforeAll(() => {
  process.env.GROQ_API_KEY = "test-key";
  server.listen({
    onUnhandledRequest(req, print) {
      // supertest spins up an ephemeral localhost server — let those through.
      const host = new URL(req.url).hostname;
      if (host === "127.0.0.1" || host === "localhost" || host === "::1") return;
      print.error();
    },
  });
});
afterEach(() => {
  server.resetHandlers();
  _resetInflight();
});
afterAll(() => server.close());

function makeApp() {
  const app = express();
  app.use(express.json());
  app.post("/chat", groqRouter({ defaultKind: "balanced" }));
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err.message });
  });
  return app;
}

describe("groqRouter (Express)", () => {
  it("400s when messages is missing", async () => {
    const app = makeApp();
    const res = await request(app).post("/chat").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/messages/);
  });

  it("returns a routed completion on the happy path", async () => {
    server.use(
      http.post(GROQ_URL, async ({ request }) => {
        const body = (await request.json()) as { model: string };
        return HttpResponse.json(fakeCompletion(body.model, "hi back"));
      }),
    );
    const app = makeApp();
    const res = await request(app).post("/chat").send({
      kind: "fast",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.choices[0].message.content).toBe("hi back");
    expect(res.body.routing.modelUsed).toBe("llama-3.1-8b-instant");
  });

  it("falls back to defaultKind when body omits kind", async () => {
    server.use(
      http.post(GROQ_URL, async ({ request }) => {
        const body = (await request.json()) as { model: string };
        return HttpResponse.json(fakeCompletion(body.model));
      }),
    );
    const app = makeApp();
    const res = await request(app).post("/chat").send({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.routing.kind).toBe("balanced");
  });

  it("forwards a 429-then-fallback chain transparently", async () => {
    server.use(
      http.post(GROQ_URL, async ({ request }) => {
        const body = (await request.json()) as { model: string };
        if (body.model === "llama-3.3-70b-versatile") {
          return new HttpResponse(JSON.stringify({ error: "rate" }), {
            status: 429,
            headers: { "content-type": "application/json", "retry-after": "0" },
          });
        }
        return HttpResponse.json(fakeCompletion(body.model, "from fallback"));
      }),
    );
    const app = makeApp();
    const res = await request(app).post("/chat").send({
      kind: "balanced",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.routing.fellBack).toBe(true);
    expect(res.body.choices[0].message.content).toBe("from fallback");
  });
});

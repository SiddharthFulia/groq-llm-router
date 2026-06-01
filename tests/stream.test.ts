import { describe, expect, it } from "vitest";
import { parseSSEStream } from "../src/client/stream.js";

function streamFromBytes(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

function enc(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe("parseSSEStream", () => {
  it("parses single-chunk SSE", async () => {
    const body = streamFromBytes([
      enc(`data: ${JSON.stringify({ choices: [{ delta: { content: "Hello" } }] })}\n\n`),
      enc(`data: ${JSON.stringify({ choices: [{ delta: { content: " world" } }] })}\n\n`),
      enc(`data: ${JSON.stringify({ choices: [{ finish_reason: "stop", delta: {} }] })}\n\n`),
      enc(`data: [DONE]\n\n`),
    ]);
    const out: string[] = [];
    for await (const d of parseSSEStream(body)) {
      if (d.content) out.push(d.content);
    }
    expect(out.join("")).toBe("Hello world");
  });

  it("handles events split across chunks", async () => {
    const full =
      `data: ${JSON.stringify({ choices: [{ delta: { content: "abc" } }] })}\n\n` +
      `data: ${JSON.stringify({ choices: [{ delta: { content: "def" } }] })}\n\n` +
      `data: [DONE]\n\n`;
    const bytes = enc(full);
    const splits: Uint8Array[] = [];
    for (let i = 0; i < bytes.length; i += 7) {
      splits.push(bytes.slice(i, i + 7));
    }
    const body = streamFromBytes(splits);
    const out: string[] = [];
    for await (const d of parseSSEStream(body)) {
      if (d.content) out.push(d.content);
    }
    expect(out.join("")).toBe("abcdef");
  });

  it("survives a UTF-8 codepoint split across two TCP chunks", async () => {
    // 你好 = 3 bytes each. Split mid-codepoint of 你.
    const payload = `data: ${JSON.stringify({ choices: [{ delta: { content: "你好" } }] })}\n\n`;
    const bytes = enc(payload);
    const target = bytes.indexOf(0xe4);
    expect(target).toBeGreaterThan(0);
    const a = bytes.slice(0, target + 1);
    const b = bytes.slice(target + 1);
    const body = streamFromBytes([a, b]);

    const out: string[] = [];
    for await (const d of parseSSEStream(body)) {
      if (d.content) out.push(d.content);
    }
    expect(out.join("")).toBe("你好");
  });

  it("ignores comment / keepalive lines", async () => {
    const body = streamFromBytes([
      enc(`: keep-alive\n\n`),
      enc(`data: ${JSON.stringify({ choices: [{ delta: { content: "ok" } }] })}\n\n`),
      enc(`data: [DONE]\n\n`),
    ]);
    const out: string[] = [];
    for await (const d of parseSSEStream(body)) {
      if (d.content) out.push(d.content);
    }
    expect(out.join("")).toBe("ok");
  });

  it("emits a finish_reason on [DONE]", async () => {
    const body = streamFromBytes([enc(`data: [DONE]\n\n`)]);
    const events = [];
    for await (const d of parseSSEStream(body)) events.push(d);
    expect(events).toEqual([{ content: null, finish_reason: "stop" }]);
  });
});

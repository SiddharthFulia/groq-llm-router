import type { StreamDelta } from "../types/Result.js";

/** Parse an OpenAI-compatible SSE chat-completions stream. UTF-8 boundary-safe. */
export async function* parseSSEStream(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamDelta> {
  const reader = body.getReader();
  // stream:true buffers partial codepoints across chunks
  const decoder = new TextDecoder("utf-8");
  let buf = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        buf += decoder.decode();
        for (const ev of splitEvents(buf, true)) {
          const delta = parseEvent(ev);
          if (delta) yield delta;
        }
        return;
      }
      buf += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const delta = parseEvent(raw);
        if (delta) yield delta;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function* splitEvents(s: string, includePartial: boolean): Iterable<string> {
  if (!s) return;
  const parts = s.split("\n\n");
  const last = parts.length - 1;
  for (let i = 0; i < parts.length; i++) {
    if (i === last && !includePartial && parts[i] !== "") continue;
    if (parts[i]) yield parts[i]!;
  }
}

interface RawChunk {
  choices: Array<{
    delta?: { content?: string; tool_calls?: StreamDelta["tool_calls"] };
    finish_reason?: "stop" | "length" | "tool_calls" | "content_filter" | null;
  }>;
}

function parseEvent(raw: string): StreamDelta | null {
  const lines = raw.split("\n");
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith(":")) continue; // SSE keepalive
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  const payload = dataLines.join("\n");
  if (payload === "[DONE]") return { content: null, finish_reason: "stop" };

  let parsed: RawChunk;
  try {
    parsed = JSON.parse(payload) as RawChunk;
  } catch {
    return null;
  }
  const choice = parsed.choices?.[0];
  if (!choice) return null;
  return {
    content: choice.delta?.content ?? null,
    tool_calls: choice.delta?.tool_calls,
    finish_reason: choice.finish_reason ?? undefined,
  };
}

import { route, routeStream } from "../router.js";
import type { RouteOptions } from "../router.js";
import type { Message } from "../types/Messages.js";
import { isRouteKind, type RouteKind } from "../types/RouteKind.js";

// Duck-typed Context so we don't take a runtime dep on hono.
export interface HonoLikeContext {
  req: { json: () => Promise<unknown> };
  json: (body: unknown, status?: number) => Response;
}

export interface HonoMiddlewareOptions extends RouteOptions {
  defaultKind?: RouteKind;
}

interface ChatBody {
  kind?: unknown;
  messages?: unknown;
  stream?: unknown;
  temperature?: unknown;
  max_tokens?: unknown;
}

/** Hono / Cloudflare Workers handler. Mount with `app.post("/chat", honoGroqRouter())`. */
export function honoGroqRouter(opts: HonoMiddlewareOptions = {}) {
  const defaultKind: RouteKind = opts.defaultKind ?? "balanced";

  return async (c: HonoLikeContext): Promise<Response> => {
    const body = ((await c.req.json().catch(() => ({}))) ?? {}) as ChatBody;
    const kind: RouteKind = isRouteKind(body.kind) ? body.kind : defaultKind;
    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: "messages must be a non-empty array" }, 400);
    }

    const input = {
      kind,
      messages: messages as Message[],
      temperature: typeof body.temperature === "number" ? body.temperature : undefined,
      max_tokens: typeof body.max_tokens === "number" ? body.max_tokens : undefined,
    };

    if (body.stream === true) {
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const encoder = new TextEncoder();
          try {
            for await (const delta of routeStream(input, opts)) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(delta)}\n\n`));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`));
          } finally {
            controller.close();
          }
        },
      });
      return new Response(stream, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
        },
      });
    }

    const result = await route(input, opts);
    return c.json(result);
  };
}

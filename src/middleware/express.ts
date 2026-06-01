import type { Request, Response, NextFunction, RequestHandler } from "express";
import { route, routeStream } from "../router.js";
import type { RouteOptions } from "../router.js";
import type { Message } from "../types/Messages.js";
import { isRouteKind, type RouteKind } from "../types/RouteKind.js";

export interface GroqRouterMiddlewareOptions extends RouteOptions {
  defaultKind?: RouteKind;
  maxBodyMessages?: number;
}

interface ChatBody {
  kind?: unknown;
  messages?: unknown;
  stream?: unknown;
  temperature?: unknown;
  max_tokens?: unknown;
}

/** Drop-in Express handler. Body: { kind?, messages, stream?, temperature?, max_tokens? }. */
export function groqRouter(opts: GroqRouterMiddlewareOptions = {}): RequestHandler {
  const defaultKind: RouteKind = opts.defaultKind ?? "balanced";
  const maxMessages = opts.maxBodyMessages ?? 200;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = (req.body ?? {}) as ChatBody;
      const kind: RouteKind = isRouteKind(body.kind) ? body.kind : defaultKind;
      const messages = body.messages;
      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: "messages must be a non-empty array" });
        return;
      }
      if (messages.length > maxMessages) {
        res.status(413).json({ error: `too many messages (max ${maxMessages})` });
        return;
      }

      const wantsStream = body.stream === true;
      const baseInput = {
        kind,
        messages: messages as Message[],
        temperature: typeof body.temperature === "number" ? body.temperature : undefined,
        max_tokens: typeof body.max_tokens === "number" ? body.max_tokens : undefined,
      };

      if (wantsStream) {
        res.setHeader("content-type", "text/event-stream");
        res.setHeader("cache-control", "no-cache, no-transform");
        res.setHeader("connection", "keep-alive");
        res.flushHeaders?.();
        for await (const delta of routeStream(baseInput, opts)) {
          res.write(`data: ${JSON.stringify(delta)}\n\n`);
        }
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      const result = await route(baseInput, opts);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}

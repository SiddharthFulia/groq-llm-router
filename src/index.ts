export { route, routeStream } from "./router.js";
export type { RouteInput, RouteOptions } from "./router.js";

export { chainFor, primaryFor } from "./router/rules.js";
export { classifyError, retryAfterMs } from "./router/fallback.js";

export { GroqHttpError } from "./client/groq.js";
export type { GroqCallOptions, GroqRequest } from "./client/groq.js";

export { estimateTokens, estimateString, fitsInContext } from "./models/estimate.js";
export { MODELS, getModel, requireModel } from "./models/catalog.js";
export type { ModelSpec, KnownModelId } from "./models/catalog.js";

export type { Message, Role, ToolCall, ToolDefinition } from "./types/Messages.js";
export type { RouteKind } from "./types/RouteKind.js";
export { ALL_KINDS, isRouteKind } from "./types/RouteKind.js";
export type {
  ChatCompletion,
  Choice,
  Usage,
  RouteResult,
  RoutingInfo,
  StreamDelta,
} from "./types/Result.js";

export { anySignal, timeoutSignal } from "./utils/abort.js";
export { InflightCache, routeKey } from "./utils/idempotency.js";

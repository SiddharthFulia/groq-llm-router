import type { Message, ToolCall } from "./Messages.js";
import type { RouteKind } from "./RouteKind.js";

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface Choice {
  index: number;
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
  message: Message & { tool_calls?: ToolCall[] };
}

export interface ChatCompletion {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Choice[];
  usage?: Usage;
}

export interface RoutingInfo {
  kind: RouteKind;
  modelUsed: string;
  attempts: number;
  fellBack: boolean;
  trace: Array<{ model: string; status: number | "ok" | "error"; ms: number }>;
}

export interface RouteResult extends ChatCompletion {
  routing: RoutingInfo;
}

export interface StreamDelta {
  content: string | null;
  tool_calls?: Array<Partial<ToolCall> & { index: number }>;
  finish_reason?: Choice["finish_reason"];
}

export type RouteKind = "fast" | "balanced" | "tools";

export const ALL_KINDS: ReadonlyArray<RouteKind> = ["fast", "balanced", "tools"];

export function isRouteKind(x: unknown): x is RouteKind {
  return typeof x === "string" && (ALL_KINDS as readonly string[]).includes(x);
}

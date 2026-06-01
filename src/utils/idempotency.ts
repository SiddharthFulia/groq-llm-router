/** In-flight dedup. NOT a result cache — entry is dropped on settle. */
export class InflightCache<T> {
  private readonly map = new Map<string, Promise<T>>();

  share(key: string, produce: () => Promise<T>): Promise<T> {
    const existing = this.map.get(key);
    if (existing) return existing;
    const p = produce().finally(() => {
      // guard re-entrant share() that replaced the entry
      if (this.map.get(key) === p) this.map.delete(key);
    });
    this.map.set(key, p);
    return p;
  }

  size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}

/** Stable key for a route() call. Identical inputs → identical key. */
export function routeKey(kind: string, messages: ReadonlyArray<unknown>): string {
  return kind + "::" + JSON.stringify(messages);
}

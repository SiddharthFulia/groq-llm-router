import { route, type RouteKind } from "../src/index.js";

const KINDS: RouteKind[] = ["fast", "balanced", "tools"];

async function main(): Promise<void> {
  const messages = [
    { role: "system" as const, content: "Be concise. One sentence." },
    { role: "user" as const, content: "What is the time complexity of quicksort, worst case?" },
  ];

  for (const kind of KINDS) {
    const start = Date.now();
    const res = await route({ kind, messages, max_tokens: 80 });
    const ms = Date.now() - start;
    const reply = res.choices[0]?.message.content?.trim() ?? "(no content)";
    console.log(`\n[${kind} → ${res.routing.modelUsed} • ${ms}ms]`);
    console.log(`  ${reply}`);
    if (res.usage) {
      console.log(`  tokens: ${res.usage.prompt_tokens}p + ${res.usage.completion_tokens}c`);
    }
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

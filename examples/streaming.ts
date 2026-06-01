import { routeStream } from "../src/index.js";

async function main(): Promise<void> {
  let routingPrinted = false;
  for await (const delta of routeStream({
    kind: "fast",
    messages: [{ role: "user", content: "Write a four-line haiku about TypeScript types." }],
    temperature: 0.7,
    max_tokens: 80,
  })) {
    if (!routingPrinted && delta.routing) {
      process.stderr.write(`# served by ${delta.routing.modelUsed}\n`);
      routingPrinted = true;
    }
    if (delta.content) process.stdout.write(delta.content);
  }
  process.stdout.write("\n");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

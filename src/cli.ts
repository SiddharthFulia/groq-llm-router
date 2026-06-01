#!/usr/bin/env node
import { route, routeStream } from "./router.js";
import { isRouteKind, type RouteKind } from "./types/RouteKind.js";

interface ParsedArgs {
  kind: RouteKind;
  stream: boolean;
  prompt: string;
  system?: string;
  showRouting: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  let kind: RouteKind = "balanced";
  let stream = false;
  let showRouting = false;
  let system: string | undefined;
  const rest: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--kind" || a === "-k") {
      const v = argv[++i];
      if (!isRouteKind(v)) {
        console.error(`error: --kind must be one of fast | balanced | tools (got ${v})`);
        process.exit(2);
      }
      kind = v;
    } else if (a === "--stream" || a === "-s") {
      stream = true;
    } else if (a === "--system") {
      system = argv[++i];
    } else if (a === "--routing") {
      showRouting = true;
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else {
      rest.push(a);
    }
  }

  const prompt = rest.join(" ").trim();
  if (!prompt) {
    printHelp();
    process.exit(2);
  }
  return { kind, stream, prompt, system, showRouting };
}

function printHelp(): void {
  process.stdout.write(
    [
      "groq-route — route a one-shot chat through the best Groq model",
      "",
      "USAGE:",
      "  groq-route [--kind fast|balanced|tools] [--stream] [--system <prompt>] [--routing] <prompt>",
      "",
      "OPTIONS:",
      "  -k, --kind <k>       Workload kind (default: balanced)",
      "  -s, --stream         Stream tokens to stdout",
      "      --system <p>     Prepend a system prompt",
      "      --routing        Print routing metadata to stderr",
      "  -h, --help           Show this message",
      "",
      "ENV:",
      "  GROQ_API_KEY         Required.",
      "",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const messages = [
    ...(args.system ? [{ role: "system" as const, content: args.system }] : []),
    { role: "user" as const, content: args.prompt },
  ];

  if (args.stream) {
    let routingPrinted = false;
    for await (const delta of routeStream({ kind: args.kind, messages })) {
      if (args.showRouting && !routingPrinted && delta.routing) {
        process.stderr.write(`# routing: ${JSON.stringify(delta.routing)}\n`);
        routingPrinted = true;
      }
      if (delta.content) process.stdout.write(delta.content);
    }
    process.stdout.write("\n");
    return;
  }

  const res = await route({ kind: args.kind, messages });
  const text = res.choices[0]?.message.content ?? "";
  process.stdout.write(text + "\n");
  if (args.showRouting) {
    process.stderr.write(`# routing: ${JSON.stringify(res.routing)}\n`);
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`groq-route: ${msg}\n`);
  process.exit(1);
});

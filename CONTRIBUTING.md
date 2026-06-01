# Contributing

Thanks for considering a contribution.

## Dev setup

```bash
git clone https://github.com/SiddharthFulia/groq-llm-router.git
cd groq-llm-router
npm install
npm test
```

## Project layout

- `src/router.ts` — top-level `route()` / `routeStream()`.
- `src/router/rules.ts` — change kind→model mapping here.
- `src/client/groq.ts` — HTTP call to Groq. No third-party HTTP libs allowed (we use native `fetch`).
- `src/models/catalog.ts` — bump this when Groq publishes a new model.
- `tests/` — vitest + msw. Add a regression test for any bug fix.

## Coding standards

- TypeScript strict mode is on. No `any` without a `// eslint-disable` comment and a reason.
- Prefer pure functions; side effects belong in `client/` and `middleware/`.
- No new runtime dependencies. Dev-only deps are fine.

## Adding a new model

1. Add an entry to `src/models/catalog.ts`.
2. If it should participate in fallback, add it to the chain in `src/router/rules.ts`.
3. Update `docs/MODELS.md` and `README.md`.
4. Add a unit test covering the chain change.

## Commit style

Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.

## Reporting bugs

Open an issue with a minimal reproduction (messages + kind + observed vs expected). Redact your API key.

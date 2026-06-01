# Changelog

All notable changes to this project will be documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-06-01

### Added
- Initial release.
- `route()` and `routeStream()` core API.
- Kind-based routing (`fast` / `balanced` / `tools`) with ordered model preference per kind.
- Automatic fallback through the model chain on `429` / `503`.
- Retry with exponential backoff + jitter on transient errors.
- Token-budget estimator (`estimateTokens`) calibrated against tiktoken for English text.
- Streaming SSE parser that survives split UTF-8 boundaries.
- Express middleware (`groqRouter`) and Hono middleware (`honoGroqRouter`).
- CLI: `groq-route --kind <fast|balanced|tools> "<prompt>"`.
- Idempotency cache deduplicates identical concurrent requests.
- Vitest + msw test suite with mocked 429, streaming, and middleware fixtures.

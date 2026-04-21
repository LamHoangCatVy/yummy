# YUMMY Backend (TypeScript / Hono)

TypeScript port of the Python FastAPI backend. Strict API parity with the original — same paths, payloads, error shape (`{detail: string}`), and port (8000) so the existing frontend works unchanged.

## Stack

- **Runtime**: Node.js 20+
- **Framework**: [Hono](https://hono.dev) via `@hono/node-server`
- **Validation + Docs**: `@hono/zod-openapi` (auto Swagger UI at `/docs`)
- **DB**: SQLite + [Drizzle ORM](https://orm.drizzle.team) (`better-sqlite3`)
- **Tests**: Vitest

## AI providers

| Provider | Library | Notes |
|----------|---------|-------|
| Gemini   | `@google/genai`                       | Native streaming |
| OpenAI   | `openai`                              | Native streaming |
| Bedrock  | `@aws-sdk/client-bedrock-runtime`     | `ConverseCommand` / `ConverseStreamCommand` |
| Ollama   | `ollama` (npm)                        | One client per call so `abort()` is request-scoped |
| Copilot  | `openai` SDK → `api.githubcopilot.com` | Bearer `COPILOT_GITHUB_TOKEN` + `Copilot-Integration-Id: vscode-chat` |

### Copilot setup

Set `COPILOT_GITHUB_TOKEN` in `.env` to a valid GitHub Copilot token. No CLI needed.

## Quick start

```bash
pnpm install
cp .env.example .env        # fill in provider keys
pnpm db:generate            # generate SQL migrations
pnpm db:migrate             # apply to ./data/yummy.db
pnpm dev                    # http://localhost:8000  (docs at /docs)
```

## Scripts

| Script              | Purpose                                  |
|---------------------|------------------------------------------|
| `pnpm dev`          | Hot-reload server via tsx                |
| `pnpm start`        | Run without watcher                      |
| `pnpm build`        | Type-check & emit to `dist/`             |
| `pnpm test`         | Vitest single run                        |
| `pnpm test:watch`   | Vitest watch mode                        |
| `pnpm lint`         | Biome lint                               |
| `pnpm format`       | Biome format                             |
| `pnpm db:generate`  | Generate Drizzle migrations from schema  |
| `pnpm db:migrate`   | Apply migrations                         |
| `pnpm db:studio`    | Drizzle Studio                           |

## Layout

```
src/
├── config/          # Environment + runtime mutable config
├── db/              # Drizzle schema, client, repositories, migrations
├── schemas/         # Zod request/response schemas (snake_case preserved)
├── modules/         # Feature routers (utils, config, sessions, kb, ask, sdlc, metrics)
├── services/        # github, scan, ai (+ 5 providers)
├── middleware/      # Error handler, request context
└── lib/             # errors, ids, sse helpers
```

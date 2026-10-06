# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

StreamSouk v2 is a video streaming platform being rebuilt as a monorepo (v1 was removed; see README.md). It is a pnpm workspace (root `pnpm-workspace.yaml`, one lockfile) with two apps: `server/`, an Express 5 + TypeScript API backed by Postgres via Prisma 7, and `web/`, a Next.js (App Router) front end. Run `pnpm install` once at the repo root, then run each app's scripts with `pnpm --filter server <script>` or `pnpm --filter web <script>` (or from inside its directory). Visual direction and color tokens are in `docs/design.md`.

## Commands

### server (run from `server/`)

- `pnpm dev` — run the API with `tsx watch src/app.ts` (default port 3000, `PORT` env overrides)
- `pnpm tusd` — run the `tusd` upload server, pointing its hooks at `http://localhost:3000/api/v1/webhooks/tusd` (requires the `tusd` binary installed locally)
- `pnpm generate` — `prisma generate` (client output goes to `server/generated/prisma`)
- `pnpm migrate` — `prisma migrate dev`
- `pnpm studio` — Prisma Studio
- `pnpm test` — run the Vitest suite once; `pnpm test:watch` for watch mode; `pnpm exec vitest run src/createApp.test.ts` for a single file
- `pnpm typecheck` — `tsc` with `noEmit`
- There is no lint script yet.

Tests live beside the code as `*.test.ts` and exercise the API over real HTTP: `createApp()` (in `src/createApp.ts`) builds the Express app without listening, so a test starts it on port 0. `src/app.ts` is only the entry point that loads env and listens.

Setup: copy `.env.example` to `.env` and set `DATABASE_URL`.

### web (run from `web/`)

- `pnpm dev` — Next.js dev server on port 3001 (the API is expected at `API_URL`, default `http://localhost:3000`; copy `web/.env.example` to `web/.env.local` to change it)
- `pnpm build` / `pnpm start` — production build and server (also on 3001; use `pnpm exec next start -p <port>` if 3001 is taken)
- `pnpm test`, `pnpm test:watch`, `pnpm exec vitest run src/lib/api-client.test.ts` — Vitest, same as the server
- `pnpm typecheck` — `tsc` with `noEmit`

## Architecture

Layered structure under `server/src`: `routes/` → `controllers/` → `services/` → `repositories/` → `lib/prisma.ts`. All routes are mounted under `/api/v1` in `src/createApp.ts` (`/videos`, `/users`, `/webhooks`). Much of this is still scaffolding: several controllers return stub `{ msg: "Success" }`, and `auth.service.ts`, `utils/jwt.ts` are empty.

### Resumable uploads via tusd
Video uploads are not handled by Express. A separate `tusd` process receives the tus uploads and calls back into `POST /api/v1/webhooks/tusd` (`WebhooksController.tusd`), which dispatches on the hook `Type` (`pre-create`, `post-finish`, etc.) to `TusdService`. Responses must follow tusd's hook protocol: always HTTP 200, and rejecting an upload is done with `{ RejectUpload: true, HTTPResponse: {...} }` in the body, not a non-2xx status. Hook payload types are in `src/types/tusd.types.ts`. `preCreate` auth is currently a placeholder (compares the Authorization header to a literal) with TODOs to use real JWT verification; `postFinish` only logs.

### Auth
`AuthenticationMiddleware.verifyToken` reads the token from the `Authorization` header or a `token` cookie and currently just assigns it to `req.user` (no verification). `req.user` is typed in `src/@types/express/index.d.ts`. Known bug: it uses `res.send(401).json(...)` instead of `res.status(401).json(...)`.

### Prisma 7 specifics
- Generated client lives in `server/generated/prisma` (gitignored, so run `pnpm generate` after cloning and after schema changes).
- The datasource URL is configured in `prisma7.config.ts` (not in `schema.prisma`), and the client is constructed with the `@prisma/adapter-pg` driver adapter in `src/lib/prisma.ts`.
- Import generated client with the `.ts` extension, e.g. `../../generated/prisma/client.ts`.

## TypeScript conventions (server)

ESM (`"type": "module"`), run directly by `tsx` with no build step. Relative imports use explicit `.ts` extensions (`rewriteRelativeImportExtensions`). `erasableSyntaxOnly` is on, so no enums, parameter properties, or namespaces; `verbatimModuleSyntax` requires `import type` for type-only imports.

## Web app

Pages are server components that call the API through `src/lib/api-client.ts` (server-side, so no CORS setup is needed). Styling uses the semantic CSS variables defined once in `src/app/globals.css`; never write raw colors in components. Imports are extensionless (bundler resolution), unlike the server. Tests exercise the API client over real HTTP against a stub server; there are no component tests yet.

## Git workflow

`v2` is the default branch. Work flows: ticket (GitHub issue) → feature branch from `v2` → implement → code review → pull request → merge into `v2`. Never commit directly to `v2`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`azeemuddinaziz/streaming`), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

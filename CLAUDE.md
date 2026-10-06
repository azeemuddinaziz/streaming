# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

StreamSouk v2 is a video streaming platform being rebuilt as a monorepo (v1 was removed; see README.md). Currently only `server/` exists: an Express 5 + TypeScript API backed by Postgres via Prisma 7. All commands below run from `server/`. Package manager is pnpm.

## Commands

- `pnpm dev` — run the API with `tsx watch src/app.ts` (default port 3000, `PORT` env overrides)
- `pnpm tusd` — run the `tusd` upload server, pointing its hooks at `http://localhost:3000/api/v1/webhooks/tusd` (requires the `tusd` binary installed locally)
- `pnpm generate` — `prisma generate` (client output goes to `server/generated/prisma`)
- `pnpm migrate` — `prisma migrate dev`
- `pnpm studio` — Prisma Studio
- No test or lint scripts exist yet (`pnpm test` is a placeholder). Type-check with `pnpm exec tsc` (`noEmit` is set).

Setup: copy `.env.example` to `.env` and set `DATABASE_URL`.

## Architecture

Layered structure under `server/src`: `routes/` → `controllers/` → `services/` → `repositories/` → `lib/prisma.ts`. All routes are mounted under `/api/v1` in `src/app.ts` (`/videos`, `/users`, `/webhooks`). Much of this is still scaffolding: several controllers return stub `{ msg: "Success" }`, and `auth.service.ts`, `utils/jwt.ts` are empty.

### Resumable uploads via tusd
Video uploads are not handled by Express. A separate `tusd` process receives the tus uploads and calls back into `POST /api/v1/webhooks/tusd` (`WebhooksController.tusd`), which dispatches on the hook `Type` (`pre-create`, `post-finish`, etc.) to `TusdService`. Responses must follow tusd's hook protocol: always HTTP 200, and rejecting an upload is done with `{ RejectUpload: true, HTTPResponse: {...} }` in the body, not a non-2xx status. Hook payload types are in `src/types/tusd.types.ts`. `preCreate` auth is currently a placeholder (compares the Authorization header to a literal) with TODOs to use real JWT verification; `postFinish` only logs.

### Auth
`AuthenticationMiddleware.verifyToken` reads the token from the `Authorization` header or a `token` cookie and currently just assigns it to `req.user` (no verification). `req.user` is typed in `src/@types/express/index.d.ts`. Known bug: it uses `res.send(401).json(...)` instead of `res.status(401).json(...)`.

### Prisma 7 specifics
- Generated client lives in `server/generated/prisma` (gitignored, so run `pnpm generate` after cloning and after schema changes).
- The datasource URL is configured in `prisma7.config.ts` (not in `schema.prisma`), and the client is constructed with the `@prisma/adapter-pg` driver adapter in `src/lib/prisma.ts`.
- Import generated client with the `.ts` extension, e.g. `../../generated/prisma/client.ts`.

## TypeScript conventions

ESM (`"type": "module"`), run directly by `tsx` with no build step. Relative imports use explicit `.ts` extensions (`rewriteRelativeImportExtensions`). `erasableSyntaxOnly` is on, so no enums, parameter properties, or namespaces; `verbatimModuleSyntax` requires `import type` for type-only imports.

## Git workflow

`v2` is the default branch. Work flows: ticket (GitHub issue) → feature branch from `v2` → implement → code review → pull request → merge into `v2`. Never commit directly to `v2`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`azeemuddinaziz/streaming`), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

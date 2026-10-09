# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

StreamSouk v2 is a video streaming platform being rebuilt as a monorepo (v1 was removed; see README.md). It is a pnpm workspace (root `pnpm-workspace.yaml`, one lockfile) with two apps: `server/`, an Express 5 + TypeScript API backed by Postgres via Prisma 7, and `web/`, a Next.js (App Router) front end. Run `pnpm install` once at the repo root, then run each app's scripts with `pnpm --filter server <script>` or `pnpm --filter web <script>` (or from inside its directory). Visual direction and color tokens are in `docs/design.md`.

## Commands

### server (run from `server/`)

- `pnpm dev` — run the API with `tsx watch src/app.ts` (default port 3000, `PORT` env overrides)
- `pnpm tusd` — run the `tusd` upload server, pointing its hooks at `http://localhost:3000/api/v1/webhooks/tusd` (requires the `tusd` binary installed locally)
- `pnpm worker` — run the background job worker (`tsx watch src/worker.ts`), a separate process from the API
- `pnpm generate` — `prisma generate` (client output goes to `server/generated/prisma`)
- `pnpm migrate` — `prisma migrate dev`
- `pnpm studio` — Prisma Studio
- `pnpm test` — run the Vitest suite once; `pnpm test:watch` for watch mode; `pnpm exec vitest run src/createApp.test.ts` for a single file
- `pnpm typecheck` — `tsc` with `noEmit`
- There is no lint script yet.

Tests live beside the code as `*.test.ts` and exercise the API over real HTTP: `createApp()` (in `src/createApp.ts`) builds the Express app without listening, so a test starts it on port 0. `src/app.ts` is only the entry point that loads env and listens.

Setup: copy `.env.example` to `.env` and set `DATABASE_URL`, `JWT_SECRET` and `WEB_ORIGIN`. Tests also need `TEST_DATABASE_URL`, a separate Postgres database that the suite wipes; `vitest.config.ts` refuses to run if it is missing or equals `DATABASE_URL`. Apply migrations to it with `DATABASE_URL=<test url> pnpm exec prisma migrate deploy`. Tests in `src/routes/` run the API over real HTTP against that database (`src/test/helpers.ts`).

### web (run from `web/`)

- `pnpm dev` — Next.js dev server on port 3001 (the API is expected at `API_URL`, default `http://localhost:3000`; copy `web/.env.example` to `web/.env.local` to change it)
- `pnpm build` / `pnpm start` — production build and server (also on 3001; use `pnpm exec next start -p <port>` if 3001 is taken)
- `pnpm test`, `pnpm test:watch`, `pnpm exec vitest run src/lib/api-client.test.ts` — Vitest, same as the server
- `pnpm typecheck` — `tsc` with `noEmit`

## Architecture

Layered structure under `server/src`: `routes/` → `controllers/` → `services/` → `repositories/` → `lib/prisma.ts`. All routes are mounted under `/api/v1` in `src/createApp.ts` (`/videos`, `/users`, `/webhooks`). Auth is implemented (see below); the videos controller has `GET /videos/mine` (the studio list), and its other handlers are still stubs returning `{ msg: "Success" }`.

### Resumable uploads via tusd
Video uploads are not handled by Express. The browser uploads straight to a separate `tusd` process (`pnpm tusd`, which runs `server/scripts/tusd.sh`: it reads `server/.env`, forwards the `Authorization` and `Cookie` headers to the hooks, allows only `WEB_ORIGIN` with credentials, and stores bytes in S3 when `S3_BUCKET` is set, otherwise in `server/data/uploads`). tusd calls back into `POST /api/v1/webhooks/tusd` (`WebhooksController.tusd`), which dispatches on the hook `Type` to `TusdService`. Responses must follow tusd's hook protocol: always HTTP 200, and rejecting an upload is done with `{ RejectUpload: true, HTTPResponse: {...} }` in the body, not a non-2xx status. Hook payload types are in `src/types/tusd.types.ts`.

`pre-create` identifies the person from the forwarded Bearer token or `token` cookie (`pickToken` in `src/utils/request-token.ts`, shared with `AuthenticationMiddleware`), and rejects a missing or invalid one with 401 and an upload with no `filename` metadata with 400. `post-create` is where the `Upload` record (tusd id, owning User, filename, size) is written, because the id only exists once tusd has created the upload; it is idempotent since tusd retries hooks. Nothing yet stops another User resuming an upload by its URL. `pre-finish` and `post-finish` both check that the person finishing the upload owns it (`checkFinisher`): tusd still sends `post-finish` when `pre-finish` refused the request (the refusal only changes the response), so `post-finish` re-checks and creates nothing for anyone else. `post-finish` turns the Upload into a private, processing `Video` on the owner's Channel exactly once (then queues its processing, see Video processing) (`UploadRepository.completeIntoVideo` claims the Upload in a transaction), and `GET /api/v1/videos/mine` lists the signed-in person's Videos for the studio, labelled with the Upload's filename. A wrong-user finish leaves the bytes in place with the Upload unfinished, to be discarded by the 24-hour cleanup. The web upload page (`/upload`, `UploadForm`) uses `tus-js-client`, which resumes a re-selected file from its browser-stored fingerprint.

### Background jobs
Work outside the request cycle goes through `createJobRunner()` in `src/lib/jobs.ts`, a thin wrapper over pg-boss that queues jobs in the app's own Postgres (a `pgboss` schema it creates itself, no extra infrastructure). A process that only queues (the API, once a ticket needs it) calls `start({ work: false })` and `enqueue(name, data)` and needs no handlers; the worker process (`src/worker.ts`) calls `start()`, which runs the handlers registered in `src/jobs/index.ts`. A failing job is retried `retryLimit` times (default 3) with backoff, then ends in the `failed` state, readable with `status(name, id)`. Register new jobs in `src/jobs/index.ts`; `register(name, handler, { schedule })` takes a UTC cron expression and the worker (only) stores the schedule in the database when it starts. `discard-stale-uploads` runs hourly: `UploadService.discardStale` finds Uploads unfinished for over 24 hours, claims each by setting `Upload.abandonedAt` (so an Upload finishing at that moment can no longer become a Video), then asks tusd to terminate it (`removeUploadBytes` in `src/lib/tusd.ts` sends `DELETE` to `TUSD_URL`, default `http://localhost:8080/files/`, which deletes the bytes in S3 or on disk; only tusd's own 204, or its `ERR_UPLOAD_NOT_FOUND` for bytes already gone, counts, since a wrong address answers 200 or a plain 404). The record is kept. If removal fails the claim is given back and the job fails, so the job runner retries it. Completed Uploads are never selected. `GET /api/v1/uploads/unfinished` lists the signed-in person's resumable Uploads (not completed, not abandoned, started under 24 hours ago), shown in the web studio.

### Video processing
`post-finish` queues a `process-video` job (`queueVideoProcessing` in `src/lib/video-queue.ts`, the API's own `start({ work: false })` connection) after creating the Video; if queueing fails the Video is marked failed rather than left processing. The worker runs `VideoProcessingService.process`: it downloads the original through a `Storage` (`src/lib/storage.ts`: S3 when `S3_BUCKET` is set, otherwise `server/data/uploads` for the original and `server/data/media` for output; it can read and write but not delete, so the original stays), runs the `Transcoder` (`src/lib/ffmpeg.ts`, needs `ffmpeg` and `ffprobe` on the PATH) into 6-second HLS Renditions (1080/720/480/360p, only heights up to the source's, audio in each), a `master.m3u8` and a first-frame `thumbnail.jpg`, uploads them under `videos/<videoId>/`, and marks the Video ready with its `Rendition` rows. Job handlers receive `{ final }`; on the last failed attempt the handler calls `VideoProcessingService.fail`, so a Video that cannot be processed ends `FAILED`. Only a `PROCESSING` Video is ever changed by these steps. `POST /api/v1/videos/:id/retry` (owner only; someone else's or a missing Video is 404, a Video that is not `FAILED` is 409) atomically flips a failed Video back to `PROCESSING` and queues it again from the kept original; if queueing fails it returns to `FAILED` (503). The studio shows a Retry button on failed Videos. Known gap: a worker killed during the last attempt leaves the Video processing (no sweeper yet); each ffmpeg command has a 10-minute timeout. The ffmpeg test skips when `ffmpeg` is missing.

### Video details and Visibility
`PATCH /api/v1/videos/:id` (owner only; someone else's or a missing Video is 404) saves `title` (max 100), `description` (max 5000) and `visibility`, whatever the Video's processing status. Text is trimmed and blank becomes null; a title equal to the Upload's filename is stored as null, since the filename is only a placeholder label (the studio list's `label` is `title ?? filename`). Any result that is UNLISTED or PUBLIC must have both a title and a description, else 400, so clearing either on a non-private Video is also refused. The studio edits these in `VideoDetailsForm`.

### Watching a Video
`GET /api/v1/videos/:id/watch` is open to anyone (`OptionalAuthenticationMiddleware.identify` reads a token if one comes, never refuses). A missing Video, or a PRIVATE one to anyone but its owner, is 404; a Video that is not READY reports `PROCESSING` to everyone but its owner (who also sees `FAILED`) and has no `playlistPath`. A READY one returns `playlistPath`, an address under `/api/v1/media/:token/...` where the token (`src/lib/media-token.ts`, audience `media`, 6 hours, not revocable: a Video made private stays playable through an issued token until it expires) names the Video; `verifyToken` rejects any token with an audience. `MediaController.serve` checks the token and a safe path inside `videos/<id>/`; playlists (`.m3u8`) are always read through `Storage.read` and streamed by the API so their relative addresses resolve back to it, other files redirect (302) to `Storage.signedUrl` (S3 presigned, 5 minutes, so the bucket stays private; the bucket needs CORS for `WEB_ORIGIN`) or are streamed when the store cannot sign (disk). The web page `/watch/[id]` is server-rendered with title and description metadata; `VideoPlayer` uses native HLS in Safari and `hls.js` elsewhere on a `<video controls>`.

### Deleting a Video
`DELETE /api/v1/videos/:id` (owner only; someone else's, a missing or an already deleted Video is 404, success is 204) sets `Video.deletedAt` and nothing else: no row or storage object is removed (ADR 0001). Every `VideoRepository` read and claim (`listForUser`, `findForWatch`, `findOwned`, `updateDetails`, `restartProcessing`, `findForProcessing`) filters `deletedAt: null`, so a deleted Video is not found on the watch page, in the studio, or for edit/retry; any new read path must do the same. Processing skips a deleted Video; media addresses already issued keep working until they expire. The studio asks for confirmation (`DeleteVideoButton`, `window.confirm`) before calling it.

### Counting Views
`POST /api/v1/videos/:id/views` (open to anyone, optional auth like the watch route; a missing, deleted or someone else's PRIVATE Video is 404, a Video that is not READY is 409) records a `View` and answers `{ counted, views }`. The unique key `(videoId, viewerKey, day)` keeps a Viewer to one View per Video per UTC day: `viewerKey` is `user:<id>` for a signed-in User, else `anon:` plus an HMAC-SHA256 (keyed with `JWT_SECRET`) of `req.ip` and the user agent, so the raw IP is never stored. The owner's own watching is never counted. The API cannot see playback, so the browser decides: `createViewTracker` (`web/src/lib/view-tracker.ts`) counts played time between `timeupdate`s (seeks add nothing) and `VideoPlayer` calls `reportView` after 30 seconds played, or at `ended` for a Video under 30 seconds. A client could therefore report falsely, and an anonymous caller who varies the user agent is counted again each time (there is no rate limit yet); the daily key only stops honest repeats. Behind a proxy `req.ip` is the proxy's until Express `trust proxy` is set. The watch response carries `views`, shown on the page.

### Custom Thumbnail
`PUT /api/v1/videos/:id/thumbnail` (owner only; someone else's or a missing Video is 404, a Video that is not READY is 409) takes the raw image as the request body (`Content-Type: image/*`, not multipart and not an Upload), at most 5 MB (413 over that; a non-image or unreadable file is 415). `makeThumbnails` (`src/lib/thumbnail.ts`, `sharp`) writes widths 320/640/1280 as WebP and JPEG under a fresh `videos/<id>/thumbnails/<uuid>/` folder (so a replaced image is never served stale) and `Video.thumbnailKey` points at its `w640.jpg`. The studio list returns `thumbnailPath` (a media-token address) and `ThumbnailPicker` shows it with a "Change thumbnail" file input on READY Videos. Replaced thumbnails are not deleted (storage cannot delete).

### Channel page
`GET /api/v1/channels/:name` (open to anyone; the name matches `User.nameKey` regardless of case, unknown is 404) returns `{ channel: { name }, videos }`: only the Channel's PUBLIC, READY, non-deleted Videos, newest first, each with `id`, `title`, `createdAt` and a media-token `thumbnailPath` (`ChannelRepository.listPublicVideos`; any new Channel read must keep the `deletedAt: null` and visibility filters). The web page `/channels/[name]` is server-rendered, shows "not found" for an unknown name, and the watch page links the channel name to it. `mediaPath` (in `src/lib/media-token.ts`) builds the served address of a stored file.

### Home page showcase
`GET /api/v1/videos?page=N` (open to anyone; the old stub) returns `{ videos, page, hasMore }`: PUBLIC, READY, non-deleted Videos of every Channel, newest first (`VideoRepository.listPublic`, ties broken by id), 24 per page; a missing or invalid `page` is 1. The repository asks for one extra row to set `hasMore`, so there is no count query. Each entry has `id`, `title`, `createdAt`, `channelName` and a media-token `thumbnailPath`. The home page (`/`, server-rendered, `?page=N`) renders them with `VideoCard` (also used by the Channel page) and shows an empty state and Newer/Older links; a Video's thumbnail and title link to its watch page and its Channel name to the Channel page. Page numbers are offsets, so a Video published meanwhile shifts later pages by one.

### Auth
The API signs people in with a JWT (`jose`, HS256, signed with `JWT_SECRET`). Sign-up and sign-in set it as an `httpOnly`, `SameSite=Lax` `token` cookie (optionally on `COOKIE_DOMAIN` so a web app and API on sibling subdomains share it; `Secure` is set only when `NODE_ENV=production`) valid for 30 days. `AuthenticationMiddleware.verifyToken` accepts the cookie or an `Authorization: Bearer <token>` header (meant for the upload server), loads the User from the database, sets `req.user` and `req.channel`, and swaps a cookie older than a day for a fresh one, so active people stay signed in. There is no revoke; sign-out only clears the cookie. Passwords are hashed with Node's built-in scrypt. CORS allows exactly `WEB_ORIGIN`, with credentials. Routes: `POST /users/sign-up`, `/users/sign-in`, `/users/sign-out`, `GET /users/me`.

Account rules live in `AuthService`: the account name is 3 to 30 characters of letters, digits and hyphens, unique regardless of case (`User.nameKey` holds the lowercased copy), and a Channel is created in the same transaction as its User. A Channel has no name column; it is named after its User. The tusd hooks use the same token (see Resumable uploads).

### Prisma 7 specifics
- Generated client lives in `server/generated/prisma` (gitignored, so run `pnpm generate` after cloning and after schema changes).
- The datasource URL is configured in `prisma7.config.ts` (not in `schema.prisma`), and the client is constructed with the `@prisma/adapter-pg` driver adapter in `src/lib/prisma.ts`.
- Import generated client with the `.ts` extension, e.g. `../../generated/prisma/client.ts`.

## TypeScript conventions (server)

ESM (`"type": "module"`), run directly by `tsx` with no build step. Relative imports use explicit `.ts` extensions (`rewriteRelativeImportExtensions`). `erasableSyntaxOnly` is on, so no enums, parameter properties, or namespaces; `verbatimModuleSyntax` requires `import type` for type-only imports.

## Web app

Server components call the API through `src/lib/api-client.ts` and forward the browser's cookie; the sign-up and sign-in forms are client components that call the API directly with `credentials: "include"` (hence the CORS allow-list). `API_URL` is the server-side address and `NEXT_PUBLIC_API_URL` the browser's. The header reads the `token` cookie to show who is signed in, so every page renders dynamically. Styling uses the semantic CSS variables defined once in `src/app/globals.css`; never write raw colors in components. Imports are extensionless (bundler resolution), unlike the server. Tests exercise the API client over real HTTP against a stub server; there are no component tests yet.

## UI/UX

UI/UX is not the focus of v2 yet, so first versions of screens are plain. Whenever you touch a screen, improve its UX where it is cheap and in scope (clear labels, inline validation, loading and empty states, confirmation after actions, accessible controls), following `docs/design.md`. Anything bigger goes in the "UX Improvements" section of ticket #1 rather than being skipped or silently expanded.

## Git workflow

`v2` is the default branch. Work flows: ticket (GitHub issue) → feature branch from `v2` → implement → code review → pull request → merge into `v2`. Never commit directly to `v2`.

## API reference

`docs/openapi.yaml` is a hand-written OpenAPI file the repo owner imports into Postman to browse and call every API (folders in order: Accounts, Uploading, Studio, Watching, Discovering, Internal). It also covers the tusd calls and, as text in its description, the worker's background jobs. Nothing generates or tests it, so any change to an endpoint, its auth or its responses (and any new or changed job) must update `docs/openapi.yaml` in the same ticket. Check it with `npx @apidevtools/swagger-cli validate docs/openapi.yaml`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`azeemuddinaziz/streaming`), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

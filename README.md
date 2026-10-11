# StreamSouk

> [!IMPORTANT]
>  **Status:** Currently in active development for `v2.0.0`. 
> The platform is undergoing a complete rebuild. You can join the waitlist at **[StreamSouk](https://streamsouk.azeemz.me/)** to get notified once we're live.

## Overview
StreamSouk is a video streaming platform built with a primary focus on learning and implementing those learnings. 

## The v2.0.0 Rebuild: Goals & Architecture
The current iteration of StreamSouk is a self-managed monorepo. The primary goals for this rebuild are:

* **Advanced Media Handling:** Learning engineering behind and implementing video, audio, and image processing from scratch.
* **Frontend Excellence:** Learning SEO and accessibility standards.

## Run locally
Three ways, pick one:

* **[Run with the guided script](#run-with-the-guided-script)**: one command that checks your machine, explains each step, asks, then starts the Docker stack and opens the browser.
* **[Run with Docker](#run-with-docker)**: one command, nothing to install but Docker.
* **[Run it manually](#run-it-manually)**: clone the repo and run the four processes yourself, with full control. This is the source of truth for how the app runs; the other sections and `CLAUDE.md` "Commands" describe the same things.

## Run with the guided script
A front end for the Docker setup below, for people who want to be walked through it. It needs Docker and `git`, nothing else, and it never installs anything. It is a plain script you clone and can read first.

```sh
git clone https://github.com/azeemuddinaziz/streaming.git
cd streaming
./scripts/start.sh
```

It checks your OS (macOS or Linux; on Windows use WSL), that Docker, `docker compose` and `curl` exist and the Docker daemon is running, and that ports 3000, 3001 and 8080 are free (naming the process that holds any that are not). It then explains what `docker compose up` will do, asks `[y/N]`, starts the stack, waits for the API and the web app to answer and opens **http://localhost:3001**.

| Flag | Effect |
| --- | --- |
| `--yes` | Accept every prompt (for CI) |
| `--no-open` | Do not open the browser |
| `--check` | Run the checks only; changes nothing |

A missing Docker, a busy port or a declined prompt each exit with a message and a non-zero code. If starting fails, what the script started is stopped again (volumes are kept). Running it a second time skips the build that is already done and just starts the stack. To stop or reset, see [Run with Docker](#run-with-docker).

## Run with Docker
Docker is the only prerequisite (about 4 GB of RAM allocated to it).

```sh
git clone https://github.com/azeemuddinaziz/streaming.git
cd streaming
docker compose up
```

Open **http://localhost:3001**. The API is on `:3000` and the upload server (tusd) on `:8080`.

* **Stop:** `docker compose down`. Accounts, Videos and uploads survive the next `up`.
* **Reset everything:** `docker compose down -v` (deletes the database, the uploaded bytes and the generated sign-in secret).
* **Worker stuck or killed:** `docker compose restart worker`.
* **After pulling changes:** `docker compose up --build`.

Limits: the first build takes several minutes, and transcoding speed depends on your machine. Media and share links use `localhost`, so they only work on the same machine. This is not for production: no TLS, no backups, and bytes stay on disk instead of S3.

## Run it manually
This is the source of truth for running StreamSouk from a clone. You run a Postgres database and four processes: the API, the background worker, the upload server (`tusd`) and the web app.

### 1. Prerequisites
| Tool | Version | macOS (Homebrew) | Linux (Debian/Ubuntu) |
| --- | --- | --- | --- |
| Node | 24 (what the Docker images use) | `brew install node@24` | `nvm install 24`, or [nodejs.org](https://nodejs.org) |
| pnpm | the repo pins 12.4.2 and pnpm downloads it when needed | `brew install pnpm` | `npm i -g pnpm` |
| Postgres | 17 (what Docker uses) | `brew install postgresql@17 && brew services start postgresql@17` | `sudo apt install postgresql && sudo systemctl start postgresql` |
| `tusd` | 2.x | `brew install tusd` | binary from the [tusd releases](https://github.com/tus/tusd/releases), put on your `PATH` |
| `ffmpeg` and `ffprobe` | any recent (one package provides both) | `brew install ffmpeg` | `sudo apt install ffmpeg` |

Check: `node -v`, `pnpm -v`, `psql --version`, `tusd -version`, `ffmpeg -version`, `ffprobe -version`.

### 2. Clone and install
```sh
git clone https://github.com/azeemuddinaziz/streaming.git
cd streaming
pnpm install
```

### 3. Create the databases
One for the app and a separate one the tests are allowed to wipe (only needed to run `pnpm --filter server test`).

```sh
createdb streamsouk
createdb streamsouk_test
```

On Linux the `postgres` user usually owns the server, so use `sudo -u postgres createdb ...` (and create a role for yourself with `sudo -u postgres createuser --superuser $USER`).

### 4. Configure
```sh
cp server/.env.example server/.env
cp web/.env.example web/.env.local
```

Edit `server/.env`:

* `DATABASE_URL=postgresql://<you>@localhost:5432/streamsouk` (add `:<password>` after the user if your Postgres has one; on a default Homebrew or Postgres.app install there is none).
* `TEST_DATABASE_URL=postgresql://<you>@localhost:5432/streamsouk_test` (must differ from `DATABASE_URL`).
* `JWT_SECRET`: paste the output of `openssl rand -base64 48`.
* Leave `WEB_ORIGIN` as `http://localhost:3001` and `S3_BUCKET` unset: uploaded bytes then stay on disk under `server/data/`.

`web/.env.local` works as copied.

### 5. Generate the client and migrate
```sh
pnpm --filter server generate
pnpm --filter server exec prisma migrate deploy
```

(`pnpm --filter server migrate` is `prisma migrate dev`, for changing the schema.) To prepare the test database too: `DATABASE_URL=<your TEST_DATABASE_URL> pnpm --filter server exec prisma migrate deploy`.

### 6. Start the four processes
One terminal each, from the repo root:

| Process | Command | Port |
| --- | --- | --- |
| API | `pnpm --filter server dev` | 3000 |
| Worker (transcoding, cleanup) | `pnpm --filter server worker` | none |
| Upload server | `pnpm --filter server tusd` | 8080 |
| Web | `pnpm --filter web dev` | 3001 |

### 7. Check that it works
1. Open **http://localhost:3001** and choose **Sign up**: a name of 3 to 30 letters, digits or hyphens, an email and a password.
2. Open **Upload**, choose a short video file and start the upload. The bar should reach 100%.
3. Open **Studio**. The Video shows *Processing* with a progress bar, then *Ready* after the worker has made the HLS Renditions and the thumbnail (seconds for a short clip).
4. In Studio choose **Edit**, give it a title and a description, set Visibility to Public and save. **Watch** plays it, and it appears on the home page.

If the Video stays on *Processing*, look at the worker terminal. `curl http://localhost:3000/api/v1/videos` returning `{"videos":[],...}` confirms the API and the database.

### Troubleshooting
* **Port already in use** (`EADDRINUSE` on 3000, 3001 or 8080): stop the other process, or run the API on another port with `PORT=<n>` in `server/.env` (the tusd script reads it too, and also set `API_URL` and `NEXT_PUBLIC_API_URL` in `web/.env.local`). For the web app: `pnpm --filter web exec next dev -p <n>`, and set `WEB_ORIGIN` in `server/.env` and `NEXT_PUBLIC_WEB_ORIGIN` to match. If Docker is running, `docker compose down` frees all three.
* **`tusd: command not found`**: install it (step 1) and make sure it is on your `PATH`; open a new terminal after installing.
* **Uploads fail with a network or CORS error**: `pnpm --filter server tusd` must be running, and `WEB_ORIGIN` in `server/.env` must be exactly the address in your browser (`http://localhost:3001`, not `127.0.0.1`).
* **Video fails or stays Processing**: `ffmpeg` and `ffprobe` must be on the worker's `PATH`; run `ffmpeg -version`. The worker must also be running. A failed Video has a Retry button in Studio.
* **Signed in, but signed out again on reload**: the cookie is not being set. Use `localhost` for both the web app and the API (not an IP address or a mix), and keep `NEXT_PUBLIC_API_URL` pointing at the API's address.
* **`JWT_SECRET` or `DATABASE_URL` errors on start, or `Environment variable not found`**: the file must be `server/.env`, and the commands must be run through `pnpm --filter server`.
* **Prisma client missing** (`Cannot find module .../generated/prisma`): run `pnpm --filter server generate`.

---

## Historical Context (v1.0.0)
The legacy version of StreamSouk (v1) has been officially deprecated and taken offline to make way for the new infrastructure. It featured basic video upload via Cloudinary, user authentication, and profile management, utilizing separate frontend and backend repositories.

If you are interested in the legacy code or the architectural starting point of this project, you can view the historical snapshot here:
* [v1.0.0 Release Notes](https://github.com/azeemuddinaziz/streaming/releases/tag/v1.00)
* [Legacy Frontend Repo](https://github.com/azeemuddinaziz/streaming_frontend)
* [Legacy Backend Repo](https://github.com/azeemuddinaziz/streaming_backend)

---

## License
StreamSouk is released under the [MIT License](LICENSE).

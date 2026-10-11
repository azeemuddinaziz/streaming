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

---

## Historical Context (v1.0.0)
The legacy version of StreamSouk (v1) has been officially deprecated and taken offline to make way for the new infrastructure. It featured basic video upload via Cloudinary, user authentication, and profile management, utilizing separate frontend and backend repositories.

If you are interested in the legacy code or the architectural starting point of this project, you can view the historical snapshot here:
* [v1.0.0 Release Notes](https://github.com/azeemuddinaziz/streaming/releases/tag/v1.00)
* [Legacy Frontend Repo](https://github.com/azeemuddinaziz/streaming_frontend)
* [Legacy Backend Repo](https://github.com/azeemuddinaziz/streaming_backend)

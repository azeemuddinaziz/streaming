# One image for the API and the worker (compose.yaml picks the command).
# Build from the repo root: docker build -f server/Dockerfile .
FROM node:24-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g pnpm@12.4.2

WORKDIR /app

# Dependencies first so source edits do not reinstall them. web/package.json is
# needed because the lockfile covers the whole workspace.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN pnpm install --frozen-lockfile --filter server...

COPY server/ server/
WORKDIR /app/server

# Generate the Prisma client, and fetch the schema engine now (it is otherwise
# downloaded on first use) so `migrate deploy` works offline at start.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build ./node_modules/.bin/prisma generate \
 && ./node_modules/.bin/prisma version

ENTRYPOINT ["sh", "/app/server/docker-entrypoint.sh"]
CMD ["./node_modules/.bin/tsx", "src/app.ts"]

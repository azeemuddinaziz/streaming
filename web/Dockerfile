# Build from the repo root: docker build -f web/Dockerfile .
FROM node:24-bookworm-slim

RUN npm install -g pnpm@12.4.2

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN pnpm install --frozen-lockfile --filter web...

COPY web/ web/
WORKDIR /app/web

# NEXT_PUBLIC_* are inlined into the browser bundle at build time, so they are
# build arguments. The defaults are the addresses of a local `docker compose up`.
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ARG NEXT_PUBLIC_TUS_URL=http://localhost:8080/files/
ARG NEXT_PUBLIC_WEB_ORIGIN=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_TUS_URL=$NEXT_PUBLIC_TUS_URL \
    NEXT_PUBLIC_WEB_ORIGIN=$NEXT_PUBLIC_WEB_ORIGIN

RUN ./node_modules/.bin/next build

EXPOSE 3001
CMD ["./node_modules/.bin/next", "start", "-p", "3001"]

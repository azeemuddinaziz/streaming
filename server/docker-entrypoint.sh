#!/bin/sh
# Container start for the API and the worker.
#  - JWT_SECRET: generated once and kept in the config volume, unless set.
#  - RUN_MIGRATIONS=true (the API only): apply migrations before listening.
set -e

SECRET_FILE="${JWT_SECRET_FILE:-/app/server/config/jwt-secret}"

if [ -z "$JWT_SECRET" ]; then
  if [ ! -s "$SECRET_FILE" ]; then
    mkdir -p "$(dirname "$SECRET_FILE")"
    umask 077
    TMP="$SECRET_FILE.$$"
    node -e 'process.stdout.write(require("node:crypto").randomBytes(48).toString("base64"))' > "$TMP"
    # -n: if another container got there first, keep its secret.
    mv -n "$TMP" "$SECRET_FILE"
    rm -f "$TMP"
  fi
  JWT_SECRET="$(cat "$SECRET_FILE")"
  export JWT_SECRET
fi

if [ "$RUN_MIGRATIONS" = "true" ]; then
  ./node_modules/.bin/prisma migrate deploy
fi

exec "$@"

#!/bin/sh
# Starts the tusd upload server: hooks into the API, accepts the web app's
# credentialed requests, and stores bytes in S3. Reads server/.env.
cd "$(dirname "$0")/.." || exit 1
if [ -f .env ]; then set -a; . ./.env; set +a; fi

PORT_API="${PORT:-3000}"
# tusd takes a regular expression, and credentials need one exact origin.
ORIGIN_PATTERN="^$(printf '%s' "${WEB_ORIGIN:-http://localhost:3001}" | sed 's/[][\\.*+?^$(){}|/]/\\&/g')\$"

if [ -n "$S3_BUCKET" ]; then
  # Credentials and region come from the standard AWS_* variables.
  STORAGE="-s3-bucket $S3_BUCKET"
  [ -n "$S3_ENDPOINT" ] && STORAGE="$STORAGE -s3-endpoint $S3_ENDPOINT"
else
  echo "S3_BUCKET is not set: keeping uploaded bytes in data/uploads instead of S3." >&2
  STORAGE="-upload-dir data/uploads"
fi

# shellcheck disable=SC2086
exec tusd \
  -hooks-http "http://localhost:$PORT_API/api/v1/webhooks/tusd" \
  -hooks-http-forward-headers Authorization,Cookie \
  -hooks-enabled-events pre-create,post-create,post-receive,pre-finish,post-finish,post-terminate \
  -cors-allow-origin "$ORIGIN_PATTERN" \
  -cors-allow-credentials \
  $STORAGE

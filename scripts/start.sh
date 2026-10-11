#!/usr/bin/env bash
#
# Guided start for StreamSouk: checks your machine, explains what it is about
# to do, asks, then starts the Docker Compose stack and opens the browser.
# It never installs anything. Read it first; it is meant to be read.
#
#   ./scripts/start.sh            walk through it, asking before each change
#   ./scripts/start.sh --yes      accept every prompt (for CI)
#   ./scripts/start.sh --no-open  do not open the browser
#   ./scripts/start.sh --check    steps 1 to 3 only; changes nothing

set -u

WEB_URL="http://localhost:3001"
API_HEALTH_URL="http://localhost:3000/api/v1/videos"
PORTS="3000 3001 8080"
HEALTH_TIMEOUT=300

YES=0
OPEN=1
CHECK_ONLY=0

usage() {
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
}

for arg in "$@"; do
  case "$arg" in
    --yes|-y) YES=1 ;;
    --no-open) OPEN=0 ;;
    --check) CHECK_ONLY=1 ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown option: %s\n\n' "$arg" >&2; usage >&2; exit 2 ;;
  esac
done

if [ -t 1 ] && command -v tput >/dev/null 2>&1 && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
  BOLD=$(tput bold); RESET=$(tput sgr0)
  GREEN=$(tput setaf 2); RED=$(tput setaf 1); BLUE=$(tput setaf 4)
else
  BOLD=""; RESET=""; GREEN=""; RED=""; BLUE=""
fi

STEP=0
TOTAL=7
[ "$CHECK_ONLY" -eq 1 ] && TOTAL=3

step() {
  STEP=$((STEP + 1))
  printf '\n%s%s[%s/%s] %s%s\n' "$BOLD" "$BLUE" "$STEP" "$TOTAL" "$1" "$RESET"
}
say() { printf '  %s\n' "$1"; }
ok() { printf '  %s✓%s %s\n' "$GREEN" "$RESET" "$1"; }
die() {
  printf '  %s✗ %s%s\n' "$RED" "$1" "$RESET" >&2
  shift
  for line in "$@"; do printf '    %s\n' "$line" >&2; done
  exit 1
}

# confirm "Question" asks [y/N]. --yes accepts; with no terminal to ask on,
# it refuses rather than guessing.
confirm() {
  if [ "$YES" -eq 1 ]; then
    printf '  %s [y/N] y (--yes)\n' "$1"
    return 0
  fi
  if [ ! -t 0 ]; then
    printf '  %s [y/N] no terminal to ask on; re-run with --yes to accept.\n' "$1" >&2
    return 1
  fi
  printf '  %s [y/N] ' "$1"
  read -r answer || return 1
  case "$answer" in y|Y|yes|YES|Yes) return 0 ;; *) return 1 ;; esac
}

# The script works from the repository root wherever it is called from.
cd "$(dirname "$0")/.." || exit 1
[ -f compose.yaml ] || die "compose.yaml not found next to scripts/." "Run this from a clone of the repository."

# ── 1. Operating system ────────────────────────────────────────────────────
step "Checking your operating system"
case "$(uname -s)" in
  Darwin) ok "macOS" ;;
  Linux) ok "Linux" ;;
  *)
    die "This script supports macOS and Linux only." \
      "On Windows, run it inside WSL, or follow the Docker or manual steps in the README:" \
      "https://github.com/azeemuddinaziz/streaming#run-locally"
    ;;
esac

# ── 2. Docker ──────────────────────────────────────────────────────────────
step "Checking Docker (this script never installs it)"
command -v docker >/dev/null 2>&1 \
  || die "Docker is not installed." "Install Docker Desktop (macOS) or Docker Engine (Linux): https://docs.docker.com/get-docker/" "Then run this script again."
ok "docker found"
docker compose version >/dev/null 2>&1 \
  || die "The 'docker compose' plugin is missing." "Install it: https://docs.docker.com/compose/install/" "Then run this script again."
ok "docker compose found"
docker info >/dev/null 2>&1 \
  || die "The Docker daemon is not running." "Start Docker Desktop (or 'sudo systemctl start docker' on Linux), wait until it is ready, then run this script again."
ok "the Docker daemon is running"
command -v curl >/dev/null 2>&1 \
  || die "curl is not installed; it is used to wait for the app to answer." "Install curl with your package manager, then run this script again."
ok "curl found"

# ── 3. Ports ───────────────────────────────────────────────────────────────
step "Checking that ports $PORTS are free"

# True when a StreamSouk container is already running: its ports are ours.
stack_running() {
  [ -n "$(docker compose ps --status running -q 2>/dev/null)" ]
}

# port_holder PORT prints what listens on it, or nothing when it is free.
port_holder() {
  local port=$1 out=""
  if command -v lsof >/dev/null 2>&1; then
    out=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -Fpc 2>/dev/null \
      | awk '/^p/ {pid=substr($0,2)} /^c/ {cmd=substr($0,2)} END {if (pid != "") print cmd " (pid " pid ")"}')
  elif command -v ss >/dev/null 2>&1; then
    out=$(ss -ltnpH "sport = :$port" 2>/dev/null | head -n 1 \
      | sed -n 's/.*users:(("\([^"]*\)",pid=\([0-9]*\).*/\1 (pid \2)/p')
    if [ -z "$out" ] && [ -n "$(ss -ltnH "sport = :$port" 2>/dev/null)" ]; then
      out="another program"
    fi
  fi
  if [ -z "$out" ] && (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
    out="another program"
  fi
  printf '%s' "$out"
}

ALREADY_RUNNING=0
if stack_running; then
  ALREADY_RUNNING=1
  ok "StreamSouk is already running here; its ports are in use by it"
else
  BUSY=0
  for port in $PORTS; do
    holder=$(port_holder "$port")
    if [ -n "$holder" ]; then
      printf '  %s✗%s port %s is held by %s\n' "$RED" "$RESET" "$port" "$holder" >&2
      BUSY=1
    else
      ok "port $port is free"
    fi
  done
  [ "$BUSY" -eq 0 ] || die "Free the ports above (stop that program, or 'docker compose down' in the project that uses them), then run this script again."
fi

if [ "$CHECK_ONLY" -eq 1 ]; then
  printf '\n%sAll checks passed. Nothing was changed.%s\n' "$GREEN" "$RESET"
  exit 0
fi

# ── 4. Explain, then ask ───────────────────────────────────────────────────
step "Starting the stack"
if [ "$ALREADY_RUNNING" -eq 1 ]; then
  say "Already running: 'docker compose up -d' will only start anything that stopped."
else
  say "'docker compose up -d' will:"
  say "  - build the API and web images (the first time this takes several minutes)"
  say "  - download the postgres and tusd images"
  say "  - create three Docker volumes (database, uploaded bytes, generated secret)"
  say "  - start postgres, the API, the worker, tusd and the web app in the background"
  say "Nothing outside Docker is changed. Stop it any time with 'docker compose down'."
fi
confirm "Continue?" || { printf '  Declined; nothing was started.\n' >&2; exit 1; }

# ── 5. Start and wait ──────────────────────────────────────────────────────
step "Running docker compose up"

# Take back what this run started, so a failure or Ctrl-C leaves nothing
# half-started. A stack that was already running is left alone.
STARTED_BY_US=0
undo_start() {
  if [ "$STARTED_BY_US" -eq 1 ] && [ "$ALREADY_RUNNING" -eq 0 ]; then
    printf '\n  Stopping what was started (volumes are kept)...\n' >&2
    docker compose down >/dev/null 2>&1
  fi
}
trap 'undo_start; exit 130' INT TERM

STARTED_BY_US=1
if ! docker compose up -d; then
  undo_start
  die "docker compose up failed." "Scroll up for the error. The stack was stopped; run this script again once it is fixed."
fi

wait_for() {
  local name=$1 url=$2 waited=0
  printf '  Waiting for the %s' "$name"
  while ! curl -fsS -o /dev/null --max-time 3 "$url" 2>/dev/null; do
    if [ "$waited" -ge "$HEALTH_TIMEOUT" ]; then
      printf '\n'
      undo_start
      die "The $name did not answer within ${HEALTH_TIMEOUT}s." "Check the logs with 'docker compose logs', fix the cause, then run this script again."
    fi
    printf '.'
    sleep 2
    waited=$((waited + 2))
  done
  printf ' %sready%s\n' "$GREEN" "$RESET"
}
wait_for "API" "$API_HEALTH_URL"
wait_for "web app" "$WEB_URL"
trap - INT TERM

# ── 6. Open the browser ────────────────────────────────────────────────────
step "Opening $WEB_URL"
if [ "$OPEN" -eq 0 ]; then
  say "Skipped (--no-open). Open $WEB_URL yourself."
else
  opener=""
  command -v open >/dev/null 2>&1 && opener=open
  [ -z "$opener" ] && command -v xdg-open >/dev/null 2>&1 && opener=xdg-open
  if [ -z "$opener" ]; then
    say "No way to open a browser here. Open $WEB_URL yourself."
  elif "$opener" "$WEB_URL" >/dev/null 2>&1; then
    ok "opened in your browser"
  else
    say "Could not open a browser. Open $WEB_URL yourself."
  fi
fi

# ── 7. How to stop ─────────────────────────────────────────────────────────
step "Done"
say "StreamSouk is running at $WEB_URL"
say "Stop it (keeps your data):   docker compose down"
say "Reset everything:            docker compose down -v"
say "Logs:                        docker compose logs -f"

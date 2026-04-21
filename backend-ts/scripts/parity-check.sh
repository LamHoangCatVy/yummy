#!/usr/bin/env bash
# scripts/parity-check.sh
#
# Side-by-side parity check between the Python backend (port 8000) and the
# TypeScript backend (port 8001). Hits a representative set of read-only
# endpoints on both, and diffs the JSON response bodies after normalizing.
#
# USAGE:
#   1. Start Python backend on :8000:
#        cd backend && uvicorn main:app --port 8000
#   2. Start TS backend on :8001:
#        cd backend-ts && PORT=8001 pnpm dev
#   3. Run:
#        ./scripts/parity-check.sh
#
# Requires: jq, curl. Exit 0 = parity, non-zero = mismatch detected.
set -uo pipefail

PY=${PY_URL:-http://localhost:8000}
TS=${TS_URL:-http://localhost:8001}

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

mismatches=0
checks=0

# Sort object keys so JSON ordering doesn't cause false diffs.
canonicalize() {
  jq -S '.' 2>/dev/null || cat
}

# Drop fields we expect to differ between runs (timestamps, ids, latency, etc.)
strip_volatile() {
  jq 'walk(if type == "object" then
    del(.time, .latency, .latency_ms, .id, .scanned_at, .completed_at, .started_at,
        .created_at, .indexed_at, .last_commit, .session_id, .total_cost_usd,
        .cost, .in_tokens, .out_tokens, .logs)
  else . end)'
}

check() {
  local label="$1"
  local method="$2"
  local path="$3"
  local body="${4:-}"

  checks=$((checks + 1))

  local args=(-s -X "$method" -H 'content-type: application/json')
  [[ -n "$body" ]] && args+=(-d "$body")

  local py_out ts_out
  py_out=$(curl "${args[@]}" "$PY$path" | strip_volatile | canonicalize)
  ts_out=$(curl "${args[@]}" "$TS$path" | strip_volatile | canonicalize)

  if [[ "$py_out" == "$ts_out" ]]; then
    printf "${GREEN}✓${NC} %s\n" "$label"
  else
    printf "${RED}✗${NC} %s\n" "$label"
    diff <(echo "$py_out") <(echo "$ts_out") | head -40 | sed 's/^/    /'
    mismatches=$((mismatches + 1))
  fi
}

check_status() {
  local label="$1"
  local method="$2"
  local path="$3"
  local expected_status="$4"
  local body="${5:-}"

  checks=$((checks + 1))

  local args=(-s -o /dev/null -w "%{http_code}" -X "$method" -H 'content-type: application/json')
  [[ -n "$body" ]] && args+=(-d "$body")

  local py_status ts_status
  py_status=$(curl "${args[@]}" "$PY$path")
  ts_status=$(curl "${args[@]}" "$TS$path")

  if [[ "$py_status" == "$ts_status" && "$py_status" == "$expected_status" ]]; then
    printf "${GREEN}✓${NC} %s [py=%s ts=%s]\n" "$label" "$py_status" "$ts_status"
  else
    printf "${RED}✗${NC} %s [py=%s ts=%s want=%s]\n" "$label" "$py_status" "$ts_status" "$expected_status"
    mismatches=$((mismatches + 1))
  fi
}

echo "─── Parity check: ${PY} vs ${TS} ───"

# ── Health/info ─────────────────────────────────────────────
check        "GET  /"                     GET    /
check        "GET  /health"               GET    /health
check        "GET  /help"                 GET    /help

# ── Config (read-only) ──────────────────────────────────────
check        "GET  /config/status"        GET    /config/status

# ── Knowledge base (initial state) ──────────────────────────
check        "GET  /kb"                   GET    /kb
check        "GET  /kb/scan/status"       GET    /kb/scan/status
check_status "POST /kb/scan (no repo)"    POST   /kb/scan          400

# ── Sessions ────────────────────────────────────────────────
check        "GET  /sessions"             GET    /sessions
check_status "GET  /sessions/missing"     GET    /sessions/no-such 404
check_status "POST /sessions (valid)"     POST   /sessions          200 '{"name":"parity-probe"}'

# ── Metrics ─────────────────────────────────────────────────
check        "GET  /metrics"              GET    /metrics

# ── SDLC error paths ────────────────────────────────────────
check_status "GET  /sdlc/missing/state"   GET    /sdlc/missing/state    404
check_status "GET  /sdlc/missing/history" GET    /sdlc/missing/history  404
check_status "POST /sdlc/start (bad sid)" POST   /sdlc/start            404 '{"session_id":"missing","requirement":"x"}'

# ── Validation errors ───────────────────────────────────────
check_status "POST /config/setup (bad)"   POST   /config/setup          400 '{"github_url":"not-a-url"}'

echo
if [[ $mismatches -eq 0 ]]; then
  printf "${GREEN}PARITY OK${NC} — %d/%d checks passed\n" "$checks" "$checks"
  exit 0
else
  printf "${RED}PARITY FAILED${NC} — %d/%d checks failed\n" "$mismatches" "$checks"
  exit 1
fi

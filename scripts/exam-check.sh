#!/usr/bin/env bash
set -euo pipefail

APP_BASE_URL="${APP_BASE_URL:-http://localhost:3000}"
TILE_CHECK_URL="${TILE_CHECK_URL:-http://localhost:8081/tile/0/0/0.png}"

pass() {
  printf "[OK] %s\n" "$1"
}

fail() {
  printf "[FAIL] %s\n" "$1" >&2
  exit 1
}

printf "== MeteoGlobe exam preflight ==\n"

docker compose ps

code_app="$(curl -sS -o /dev/null -w '%{http_code}' "${APP_BASE_URL}/")" || code_app="000"
if [[ "${code_app}" != "200" ]]; then
  fail "App home endpoint ${APP_BASE_URL}/ returned HTTP ${code_app}"
fi
pass "App homepage reachable (${APP_BASE_URL}/)"

code_cfg="$(curl -sS -o /dev/null -w '%{http_code}' "${APP_BASE_URL}/api/config")" || code_cfg="000"
if [[ "${code_cfg}" != "200" ]]; then
  fail "Config endpoint ${APP_BASE_URL}/api/config returned HTTP ${code_cfg}"
fi
pass "API config endpoint reachable"

code_tile="$(curl -sS -o /dev/null -w '%{http_code}' "${TILE_CHECK_URL}")" || code_tile="000"
if [[ "${code_tile}" != "200" && "${code_tile}" != "404" ]]; then
  fail "Tile endpoint ${TILE_CHECK_URL} returned HTTP ${code_tile} (expected 200 or 404)"
fi
if [[ "${code_tile}" == "404" ]]; then
  pass "Tile endpoint reachable (404 at z0 is acceptable for regional imports)"
else
  pass "Tile endpoint reachable (HTTP 200)"
fi

printf "\nPreflight passed.\n"

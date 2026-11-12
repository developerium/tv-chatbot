#!/usr/bin/env bash
# Calls one TVDB GET endpoint with the project's key and prints the HTTP
# status and the JSON body, optionally narrowed with a jq filter.
# Reads TVDB_API_KEY, TVDB_PIN and TVDB_BASE_URL from .env. The key, PIN
# and token are never printed.
#
# Usage: tvdb-get.sh <path and query> [jq filter]
#   tvdb-get.sh '/series/81189'
#   tvdb-get.sh '/series/81189/extended' '.data.characters | length'
set -euo pipefail

if [[ $# -lt 1 || "$1" != /* ]]; then
  echo "Usage: $0 <path starting with /> [jq filter]" >&2
  exit 2
fi
path="$1"
filter="${2:-.}"

project_root="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
set -a
# shellcheck disable=SC1091
. "$project_root/.env"
set +a
base_url="${TVDB_BASE_URL:-https://api4.thetvdb.com/v4}"

login_body="$(jq -n --arg apikey "$TVDB_API_KEY" --arg pin "${TVDB_PIN:-}" \
  'if $pin == "" then {apikey: $apikey} else {apikey: $apikey, pin: $pin} end')"
token="$(curl -sS --max-time 10 -X POST "$base_url/login" \
  -H 'Content-Type: application/json' -d "$login_body" | jq -r '.data.token // empty')"
if [[ -z "$token" ]]; then
  echo "Login failed (check TVDB_API_KEY and TVDB_PIN in .env)" >&2
  exit 1
fi

body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT
status="$(curl -sS --max-time 15 -o "$body_file" -w '%{http_code}' \
  -H "Authorization: Bearer $token" "$base_url$path")"
echo "HTTP $status GET $path ($(wc -c <"$body_file") bytes)" >&2
jq "$filter" "$body_file" 2>/dev/null || cat "$body_file"

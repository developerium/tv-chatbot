#!/usr/bin/env bash
# Calls each TVDB endpoint listed in docs/TVDB_API.md once and saves the raw
# response as pretty-printed JSON, so the TVDB response types can be written
# from real payloads. Reads TVDB_API_KEY and TVDB_PIN from .env.
# The login token is redacted before saving; nothing secret is printed.
#
# Usage: scripts/capture-tvdb-samples.sh [output directory]
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
output_directory="${1:-$project_root/test/fixtures/tvdb/samples}"

set -a
# shellcheck disable=SC1091
. "$project_root/.env"
set +a

base_url="${TVDB_BASE_URL:-https://api4.thetvdb.com/v4}"
mkdir -p "$output_directory"

login_body="$(jq -n --arg apikey "$TVDB_API_KEY" --arg pin "${TVDB_PIN:-}" \
  'if $pin == "" then {apikey: $apikey} else {apikey: $apikey, pin: $pin} end')"
login_response="$(curl -sS --max-time 10 -X POST "$base_url/login" \
  -H 'Content-Type: application/json' -d "$login_body")"
token="$(jq -r '.data.token // empty' <<<"$login_response")"
if [[ -z "$token" ]]; then
  echo "Login failed: $(jq -c 'del(.data.token)' <<<"$login_response")" >&2
  exit 1
fi
jq '.data.token = "<redacted>"' <<<"$login_response" >"$output_directory/login.json"
echo "login.json (token redacted)"

# capture <file name> <path and query> [token]
capture() {
  local name="$1" path="$2" bearer="${3:-$token}"
  local file="$output_directory/$name.json"
  local status
  status="$(curl -sS --max-time 15 -o "$file.tmp" -w '%{http_code}' \
    -H "Authorization: Bearer $bearer" "$base_url$path")"
  if jq . "$file.tmp" >"$file" 2>/dev/null; then
    rm "$file.tmp"
  else
    mv "$file.tmp" "$file"
  fi
  printf '%-40s %s %s\n' "$name.json" "$status" "$path"
}

# Search
capture search-series '/search?query=breaking%20bad&type=series&limit=5'
capture search-person '/search?query=bryan%20cranston&type=person&limit=5'
capture search-company '/search?query=disney%2B&type=company&limit=5'
capture search-movie '/search?query=el%20camino&type=movie&limit=5'
capture search-series-by-network '/search?query=star&type=series&network=Disney%2B&limit=10'

# Series (Breaking Bad 81189, House of the Dragon 371572)
capture series-base '/series/81189'
capture series-extended '/series/81189/extended'
capture series-extended-upcoming '/series/371572/extended'
capture series-filter '/series/filter?genre=10&status=3&sort=score&sortType=desc'

# People (Bryan Cranston 255211)
capture people-extended '/people/255211/extended'

# Companies (Disney+ 1293)
capture company '/companies/1293'

# Reference lists
capture genres '/genres'
capture series-statuses '/series/statuses'
capture company-types '/companies/types'

# Error responses
capture error-not-found '/series/999999999'
capture error-bad-request '/search?query=&type=series'
capture error-unauthorized '/genres' 'invalid-token'

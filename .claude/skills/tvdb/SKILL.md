---
name: tvdb
description: Work with the TVDB v4 API in this project - writing or changing the TVDB client, tools, mappers, response types, cache TTLs or fixtures, checking how an endpoint really behaves, or refreshing the recorded sample responses. Use whenever a task touches TVDB endpoints or data.
---

# Working with the TVDB API

## Sources of truth

- `docs/TVDB_API.md`: endpoints we use, params, fields we keep, verified
  quirks, errors, cache TTLs. Read the section for the endpoint before
  writing code for it.
- `test/fixtures/tvdb/samples/`: raw recorded responses (one JSON file per
  endpoint, plus `400`/`401`/`404` bodies). Write response types and mapper
  tests from these, not from the spec or memory.
- ARCHITECTURE.md: client layering, retries, timeouts, `tvdb_cache` design,
  grounding.

Where the live API and the spec disagree, the live API wins.

## Looking at samples

The extended records are large (up to about 245 KB), so never read a
whole sample file. Inspect them with jq:

```bash
jq '.data | keys' test/fixtures/tvdb/samples/series-extended.json
jq '.data.characters[0]' test/fixtures/tvdb/samples/series-extended.json
jq '[.data.characters[].peopleType] | group_by(.) | map({(.[0]): length}) | add' \
  test/fixtures/tvdb/samples/people-extended.json
```

## Checking live behaviour

To confirm a quirk or try a param, call the live API with the bundled
script (logs in from `.env`, prints status and JSON, never the key or
token). Narrow big responses with a jq filter:

```bash
.claude/skills/tvdb/scripts/tvdb-get.sh '/series/filter?genre=10&status=3' '.data | length'
.claude/skills/tvdb/scripts/tvdb-get.sh '/search?query=disney%2B&type=company&limit=5' '.data[] | {tvdb_id, name, primary_type}'
```

- Only `GET` endpoints; keep calls few, TVDB rate limits are undocumented.
- When a check changes what we know, update `docs/TVDB_API.md` and mark it
  verified with the date.
- To refresh all fixtures, run `scripts/capture-tvdb-samples.sh`; add new
  endpoints to that script rather than saving one-off files.

## Rules for TVDB code

- Tools return compact summaries built by mappers, never raw payloads.
  Keep only the fields listed in `docs/TVDB_API.md`.
- Convert search `tvdb_id` (string) to a number; use the credit's
  `seriesId`, not the nested `series.id` (it is `null`).
- Don't parse errors assuming the `{ status, data }` envelope: `401` has
  only `{ message }`.
- `score` is for sorting only; never present it as a rating.
- Describe networks and companies as TVDB records them, never as where to
  watch today.
- Don't use `/series/filter?company=` (returns nothing); use the
  search-based workaround in "Series on a network".
- Requests go through the TVDB client: shared retry helper, timeouts from
  config, the turn's abort signal, `TvdbCache` with the TTLs in the doc.
- Never print, log or commit the API key, PIN or token; Sentry gets only
  status codes, ids and sizes. New config goes in `.env.example` too.
- Tests use the recorded fixtures or a fake TVDB; unit tests never call
  the live API.

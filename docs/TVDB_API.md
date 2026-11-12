# TVDB API usage

The TVDB v4 endpoints the chatbot needs, how each maps to an LLM tool, and
the quirks found by calling the live API. Reference:
[TVDB API v4 docs](https://thetvdb.github.io/v4-api/) (spec version 4.7.10).

Notes on "verified" below: behaviour checked against the live API on
2026-11-09 with the project's key. Where the live API differs from the
spec, the live behaviour wins.

## Basics

- **Base URL**: `https://api4.thetvdb.com/v4` (config: `TVDB_BASE_URL`)
- **Envelope**: every response is `{ status, data, links? }`. `status` is
  `"success"` or `"failure"`; errors also carry `message`
  (e.g. `{"status":"failure","message":"NotFoundException: error fetching series","data":null}`).
- **`401` is different**: its body is just `{ "message": "Unauthorized" }`,
  with no `status` or `data` (verified), so error parsing must not assume
  the envelope.
- **Paginated responses** add
  `links: { prev, self, next, total_items, page_size }`. `next` is a full URL
  or `null`.
- **Ids**: base and extended records use numeric `id`. Search results use a
  prefixed string `id` (`"series-81189"`, `"company-1293"`) plus a string
  `tvdb_id` (`"81189"`). Mappers must convert `tvdb_id` to a number so the
  grounding registry uses one id format.
- **`score`**: a relative popularity hint for sorting only. TVDB says no
  meaning should be read into it, so answers must not present it as a
  rating.
- **Only `GET` requests** besides `/login`; all calls are safe to retry.

## Authentication

| | |
| --- | --- |
| Endpoint | `POST /login` |
| Body | `{ "apikey": TVDB_API_KEY, "pin": TVDB_PIN }`. `pin` is only for user-supported keys; omit the field entirely otherwise |
| Response | `{ data: { token } }`, a bearer token valid for **one month** |
| Use | `Authorization: Bearer <token>` on every other call |

Client behaviour (see Retries in ARCHITECTURE.md):

- Log in lazily on the first call and keep the token in memory.
- On `401`, log in once more and retry the request once. A second `401`
  is a configuration error (bad key or PIN), not retried.
- Never log the key, PIN or token; Sentry gets only status codes.

## Endpoints we use

| # | Endpoint | Used for | Tool |
| --- | --- | --- | --- |
| 1 | `GET /search` | Resolve names to TVDB ids (series, people, companies); series on a network | `search_tvdb`, `search_by_network` |
| 2 | `GET /series/{id}/extended` | Series details: genres, status, networks, companies, main cast | `get_series_details` |
| 3 | `GET /series/{id}` | Small series record with `score` (ranking search results) | inside `search_by_network` |
| 4 | `GET /people/{id}/extended` | A person's other series and movies | `get_person_credits` |
| 5 | `GET /series/filter` | Discover series by genre and status (e.g. upcoming fantasy) | `discover_series` |
| 6 | `GET /genres` | Genre name → id lookup | inside `discover_series` |
| 7 | `GET /series/statuses` | Status name → id lookup | inside `discover_series` |
| 8 | `GET /movies/filter`, `GET /movies/{id}/extended` | Only if movies are recommended (open question in PLAN.md) | later |

The tools (`src/tvdb/tvdb.tools.ts`) return compact summaries, never these
payloads, and record every entity they return for the grounding check.

### 1. `GET /search`

Searches series, movies, people and companies.

| Param | Notes |
| --- | --- |
| `query` | **Required** and must be non-empty (verified: missing or blank → `400 "query is required"`). Matches titles, translations and aliases |
| `type` | `series`, `movie`, `person` or `company` |
| `year` | Series and movies only |
| `network` | Network name, e.g. `Disney+` (TV only) |
| `company` | Company name (original network, production company, studio); broader than `network` |
| `country`, `language` | 3-letter codes, series and movies only |
| `limit`, `offset` | Paging; `page` also works (verified). Max 5,000 results overall (`400` beyond) |

Response items (series), fields we keep: `tvdb_id`, `name`, `year`,
`first_air_time`, `status` (name), `network`, `country`,
`primary_language`, `overview` (English; `overviews` has translations),
`slug`. Company items add `primary_type` (e.g. `Network`) and `country`.
Search results have **no `score`** and no genres.

Examples:

- `/search?query=breaking%20bad&type=series&limit=5`
- `/search?query=disney%2B&type=company&limit=5` → `Disney+`, `tvdb_id` `1293`, `primary_type` `Network`
- `/search?query=bryan%20cranston&type=person&limit=5`

### 2. `GET /series/{id}/extended`

| Param | Notes |
| --- | --- |
| `short` | **Leave unset or `false`.** `short=true` drops `characters` (cast) and artworks (verified: 9 → 0 characters for Breaking Bad) |
| `meta` | `translations` or `episodes`; not needed |

The full record is large (about 160 KB for Breaking Bad, mostly artworks,
seasons and translations), so the mapper keeps only:

| Field | Shape / notes |
| --- | --- |
| `id`, `name`, `slug`, `year` | |
| `overview` | Original-language text |
| `firstAired`, `lastAired`, `nextAired` | `YYYY-MM-DD`; `nextAired` may be `""` |
| `status` | `{ id, name }`: `Continuing`, `Ended`, `Upcoming` |
| `genres` | `[{ id, name, slug }]` |
| `originalNetwork`, `latestNetwork` | Company records; keep `id`, `name`, `country` |
| `companies` | Company records with `companyType.companyTypeName` (`Network`, `Studio`, `Production Company`, `Distributor`, `Special Effects`); keep `id`, `name`, type |
| `characters` | Main cast: `personName`, `peopleId`, `name` (character), `peopleType` (`Actor`), `sort`, `isFeatured`. Sort by `sort`; `isFeatured` marks the main cast |
| `score`, `originalCountry`, `originalLanguage`, `averageRuntime` | |

Networks and companies are reported as TVDB records them ("originally
aired on AMC"), never as current streaming availability.

### 3. `GET /series/{id}`

Base record (about 1.5 KB): `id`, `name`, `year`, `firstAired`, `status`,
`score`, `overview`, but no genres, companies or cast. Used to get `score`
for series found through search, which has none. `GET /series/{id}/nextAired`
returns the same record and is not needed separately.

### 4. `GET /people/{id}/extended`

Person record with every credit in `characters` (268 for Bryan Cranston,
about 165 KB). Fields we keep:

- Person: `id`, `name`, `birth`, `death`
- Per credit: `seriesId` or `movieId`, `series.name` / `movie.name`,
  `series.year`, `peopleType`, `name` (character, often `null`),
  `isFeatured`

Notes (verified):

- `peopleType` mixes `Actor`, `Guest Star`, `Director`, `Writer`,
  `Producer`, `Host`. For "the main cast's other series" keep `Actor`
  credits on series, and drop `Guest Star` by default; that cuts most of
  the list.
- The nested `series.id` is `null`; use the credit's `seriesId`.
- Credits have no genres, status or score. The model follows up with
  `get_series_details` for the few it wants to recommend.
- Deduplicate by `seriesId`: a person can have several credits on one
  series.

### 5. `GET /series/filter`

| Param | Notes |
| --- | --- |
| `genre` | Genre id from `/genres` (Fantasy = `10`) |
| `status` | `1` Continuing, `2` Ended, `3` Upcoming (from `/series/statuses`) |
| `sort`, `sortType` | `score`, `firstAired`, `lastAired`, `name`; `asc` / `desc` |
| `year`, `contentRating` | Optional |
| `country`, `lang` | Marked required in the spec, but **optional in practice** (verified). Adding `country=usa&lang=eng` narrows a lot (Upcoming Horror: 45 → 20). Leave unset by default |
| `company` | **Returns no results** (verified for Disney+ `1293`, AMC `389` and a production company). Don't use; see "Series on a network" |

Response: array of series base records (no genres, cast or networks).
There is no `limit` parameter: `page_size` is 500 and "upcoming fantasy"
returns 207 records (about 160 KB). The tool sorts by `score desc` and
keeps the top N (config, e.g. 10) before anything reaches the model.

Example: `/series/filter?genre=10&status=3&sort=score&sortType=desc`

### 6. `GET /genres` and 7. `GET /series/statuses`

Small reference lists, cached for days:

- `/genres`: 35 records `{ id, name, slug }` (ids 1-36, no 20)
- `/series/statuses`: `{ id, name }`: 1 Continuing, 2 Ended, 3 Upcoming
- `/companies/types` (not needed at runtime): 1 Network, 2 Studio,
  3 Production Company, 4 Distributor, 5 Special Effects

The tool takes a genre or status **name** from the model and resolves it
with these lists; an unknown name returns a tool error listing valid names.

## Series on a network ("anything on Disney+?")

Because `/series/filter?company=` returns nothing, network queries use
search:

1. `GET /search?query=disney%2B&type=company` → confirm the company and
   its id (`1293`, `Network`).
2. `GET /search?query=<term>&type=series&network=Disney%2B` lists that
   network's series. `query` can't be empty, so the tool needs a term:
   the user's topic if there is one ("star" → Star Wars series),
   otherwise a few broad terms (e.g. `the`, `a`) merged and deduplicated.
   `company=` instead of `network=` also includes series the company
   produced or distributes (170 vs 147 results for `the`).
3. Search has no `score`: fetch `GET /series/{id}` for the candidates
   (bounded by config, in parallel within the parallel-call limit) and
   rank by `score`, telling the user that score is TVDB's popularity
   signal.

This is a workaround; it can miss series whose titles don't match any of
the terms. The answer should say "series TVDB lists on Disney+", not
"everything on Disney+".

## How the sample queries use these endpoints

- **"I like the main cast of Breaking Bad"**: `search` (series) →
  `series/{id}/extended` (featured `characters`) → `people/{id}/extended`
  for each main actor → `series/{id}/extended` for the shortlisted series.
- **"Fantasy series like House of the Dragon, anything upcoming?"**:
  `search` → `series/{id}/extended` (genres) → `series/filter` with
  genre `10`, status `3`, sorted by score.
- **"Anything interesting on Disney+?"**: see "Series on a network".

## Errors and limits

| Status | Meaning | Handling |
| --- | --- | --- |
| `400` | Bad parameters (e.g. empty `query`, over 5,000 search results) | Not retried; short tool error to the model |
| `401` | Missing, invalid or expired token | One re-login and one retry |
| `404` | Unknown id (`NotFoundException`) | Not retried; tool returns "not found" so the model can answer `not_found` |
| `429`, `5xx` | Rate limit, temporary failure | Shared retry helper with backoff; then stale cache if any |

TVDB doesn't document rate limits; keep the parallel-call limit and cache
(see Timeouts and Data model in ARCHITECTURE.md).

## Cache TTLs per endpoint

Not built yet: every tool call currently goes to TVDB directly.

All responses go into one `tvdb_cache` collection, one entry per request;
design, key rules and stale fallback in "`tvdb_cache` collection" in
ARCHITECTURE.md.

| Endpoint | Default TTL |
| --- | --- |
| `/genres`, `/series/statuses`, `/search?type=company` | 7 days |
| `/series/{id}`, `/series/{id}/extended`, `/people/{id}/extended`, `/companies/{id}` | 24 hours |
| other `/search`, `/series/filter` | 1 hour |

## Sample responses

Raw responses for every endpoint above, plus `400`, `401` and `404` bodies,
are saved in `test/fixtures/tvdb/samples/` for writing the TVDB response
types and mapper tests. Regenerate them with
`scripts/capture-tvdb-samples.sh` (reads `.env`; the login token is
redacted). Samples: Breaking Bad (`81189`), House of the Dragon
(`371572`), Bryan Cranston (`255211`), Disney+ (`1293`), upcoming fantasy
filter. They are about 1.1 MB in total, mostly the extended records.

## Configuration

| Variable | Purpose |
| --- | --- |
| `TVDB_BASE_URL` | Defaults to `https://api4.thetvdb.com/v4` |
| `TVDB_API_KEY` | Project API key |
| `TVDB_PIN` | Subscriber PIN for user-supported keys; must be present, empty otherwise |
| `TVDB_TIMEOUT_MS` | One HTTP request (5000) |
| `TVDB_TOOL_TIMEOUT_MS` | One tool call including retries (20000) |
| `TVDB_MAX_RETRIES` | Retries per request through the shared retry helper (3) |
| `TVDB_RESULT_LIMIT` | Results per search and top N for discovery and network lists (10) |
| `TVDB_PARALLEL_REQUESTS` | Parallel `/series/{id}` calls when ranking a network's series (4) |

Keys live in `.env` (gitignored); `.env.example` lists the names only.

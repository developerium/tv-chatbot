# Plan

## Status

Built: starting a chat and sending messages, the agent with
five TVDB tools and the grounding check, MongoDB storage, validation,
retries and timeouts, Docker Compose, logging and tests. Not built yet from
the scope below: the TVDB cache, preferences, listing endpoints and
pagination, Sentry, and the fictional/empty-fixture tests. See
"Implementation status" in ARCHITECTURE.md.

## Goal

A chatbot that helps users discover TV series through natural language, with
answers grounded strictly in data from the TVDB API, conversational context
for follow-up questions, and preferences that shape recommendations.

## Scope

In scope:

- LLM agent loop with tool calling over TVDB endpoints
- Grounding check: every recommended series must come from a TVDB tool result
- Verifying that answers are based on TVDB results, not the model's memory:
  runtime checks plus tests with fictional and empty TVDB fixtures (see
  ARCHITECTURE.md)
- Conversational context and user preferences per chat
- TVDB response cache with per-data-type TTLs
- NestJS backend, MongoDB for chats and cache
- Pagination on every listing endpoint through one shared, reusable mechanism
- Input validation and sanitisation on every endpoint, plus prompt injection
  defences for the chat input (see ARCHITECTURE.md)
- Retries with bounded exponential backoff for HTTP 429 and temporary server
  failures on TVDB and OpenAI API calls, through one shared helper
- Timeouts on every TVDB request, OpenAI API call, tool call and agent turn,
  a step limit, and one deadline signal per turn passed to every call
- Observability with Sentry: errors, a trace per turn with spans for agent
  steps, LLM calls and TVDB requests, LLM token usage, structured logs
- Topic restriction: the bot only answers TV and movie related questions and
  politely declines anything else (e.g. a cake recipe)
- Running locally with Docker Compose
- Code formatting with Prettier (2 spaces, no semicolons), enforced by ESLint;
  a `format` command fixes everything, and a pre-commit hook runs it on staged
  files before each commit
- Naming rule enforced by ESLint: meaningful names written out, no shortened
  names (`unicorn/name-replacements`)
- Sorted imports and alphabetically sorted string arrays, enforced and
  auto-fixed by ESLint (`eslint-plugin-perfectionist`)
- Tests for the agent loop, grounding check and tools (with recorded fixtures)
- Documentation: README, this plan, architecture

Out of scope (described in ARCHITECTURE.md, not built):

- Authentication and per-user rate limiting / LLM budgets; a `@UserId()`
  decorator returns a placeholder user id for now (see ARCHITECTURE.md)
- Long-term memory across chats (stretch goal if time allows)

## Key decisions

| Decision | Reason |
| --- | --- |
| OpenAI Agents SDK (`@openai/agents`) runs the tool loop | Tools, step limit, abort signal and structured output come built in; grounding stays in our code: the agent must end with a schema-validated final answer (`kind`, `sources`) that the service checks |
| Model from `OPENAI_MODEL`, provider set on the SDK's `Runner` | The model changes through config; the SDK's `ModelProvider` is the seam for another provider |
| LLM does the heavy lifting; code verifies the answer against TVDB results | The model is best at interpreting questions, choosing tools and ranking; it can't be trusted to stay off its memory, so grounding is checked by code and tested with fictional and empty fixtures (see Verifying answers come from TVDB in ARCHITECTURE.md) |
| Structured final answer (Zod output type) with TVDB ids, validated by the harness | Answers can't bypass grounding; unknown ids are sent back to the model once to fix |
| One shared retry helper with bounded exponential backoff and jitter | Rate limits and short outages don't break a turn; the bounds and overall deadline keep latency predictable |
| Fixed limits set up front (5 s TVDB request, 60 s LLM request, 8 steps, 90 s per turn), all configurable | Slow TVDB calls or a looping agent can't run indefinitely; the user gets a clear timeout instead of waiting |
| Sentry for observability | Trusted, widely used; covers errors and tracing in one tool with a NestJS SDK; works the same in every environment |
| Every answer cites TVDB sources; `not_found` when TVDB has no data | The bot never answers from the model's own knowledge; missing data is stated instead of guessed |
| Compact tool results instead of raw TVDB payloads | Raw responses are very large; keeps token cost and latency down |
| NestJS | Modular structure and DI; storage bound to interfaces so implementations can be swapped |
| Controllers, services and repositories per module (NestJS convention) | Controllers validate the request and handle auth, services hold business logic, repositories talk to MongoDB; each layer can be tested and changed on its own (see Layers in ARCHITECTURE.md) |
| MongoDB for chats and cache | Data is document-shaped; native TTL indexes for per-record expiry |
| Mongoose (`@nestjs/mongoose`), used only inside the store implementations | Schemas, validation and NestJS integration out of the box; the rest of the app only sees the store interfaces |
| Entities and API use `id`; `_id` stays inside the store | Common convention for clients and other services; storage-agnostic domain; no `ObjectId` bugs (see Mongoose conventions in ARCHITECTURE.md) |
| Collection names set explicitly to the entity name | Predictable names in code, database and docs; no Mongoose auto-pluralization |
| Chats kept until explicitly deleted (no TTL); only the TVDB cache expires | Conversations stay available for recovery and later long-term memory (see Data model in ARCHITECTURE.md) |
| Recommendations and sources built by code from tool results; the LLM only writes `reason` | TVDB fields shown to the user can't be invented or altered by the model |
| Grounding registry rebuilt in memory each turn, not stored | Built from this turn's tool results plus earlier validated answers; nothing extra to keep in sync |
| Preferences stored as TVDB references, not free text | User text never reaches the system prompt, and preferences can't carry injected instructions |
| No authentication; user id from a `@UserId()` decorator with a TODO for JWT | Auth isn't the focus of the project; handlers already depend on one source of user id, so JWT can be added later in one place |
| No UI; the API is called with Postman | Time goes into the chatbot and its API, not a frontend |
| Prettier (2 spaces, no semicolons) enforced through ESLint | One consistent style without discussion; ESLint (`typescript-eslint`, `eslint-plugin-prettier`, `eslint-config-prettier`) fails on formatting and lint errors, so the rules are checked, not just suggested |
| Full, meaningful names, enforced by `unicorn/name-replacements` (`eslint-plugin-unicorn`) | Code reads without guessing what `res` or `msg` means; the rule flags shortened names in lint and in the pre-commit hook. Well-known acronyms (`id`, `url`, `dto`, `ttl`) and framework names that must keep their spelling go in the rule's allow list |
| Imports and string arrays sorted by `eslint-plugin-perfectionist` (`sort-imports`, `sort-named-imports`, `sort-arrays`, `sort-array-includes`, `sort-sets`) | One plugin for both; sorting is auto-fixed by `npm run format` and the pre-commit hook, so diffs stay small and there are no merge conflicts over order. Arrays where order matters (e.g. retry status codes in priority order, NestJS module or middleware order) are excluded in the config or with a commented disable |
| `npm run format` plus a pre-commit hook (husky + lint-staged) | One command fixes formatting and auto-fixable lint issues; the hook runs it on staged files only, so every commit is formatted and clean without slowing commits down |
| Plain REST API with JSON responses, no streaming | Simpler to build and test; one request returns one validated answer. SSE is future work for better UX on 10-30 s turns |
| Chat id explicit in the URL: `POST /api/chat` creates a chat, `POST /api/chat/:id/message` runs a turn, `GET /api/chat/:id/message` pages the history | Never inferred from "the latest chat": with a placeholder user id every request looks like the same user, so a guess would silently mix conversations; `clientId` dedup works per chat (see Endpoints in ARCHITECTURE.md) |
| One generic pagination mechanism for all listing endpoints | Written once and reused for every entity; consistent request and response shape for clients (see ARCHITECTURE.md) |
| Validate and type every input at the edge (DTOs + global validation pipe) | Handlers only receive data of the declared type and shape; unknown fields are rejected |
| Topic restriction in the system prompt and in the final answer (`off_topic` result with a fixed reply) | Keeps the bot on its purpose and limits LLM cost spent on unrelated requests; the fixed reply means off-topic content can't be generated in the answer |
| Layered prompt injection defences, not a single filter | No library or prompt fully prevents injection; limiting what the model can do (read-only tools, grounding check) limits the damage |

## How the sample queries map to TVDB

- **"I like the main cast of Breaking Bad..."**: search the series, get its
  main cast, get each actor's other series, rank and filter. "Over the
  holidays" is ambiguous: state the assumption or ask one clarifying question.
- **"Fantasy series like House of the Dragon, anything upcoming?"**: resolve
  the series and its genres, then filter by genre and status "Upcoming".
- **"Anything interesting on Disney+?"**: resolve Disney+ as a TVDB company,
  search series on that network (TVDB's company filter returns nothing, see
  docs/TVDB_API.md), rank by score, and say that score is the ranking signal.

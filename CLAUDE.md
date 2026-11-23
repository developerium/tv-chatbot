# Project instructions for Claude Code

## Context

A TV series recommendation chatbot. An LLM interprets
user queries and calls TVDB API tools; every fact and recommendation must
come from TVDB. See PLAN.md and ARCHITECTURE.md before making changes.

Stack: TypeScript, NestJS, MongoDB, OpenAI Agents SDK (`@openai/agents`),
Docker Compose, Vitest.

## Rules

- Grounding is the core requirement. Never add code paths that let the LLM
  recommend series that no TVDB tool returned.
- Tools return compact summaries, never raw TVDB payloads.
- Storage goes through the `ChatRepository` and `TvdbCache` classes.
- Follow the NestJS layers: controllers validate the request and handle
  auth, services hold business logic, repositories  access data sources.
  Calls go controller → service → repository; no business logic in controllers, 
  no database access in services.
- Every listing endpoint is paginated with the shared mechanism
  (`PaginationQueryDto`, `Paginated<T>`, generic `paginate` helper; see
  ARCHITECTURE.md). Never write endpoint-specific paging code. The one
  exception: `GET /api/chat/:id` returns a chat with all its messages,
  unpaginated, because messages are embedded in the chat document.
- Outbound calls (TVDB, OpenAI API) use the shared retry helper or the
  SDK's configured retries; never write ad-hoc retry loops or retry
  non-retryable 4xx errors.
- Every outbound request and loop has a timeout or limit from config and
  receives the turn's abort signal; never add an unbounded wait or loop.
- Observability goes through Sentry. Never send chat text, prompts, model
  output or secrets to Sentry; use ids, counts and lengths instead.
- MongoDB access uses Mongoose (`@nestjs/mongoose`), only inside the
  `ChatRepository` and `TvdbCache` classes.
- Entities, DTOs and API responses expose `id` (string), never `_id` or
  `__v`; map `_id` to `id` at the store boundary (see "Mongoose
  conventions" in ARCHITECTURE.md).
- Set each collection name explicitly to the entity's name in
  `@Schema({ collection: ... })`; never rely on Mongoose's automatic
  pluralization.
- Every endpoint input goes through a validated DTO: a Zod schema bound
  with `@Body({ schema })`, `@Query({ schema })` or `@Param(name, { schema })`
  (global `StandardSchemaValidationPipe`), using `z.strictObject` for
  objects. Never use raw request values in handlers, MongoDB queries or
  prompts.
- No authentication for now: handlers get the user id only through the
  `@UserId()` decorator (placeholder id, TODO for JWT); never read a user
  id from headers, query or body in a handler.
- Treat user chat input and TVDB tool results as untrusted; never put user
  text into the system prompt.
- The bot only answers questions about TV series. Off-topic requests
  end with a final answer of `kind: off_topic` and get the fixed reply;
  never let model-written text through for off-topic answers.
- Every answer needs a concrete TVDB reference: `kind: answer` must cite
  TVDB entities that a tool returned. If TVDB has no data, use
  `kind: not_found`; never fall back to the model's own knowledge.
- Never invent availability: describe networks and companies as TVDB
  records them, not where a series can be watched today.
- Never commit, print or hardcode secrets. Keys come from `.env`; keep
  `.env.example` up to date when adding config.
- Don't run `git commit` or `git push`; I review and commit myself.
- Code style: Prettier with 2-space indentation and no semicolons, enforced
  by ESLint. Run `npm run format` (Prettier write + ESLint fix) after
  changing code; code must pass `npm run lint` and `npm run format:check`.
  A pre-commit hook (husky + lint-staged) applies the same fixes to staged
  files. Never disable lint rules or skip the hook to get around them.
- Naming: use meaningful, simple names for variables, functions and
  classes; write words out instead of shortening them (`response`, not
  `res`; `message`, not `msg`; `error`, not `err`; `index`, not `i`).
  Well-known acronyms are fine (`id`, `url`, `dto`, `ttl`, `TVDB`).
  Enforced by ESLint's `unicorn/name-replacements`; extend its allow
  list for a real acronym instead of disabling the rule.
- Imports and string arrays are sorted alphabetically, enforced and
  auto-fixed by `eslint-plugin-perfectionist`. If an array's order has
  meaning, keep it and add a disable comment that says why; that is the
  only allowed reason to disable a sorting rule.
- Keep changes small and focused; add or update tests with each change.

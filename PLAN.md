# Plan

## Goal

A chatbot that helps users discover TV series through natural language, with
answers grounded strictly in TVDB data, conversational context for
follow-ups, and per-chat preferences that shape recommendations.

Implementation status and the design of unbuilt parts are in
ARCHITECTURE.md; coding rules are in CLAUDE.md.

Out of scope: authentication (a placeholder user id is used), per-user
rate limits and LLM budgets, a UI (the API is called with Postman).
Stretch goal: long-term memory across chats.

## Key decisions

| Decision | Reason |
| --- | --- |
| OpenAI Agents SDK runs the tool loop | Tools, step limit, abort signal and structured output are built in; grounding stays in our code |
| The LLM interprets, picks tools and ranks; code verifies the answer against TVDB results | The model is best at the open-ended parts but can't be trusted to stay off its memory |
| Structured final answer (`kind`, `sources`) validated by the harness | Answers can't bypass grounding; unknown ids go back to the model once to fix |
| `not_found` when TVDB has no data | Missing data is stated, never guessed |
| Recommendation and source fields copied by code; the LLM only writes `reason` | TVDB fields shown to the user can't be invented or altered |
| Preferences stored as TVDB references, not free text | Preferences can't carry injected instructions into later turns |
| Grounding registry rebuilt each turn, not stored | Nothing extra to keep in sync |
| Compact tool results | Raw TVDB responses are large; keeps tokens and latency down |
| Fixed, configurable limits (per request, per tool call, steps, per turn) | A slow TVDB or looping agent can't run indefinitely |
| MongoDB for chats and the TVDB cache | Document-shaped data; native TTL indexes |
| Chats kept until deleted; only the cache expires | Conversations stay recoverable and usable for long-term memory |
| Plain REST, no streaming | Simplest to build and test; SSE is the next step for 10-30 s turns |
| Chat id explicit in the URL | With a placeholder user id, inferring "the latest chat" would mix conversations |
| Cursor (keyset) pagination, one shared mechanism | Correct while new messages arrive; one request/response shape for clients |
| Topic restriction with a fixed `off_topic` reply | Keeps the bot on purpose; off-topic content can't be generated |
| Layered prompt injection defences | No single filter works; limiting what the model can do limits the damage |
| Sentry for observability | Errors and tracing in one tool, with a NestJS SDK |

## How the sample queries map to TVDB

- **"I like the main cast of Breaking Bad..."**: search the series, get its
  main cast, get each actor's other series, rank and filter. "Over the
  holidays" is ambiguous: state the assumption or ask one clarifying question.
- **"Fantasy series like House of the Dragon, anything upcoming?"**: resolve
  the series and its genres, then filter by genre and status "Upcoming".
- **"Anything interesting on Disney+?"**: resolve Disney+ as a TVDB company,
  search series on that network (TVDB's company filter returns nothing, see
  docs/TVDB_API.md), rank by score, and say that score is the ranking signal.

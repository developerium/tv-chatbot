# TV Series Recommendation Chatbot

A conversational assistant that recommends TV series using an LLM, with every
fact and recommendation sourced from the [TVDB API](https://thetvdb.github.io/v4-api/).

Built with NestJS, the OpenAI Agents SDK and MongoDB. The agent looks things
up with TVDB tools and must cite the TVDB entities its answer is based on;
answers citing anything a tool didn't return are sent back to the model once
and otherwise replaced with a "not found" reply.

## Documentation

- [PLAN.md](PLAN.md): scope and key decisions
- [ARCHITECTURE.md](ARCHITECTURE.md): design and how the pieces fit together
- [docs/TVDB_API.md](docs/TVDB_API.md): TVDB endpoints used and their quirks

## Running locally

Requirements:

- Node.js 24
- Docker with Docker Compose
- A TVDB API key (and subscriber PIN for user-supported keys)
- An OpenAI API key

Steps:

1. Copy `.env.example` to `.env` and fill in the keys and passwords. Every
   variable is required (`TVDB_PIN` may be empty). Set `MONGODB_USERNAME`
   and `MONGODB_PASSWORD` before the first start: MongoDB creates its user
   only when its data volume is new.
2. Run `npm install`, then `npm start`.

`npm start` runs MongoDB in Docker in the background (`npm run start:docker`)
and the API on your machine in watch mode (`npm run start:dev`), at
`http://127.0.0.1:<PORT>/api`. Stop MongoDB with `docker compose down`.

To run the API in Docker too, use `docker compose up` instead (not both at
once, they use the same port). Add `--build -V` after changing dependencies.

## Using the API

There is no UI; call the API with curl or Postman. Authentication is a
placeholder for now, so no token is needed.

Start a chat:

```bash
curl -X POST http://127.0.0.1:8080/api/chat
```

```json
{ "createdAt": "2026-11-09T17:18:14.830Z", "id": "8ff9498f-2fee-4447-ac5d-4d820e15ec29" }
```

Send a message (`clientId` is optional: a client-generated UUID that makes
retries safe, since resending it returns the saved answer):

```bash
curl -X POST http://127.0.0.1:8080/api/chat/<chat id>/message \
  -H 'Content-Type: application/json' \
  -d '{ "text": "I liked the main cast of Breaking Bad, what else are they in?" }'
```

```json
{
  "userMessage": { "id": "…", "role": "user", "text": "…", "status": "complete", "createdAt": "…" },
  "assistantMessage": {
    "id": "…",
    "replyTo": "<user message id>",
    "role": "assistant",
    "kind": "answer",
    "text": "…",
    "sources": [
      { "type": "series", "tvdbId": 273181, "name": "Better Call Saul", "url": "https://thetvdb.com/dereferrer/series/273181" }
    ],
    "status": "complete",
    "createdAt": "…"
  }
}
```

`kind` is `answer`, `clarification`, `not_found` or `off_topic` (off-topic
requests get a fixed reply). Errors: `400` invalid input, `404` unknown chat,
`409` conflicting write, `503` model unavailable, `504` the turn took too long.

## Tests and checks

```bash
npm test               # unit and integration tests
npm run lint           # ESLint (includes Prettier)
npm run format:check   # Prettier
```

The storage tests also run against a real MongoDB when `MONGODB_TEST_URI`
is set, e.g.
`MONGODB_TEST_URI='mongodb://user:password@127.0.0.1:27017/?authSource=admin' npm test`.

## Not built yet

Listing and deleting chats (with pagination), the TVDB response cache,
saved preferences and structured recommendations, movie support, real JWT
authentication, rate limiting and Sentry. See PLAN.md and ARCHITECTURE.md
for the design of each.

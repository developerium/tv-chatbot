# TV Series Recommendation Chatbot

A chatbot that recommends TV series, with every fact and recommendation
sourced from the [TVDB API](https://thetvdb.github.io/v4-api/). Built with
NestJS, the OpenAI Agents SDK and MongoDB.

- [PLAN.md](PLAN.md): scope and key decisions
- [ARCHITECTURE.md](ARCHITECTURE.md): design and implementation status
- [docs/TVDB_API.md](docs/TVDB_API.md): TVDB endpoints used and their quirks

## Running locally

Requires Node.js 24, Docker Compose, a TVDB API key and an OpenAI API key.

1. Copy `.env.example` to `.env` and fill it in (`TVDB_PIN` may be empty).
   Set `MONGODB_USERNAME` and `MONGODB_PASSWORD` before the first start:
   MongoDB creates its user only when its data volume is new.
2. Run `npm install`, then `npm start`.

`npm start` runs MongoDB in Docker and the API locally in watch mode at
`http://127.0.0.1:<PORT>/api`. To run the API in Docker too, use
`docker compose up` instead (not both; they share the port), with
`--build -V` after changing dependencies.

## Using the API

There is no UI; use curl or Postman.

Authentication is not planned for now, so no token is needed. Every
request acts as the same placeholder user, id
`00000000-0000-0000-0000-000000000000` (`src/common/user-id.decorator.ts`),
so all chats belong to that user.

```bash
curl -X POST http://127.0.0.1:8080/api/chat

# Your chats without messages, newest first; pass `nextCursor` back as
# `cursor` for the next page.
curl 'http://127.0.0.1:8080/api/chat?limit=20'

# One chat with all its messages, oldest first.
curl http://127.0.0.1:8080/api/chat/<chat id>

curl -X POST http://127.0.0.1:8080/api/chat/<chat id>/message \
  -H 'Content-Type: application/json' \
  -d '{ "text": "I liked the main cast of Breaking Bad, what else are they in?" }'
```

The optional `clientId` (a UUID) in the message body makes retries safe:
resending it returns the saved answer.

## Tests and checks

```bash
npm test
npm run lint
npm run format:check
```

# Vera — Magicpin AI Challenge Backend

Production-oriented Node.js backend for the Magicpin AI Challenge. Vera receives category, merchant, customer, and trigger context over HTTP, decides when to message, composes grounded WhatsApp copy, and handles multi-turn merchant replies.

## Architecture

```
Judge Harness
    │
    ├─ POST /v1/context  ──► ContextStore (versioned, idempotent)
    ├─ POST /v1/tick     ──► DecisionService ──► deterministicComposer
    ├─ POST /v1/reply    ──► ConversationStore + reply routing
    ├─ GET  /v1/healthz
    └─ GET  /v1/metadata
```

- `src/storage/contextStore.ts` — in-memory category/merchant/customer/trigger storage with version checks
- `src/storage/conversationStore.ts` — suppression keys, sent bodies, auto-reply detection
- `src/composer/deterministicComposer.ts` — trigger-kind dispatch; all facts come from pushed context
- `src/services/decisionService.ts` — tick orchestration and reply lifecycle

## Quick start

```bash
cd magicpin-ai-challenge
npm install
cp .env.example .env
npm run dev
```

Server listens on `http://localhost:3000`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled server |
| `npm test` | Unit + API + integration tests |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## How to verify locally

### 1. Automated tests (fastest)

```bash
npm test
```

This runs:
- health/context/tick API tests
- composer unit tests
- reply-flow tests (opt-out, auto-reply hell, intent transition, GST redirect)
- integration tests against the official dataset in `../challenge/dataset/`

### 2. Manual curl smoke test

```bash
# health
curl http://localhost:3000/v1/healthz

# metadata
curl http://localhost:3000/v1/metadata

# push category (abbreviated)
curl -X POST http://localhost:3000/v1/context \
  -H "Content-Type: application/json" \
  -d '{"scope":"category","context_id":"dentists","version":1,"payload":{"slug":"dentists"}}'

# tick
curl -X POST http://localhost:3000/v1/tick \
  -H "Content-Type: application/json" \
  -d '{"now":"2026-04-26T10:35:00Z","available_triggers":["trg_research"]}'
```

### 3. Official judge simulator (full harness)

From the challenge folder:

```bash
cd ../challenge
# Edit judge_simulator.py:
#   BOT_URL = "http://localhost:3000"
#   LLM_API_KEY = "<your key>"  (or use ollama provider)
python judge_simulator.py
```

Recommended scenarios:
- `warmup` — health, metadata, context push
- `all` — warmup + auto-reply + intent + hostile handling
- `phase2_short` — tick scoring with LLM judge
- `full_evaluation` — full trigger batch scoring

### 4. Build check

```bash
npm run build
npm start
curl http://localhost:3000/v1/healthz
```

## Deployment (Render)

1. Push this repo to GitHub
2. Create a new Web Service on Render
3. Use `render.yaml` or set:
   - Build: `npm install && npm run build`
   - Start: `npm start`
   - Health check path: `/v1/healthz`
4. Set env vars from `.env.example` (`TEAM_NAME`, `CONTACT_EMAIL`, etc.)
5. Submit the public URL as `https://<your-host>/v1/*`

## Design choices

- **Deterministic composer by default** — same input always yields the same output; no temperature, no hallucinated facts
- **Trigger-kind dispatch** — research digest, recall, perf spike/dip, IPL, supply alert, planning intent, and more each have tailored templates
- **Suppression + expiry** — `/v1/tick` skips expired triggers and already-sent suppression keys
- **Auto-reply handling** — detect canned replies, prompt once, wait on repeat, end after 3 identical auto-replies
- **409 on stale context** — re-posting the same `(context_id, version)` returns conflict per spec

## Environment variables

See `.env.example` for team metadata and optional LLM settings. The current implementation does not require an LLM API key for core functionality.

## Tradeoffs

- In-memory storage only (fine for judge window; restart clears state)
- Deterministic templates score well on specificity but may score lower on variety vs frontier LLM prompting
- Optional LLM layer can be added behind `USE_LLM=true` for experimentation

## What would help most next

- Merchant conversation history in reply routing
- Prompt-versioned LLM composer as an A/B alternative to deterministic dispatch
- Redis-backed storage for multi-instance deploys

# Mira Health Intelligence

A healthcare workflow and predictive automation platform — a Next.js
prototype for clinics, diagnostic centers, and telehealth operators.
Phase 2 ships the prediction pipeline, the patient lifecycle UX,
real analytics, and the activity layer that ties them together.

> Mira generates AI-assisted risk signals, not medical diagnoses.
> Output is intended to support clinicians, never replace them.

## Stack

| Layer         | Choice                                       |
| ------------- | -------------------------------------------- |
| Framework     | Next.js 15 (App Router, route handlers)      |
| Language      | TypeScript, strict mode                      |
| UI            | Tailwind CSS, Radix primitives, lucide-react |
| Forms         | react-hook-form + zod                        |
| Data fetch    | TanStack Query                               |
| Charts        | Recharts                                     |
| ORM           | Prisma                                       |
| DB            | Postgres (Docker Compose for local)          |
| Notifications | sonner                                       |

## Getting started

```bash
# 1. install deps
npm install

# 2. environment
cp .env.example .env

# 3. start postgres
docker compose up -d db

# 4. sync schema
npm run db:push

# 5. seed a believable clinic caseload (~20 patients, predictions, notes)
npm run db:seed

# 6. dev
npm run dev
```

Open <http://localhost:3000>.

### Health probe

```bash
curl http://localhost:3000/api/health
```

## Architecture

```
src/
  app/                route handlers + page tree
    (app)/            authenticated shell — sidebar + header layout
    api/              REST endpoints
  components/         shared primitives (ui/, layout/)
  features/           domain modules
    patients/         schema, queries (TanStack), table, form
    predictions/      prediction card, history timeline, confidence meter
    notes/            composer + optimistic note list
    activity/         unified activity feed
    analytics/        charts: risk distribution, throughput, growth, averages
    dashboard/        server-component widgets
  hooks/              use-debounce, use-query-state, use-mobile
  lib/                cn, format, env, api-response, api-error, fetcher
  server/             prisma client, withErrorHandling
  services/           domain logic (patient/, prediction/, note/,
                      activity/, audit/, analytics/)
```

### Prediction pipeline

```
client / route handler
   │
   ▼
services/patient.create()  or  .update()  or  POST /api/patients/[id]/predict
   │  (biomarkers changed?)
   ▼
services/prediction.executePrediction(patientId)
   ├─ load patient + snapshot biomarkers
   ├─ provider = getProvider(env.AI_PROVIDER)
   ├─ provider.predict(input)
   ├─ normalize(result)
   ├─ tx: insert PredictionLog + update Patient (riskLevel, confidence,
   │       lastPredictedAt, aiPrediction)
   ├─ audit: action=predict, metadata={provider, riskLevel, latencyMs}
   └─ on failure: write PredictionLog row with error + audit predict_fail
```

Providers live in `services/prediction/providers/`. The internal heuristic
is deterministic and biomarker-driven — it does the real work in phase 2.
`openai` and `groq` are present in the registry as stubs that throw
`not configured`; wiring them is a constructor change.

### Activity

There is no separate `activity_events` table. `audit_logs` is the single
source of truth — patient creates, updates, archives, predictions (success
and failure), and notes all record an entry there. The activity feed
component reads from one query and renders the typed shape.

### URL state

Patient list filters (search, risk, page) live in the URL via a small
`useQueryState` hook. Refreshing or sharing a link preserves the view.

## Data model

- `Patient` — record + biomarkers + mirrored latest prediction snapshot
  (`riskLevel`, `predictionConfidence`, `aiPrediction`, `lastPredictedAt`).
  Soft-deleted via `archivedAt`.
- `PredictionLog` — every AI run: provider, model, latency, request +
  response payloads, observation array, biomarker `inputSnapshot` for
  later delta analysis.
- `Note` — per-patient clinician notes with author + timestamps.
- `AuditLog` — generic audit/activity ledger, indexed by patient.

Indexes are tuned for the dashboard and patient list — see
`prisma/schema.prisma`.

## API

All responses use one envelope:

```ts
{ success: true, data: T }
{ success: false, error: { message: string, code?: string, details?: unknown } }
```

| Method | Path                                | Notes                          |
| ------ | ----------------------------------- | ------------------------------ |
| GET    | `/api/health`                       | liveness probe                 |
| GET    | `/api/patients`                     | list, filter, paginate, sort   |
| POST   | `/api/patients`                     | create + auto-predict          |
| GET    | `/api/patients/[id]`                | single record                  |
| PATCH  | `/api/patients/[id]`                | partial update (re-predicts)   |
| DELETE | `/api/patients/[id]`                | soft-archive                   |
| POST   | `/api/patients/[id]/predict`        | manual prediction              |
| GET    | `/api/patients/[id]/predictions`    | history                        |
| GET    | `/api/patients/[id]/notes`          | per-patient notes              |
| POST   | `/api/patients/[id]/notes`          | add note                       |
| DELETE | `/api/notes/[id]`                   | remove note                    |
| GET    | `/api/patients/[id]/activity`       | per-patient audit feed         |
| GET    | `/api/activity`                     | global activity feed           |
| GET    | `/api/analytics`                    | dashboard aggregates           |

Validation errors return `422 { code: "validation_error" }` with Zod's
`flatten()` payload under `error.details`.

## Scripts

| Script               | Description                          |
| -------------------- | ------------------------------------ |
| `npm run dev`        | local dev server                     |
| `npm run build`      | production build                     |
| `npm run start`      | start built server                   |
| `npm run lint`       | next/eslint                          |
| `npm run typecheck`  | strict tsc, no emit                  |
| `npm run format`     | prettier write                       |
| `npm run db:push`    | apply schema without migration files |
| `npm run db:migrate` | dev migration                        |
| `npm run db:seed`    | seed realistic clinic caseload       |
| `npm run db:reset`   | reset + reseed                       |
| `npm run db:studio`  | prisma studio                        |

## Environment

`.env.example` documents every variable. Required:

```env
DATABASE_URL="postgresql://mira:mira@localhost:5432/mira?schema=public"
AI_PROVIDER="internal"   # mock | internal | openai | groq
```

## Docker

Multi-stage `Dockerfile` (Next.js standalone) + `docker-compose.yml`
running the app and Postgres together:

```bash
docker compose up --build
```

## Screenshots

> _Placeholder — wire in once a designer / clinician walks through the build._

## Roadmap

Phase 3: real OpenAI/Groq providers behind the existing seam, auth with a
session-aware audit trail, background job runner for batch prediction
re-runs, CSV import/export, anomaly alerts on biomarker drift.

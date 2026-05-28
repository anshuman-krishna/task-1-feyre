# Mira Health Intelligence

A healthcare workflow and predictive automation platform — a Next.js
prototype for clinics, diagnostic centers, and telehealth operators.
Phase 3 adds the people layer: sessioned users, clinician assignments,
workflow status, explainable predictions, operational alerts, exports,
and observability seams.

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
| Auth          | Signed cookie session (auth.js-shaped seam)  |
| Notifications | sonner                                       |
| Observability | structured JSON logger + in-process metrics  |

## Getting started

```bash
# 1. install deps
npm install

# 2. environment
cp .env.example .env
# generate a real SESSION_SECRET in .env (anything 16+ chars locally)

# 3. start postgres
docker compose up -d db

# 4. sync schema
npm run db:push

# 5. seed users + a believable clinic caseload
npm run db:seed

# 6. dev
npm run dev
```

Open <http://localhost:3000>. You'll land on `/sign-in` — pick any seeded
user (admin, two clinicians, or an analyst).

## Architecture

```
src/
  app/                route handlers + page tree
    (app)/            authenticated shell — sidebar + header + main
    sign-in/          public sign-in page (server component picker)
    api/              REST endpoints
  components/         shared primitives (ui/, layout/)
  features/           domain modules (patients/, predictions/, notes/,
                      activity/, analytics/, dashboard/)
  hooks/              use-debounce, use-query-state, use-mobile
  lib/                cn, format, env, api-response, api-error, fetcher
  server/             prisma, session, logger, metrics, withErrorHandling
  services/           domain logic (patient/, prediction/, note/,
                      activity/, audit/, analytics/, export/, user/,
                      workflow/)
  middleware.ts       edge auth gate
```

### Auth

The cookie is `mira_session = <userId>.<HMAC-SHA256(userId, SESSION_SECRET)>`.
Edge middleware checks for its presence + signature shape on every protected
route. Server components and route handlers use `getCurrentUser()` (memoised
per request via React `cache`) to resolve the actual user record.

There's no password layer in this phase — picking a user on `/sign-in`
sets the cookie. The seams (middleware, session helper, audit `actor`) are
identical to a production auth.js setup; swapping the cookie reader is the
only change needed to wire SSO.

### Workflow

Patients carry a `status` (new / monitoring / follow_up_needed / stable /
urgent_review), an `assignedToId`, a `followUpAt`, and a `reviewedAt`. When a
prediction lands, the system auto-transitions status only if the patient is
still in a "soft" state (new or stable). Once a clinician moves the patient
into monitoring, follow-up, or urgent review, those decisions are never
overwritten by the model.

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
   ├─ normalize(result)              ← clamps shape, preserves contributions
   ├─ tx: insert PredictionLog (incl. contributions, observations,
   │       inputSnapshot) + update Patient (riskLevel, confidence,
   │       lastPredictedAt, aiPrediction)
   ├─ metrics.inc("predictions_total", { provider, risk })
   ├─ metrics.observe("prediction_latency_ms", latencyMs, { provider })
   ├─ log.info("prediction.ok", { ... })
   ├─ audit: action=predict, actor={id,name}, metadata={provider, risk, latencyMs}
   └─ on failure: log + counter + audit predict_fail
```

The internal heuristic provider produces a normalised `contributions[]` array
— per-biomarker shares of the total risk score — so the UI can render
"glucose drove 38% of this classification" without guessing.

### Activity

All activity flows through `audit_logs`. The activity feed reads it with
patient + user joins and renders `<actor> <verb>` consistently. Sign-in,
sign-out, status changes (auto vs manual), reassignments, predictions, notes,
exports — all in one stream.

### Observability

- `src/server/logger.ts` — structured JSON lines, level-gated by `LOG_LEVEL`
- `src/server/metrics.ts` — in-process counters + summaries (predictions
  by provider, latency, failures); ready to swap for a Prometheus exporter
  behind the same interface

## Data model

- `User` — workspace member with role (admin / clinician / analyst)
- `Patient` — record + biomarkers + mirrored latest prediction snapshot +
  workflow (`status`, `assignedToId`, `followUpAt`, `reviewedAt`)
- `PredictionLog` — every AI run: provider, model, latency, request +
  response, observation array, contribution array, biomarker `inputSnapshot`
- `Note` — per-patient clinician notes with author + timestamps
- `AuditLog` — generic ledger; `userId` joins back to the acting user

Indexes are tuned for the dashboard and patient list (`riskLevel/archivedAt`,
`status/archivedAt`, `assignedToId`, `followUpAt`, `createdAt`) and the
activity feed (`patientId/createdAt`, `userId/createdAt`).

## API

Envelope:

```ts
{ success: true, data: T }
{ success: false, error: { message: string, code?: string, details?: unknown } }
```

| Method | Path                                | Notes                                |
| ------ | ----------------------------------- | ------------------------------------ |
| GET    | `/api/health`                       | liveness probe (public)              |
| POST   | `/api/auth/sign-in`                 | body `{ userId }`; sets cookie       |
| POST   | `/api/auth/sign-out`                | clears cookie                        |
| GET    | `/api/auth/me`                      | current user (or null)               |
| GET    | `/api/users`                        | workspace members                    |
| GET    | `/api/patients`                     | list, filter, paginate, sort         |
| POST   | `/api/patients`                     | create + auto-predict                |
| GET    | `/api/patients/export`              | CSV download of every active patient |
| GET    | `/api/patients/[id]`                | single record                        |
| PATCH  | `/api/patients/[id]`                | partial update (re-predicts)         |
| DELETE | `/api/patients/[id]`                | soft-archive                         |
| POST   | `/api/patients/[id]/predict`        | manual prediction                    |
| GET    | `/api/patients/[id]/predictions`    | history                              |
| GET    | `/api/patients/[id]/report`         | markdown report                      |
| GET    | `/api/patients/[id]/notes`          | per-patient notes                    |
| POST   | `/api/patients/[id]/notes`          | add note                             |
| DELETE | `/api/notes/[id]`                   | remove note                          |
| GET    | `/api/patients/[id]/activity`       | per-patient audit feed               |
| GET    | `/api/activity`                     | global activity feed                 |
| GET    | `/api/analytics`                    | dashboard aggregates                 |

All routes except `/api/health` and `/api/auth/sign-in` require a valid
session cookie.

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
| `npm run db:seed`    | seed users + clinic caseload         |
| `npm run db:reset`   | reset + reseed                       |
| `npm run db:studio`  | prisma studio                        |

## Environment

```env
DATABASE_URL="postgresql://mira:mira@localhost:5432/mira?schema=public"
SESSION_SECRET="<16+ chars; rotate to invalidate all sessions>"
AI_PROVIDER="internal"   # mock | internal | openai | groq
```

## Docker

```bash
docker compose up --build
```

The compose file pins both app + Postgres; the Dockerfile uses Next's
standalone output and runs as a non-root user.

## Roadmap

Phase 4: live OpenAI / Groq providers, RBAC enforcement, realtime activity
via SSE, PDF report rendering, batch prediction reruns through a job runner,
biomarker drift alerts.

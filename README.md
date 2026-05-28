# mira

mira is a little healthcare workflow tool i've been building. think of it as a small internal product a clinic or diagnostic centre could plausibly use: patients come in, biomarkers get recorded, the system runs an ai pass over the panel, surfaces risk signals, and keeps the workflow honest with statuses, follow ups, notes, and a real activity trail.

it isn't a medical device, and it shouldn't pretend to be. ai output is a signal, not a diagnosis. that disclaimer is everywhere in the ui too.

## stack

next.js 15 with the app router. typescript everywhere, strict. tailwind plus radix primitives for the ui, with a few hand rolled bits (cards, badges, table, dropdown, etc). prisma on postgres. tanstack query on the client. zod for validation. react hook form for forms. recharts for charts. sonner for toasts. server sent events for the live layer. a tiny cookie session for auth.

## what works right now

a lot more than i expected to be honest. here's the honest tour.

**signing in.** there's a sign in page at `/sign-in` that lists the seeded workspace members. pick one and you're in. the session is a signed cookie (hmac sha256 over the user id), the edge middleware blocks every protected route, and `getCurrentUser()` is memoised per request. it isn't a real password flow but the seams are the same shape as auth.js, so swapping it later is mostly a one file change.

**patients.** create, edit (status and assignment inline), archive (soft, via `archivedAt`), search by name or email or condition, filter by risk level and workflow status, paginate, sort, and bulk archive or bulk reassign with the sticky action bar at the bottom of the table. the list state lives in the url so refresh and share both behave.

**predictions.** this is the part i'm most happy with. when biomarkers come in, the request returns immediately and a job lands in `prediction_jobs`. a background worker (running in the same node process for now) picks it up, runs the internal heuristic provider, writes a `prediction_logs` row, mirrors the latest snapshot onto the patient, and emits an event. the heuristic isn't a black box: it scores glucose, cholesterol, blood pressure, haemoglobin, bmi against rough clinical ranges and reports per biomarker contributions, so the ui can show "glucose drove 38% of this classification" instead of just spitting out a label. confidence scales with how many biomarkers were provided.

**explainability.** the prediction card on each patient shows the condition, a written summary, a confidence bar, contribution bars per biomarker, the supporting findings with their status, and recommended next steps. underneath it tells you which provider ran it, the model name, latency, and when it ran. nothing is hidden.

**workflow.** every patient sits in one of five states: new, monitoring, follow up needed, stable, urgent review. plus an assigned clinician, a follow up date, and a last reviewed timestamp. predictions nudge the status automatically, but only while the patient is still in a "soft" state (new or stable). once a clinician moves someone into monitoring or follow up or urgent, the model never overrides that. this rule was important to me. the workflow has to feel like the clinician is in charge.

**realtime.** there's one server sent events endpoint, `/api/events/stream`. the client opens it once globally inside the authed shell. when something interesting happens (a prediction finishes, a notification lands, a status changes), the event fans out, the relevant tanstack query keys get invalidated, and a debounced `router.refresh()` re renders the server components. open two tabs, run a prediction in one, watch the other update. heartbeats every 15 seconds keep proxies happy.

**notifications.** real durable rows in the `notifications` table, not just toasts. when a prediction comes back elevated or critical, the assigned clinician and the person who requested it both get a notification. the bell in the header shows the unread count, opens a panel, and supports mark one or mark all read. low and moderate predictions stay quiet on purpose, because pinging clinicians for routine results is exactly how alert fatigue happens.

**reliability.** each provider has a little circuit breaker. three failures in a row and it opens for 30 seconds. while it's open, mira falls back to the internal heuristic. on the next call after the cooldown it tries a half open probe, closes on success, reopens on failure. the internal provider is the floor, never degraded. you can see the live state at `/api/health/deep`.

**audit.** every meaningful action lands in `audit_logs` with the actor's user id and name. that's also the source of truth for the activity feed (no separate events table). signing in, status changes, predictions, note edits, archives, exports, all of it.

**analytics.** a real page with charts pulled from postgres aggregates: status distribution, risk distribution, prediction throughput over time, patient growth, biomarker averages, intake velocity (7 day vs prior 7), follow up backlog, prediction failures in the last 24h.

**exports.** csv download for the whole active caseload, and a per patient markdown report that includes the latest ai observation, recommendations, prediction history, and recent notes. both are audited.

**observability.** structured json logs with a level gate. a tiny in process metrics module counting predictions by provider and risk, queue depths, notifications, prediction latency. all surfaced through `/api/health/deep` along with db latency and provider circuit states.

**tenant readiness.** there's an `Organization` model and every user, patient, and notification carries an `organizationId`. patient uniqueness is scoped to (org, email), so the same email can live in two clinics later. enforcement isn't strict yet (the ui is single org), but there's exactly one place to tighten that when the time comes.

## running it

you'll need node 20 plus and docker. clone, then:

```bash
npm install
cp .env.example .env
```

set a `SESSION_SECRET` in `.env` (anything 16 plus characters is fine locally).

```bash
docker compose up -d db
npm run db:reset
npm run dev
```

open http://localhost:3000. you'll land on `/sign-in`. pick any seeded account. dr. maria reyes is the admin if you want the full picture.

`db:reset` is a `prisma db push force-reset` followed by the seed. the seed creates the organization, four users, around twenty patients with a believable spread of biomarkers, runs a prediction over each, drops some clinician notes, and pre seeds a few notifications so the bell shows something on first boot. when you make patient changes in the ui, the queue worker picks them up automatically.

useful scripts: `npm run dev`, `npm run build`, `npm run typecheck`, `npm run lint`, `npm run db:studio` (prisma studio for poking at the data), `npm run db:seed` (re run just the seed without resetting).

env vars worth knowing: `AI_PROVIDER` (defaults to `internal`, can be `mock`, `openai`, or `groq`, though the external ones are stubs until i wire keys), `MIRA_DISABLE_WORKER` (set to `1` to keep the in process worker off, handy when you're poking at the queue manually), `LOG_LEVEL` (`debug` if you want the chatty json log lines).

## docker, if you want it that way

```bash
docker compose up --build
```

multi stage dockerfile, next standalone output, runs as a non root user. in a real deployment the worker would split into its own container by importing `server/worker` and calling `ensureWorker()` from a tiny entry. that part is documented in the architecture notes but not wired by default.

## what's next

a rough sketch of what's queued up for upcoming pushes, roughly in priority order. i'll trim or reorder this as i actually do the work.

- live openai and groq providers. the registry slots are there, the circuit breaker already wraps them, it's mostly a matter of dropping in the client calls and key management.
- real rbac. roles are captured today but nothing actually gates by them. admin gets to do everything, analyst probably shouldn't be able to archive patients, that kind of thing.
- moving the worker out of process. the queue table is already the contract, so this is swapping in bullmq or pg boss without touching the request paths.
- per tenant sse channels and proper organization scoping in the query layer. right now the broadcast model is fine because there's one org, but i don't want it to leak when there are more.
- pdf reports. the markdown export is the right intermediate, the next step is something that can be emailed or stored.
- batch reruns. if the heuristic changes or a provider gets swapped, being able to rerun predictions across a cohort would be useful.
- biomarker drift alerts. if a patient's glucose ticks up across three visits without crossing the static thresholds, the system should still notice.
- an organization switcher and the tiny ui that goes with it, once multi tenant is real.
- a few quality of life things: keyboard shortcuts, a quick add patient modal, maybe a small in app metrics widget for ops.

## one last note

if you're skimming this and wondering whether something is real or a stub, the answer is mostly real. the openai and groq providers are stubs (they throw "not configured", which is honest), and the worker is in process rather than a separate service, but the queue, the events, the audit trail, the notifications, the analytics, the workflow rules, the heuristic, the circuit breaker, the explainability, the exports, the bulk actions, all of those actually work end to end. you can sign in, make changes, and watch the system respond.

ai observations are signals, not diagnoses. always review with a qualified clinician. mira's job is to make their job easier, not to take it.

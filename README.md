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

## the intelligence layer (phase 5)

phase 5 was the point where mira stopped being "a CRUD app with AI on the side" and became an operational intelligence platform. the goal was specifically not to bolt a chatbot onto the UI; it was to embed reasoning everywhere it reduces friction or improves decision quality. here's how the pieces fit.

**ai orchestration.** there's a single entrypoint, `runAI(task, context)`, that lives in `src/services/ai/orchestration`. callers assemble a structured context envelope and hand over a task name (`patient_summary`, `clinician_handoff`, `critical_digest`, `follow_up_brief`). the orchestrator picks a provider, runs it, falls back to the internal heuristic once if the primary throws, records latency and degradation, and emits the structured output. providers live behind a tiny circuit breaker — three failures opens for 30s, internal is the floor and never degrades. swapping in openai or groq is a matter of dropping a `complete()` implementation alongside the existing stubs.

**patient memory.** `loadPatientMemory(id)` is the single place that assembles a patient's longitudinal context: latest prediction, biomarker trajectory across the last ten assessments, recurring observations across consecutive runs, z-score biomarker spikes against the patient's own baseline, workflow state and follow-up health, notes count, and a fingerprint of all of it. the orchestrator, the summarizer, the automation rules, and the anomaly detector all reason over the same memory shape — they don't each go re-query prisma.

**contextual summaries.** every patient has a cached AI summary (`PatientSummary` table) — a clinician-readable overview plus a trajectory line, a list of signals with severity, and a ranked recommended-actions list. summaries refresh automatically after each prediction (via the automation engine) and on demand from the patient detail page. the cache keys on a fingerprint of the inputs, so the UI can render a "stale" badge without re-running the generator.

**automation engine.** rule-based, deterministic, in `src/services/automation`. v1 ships six built-in rules covering critical-outcome notifications, summary refresh after every prediction, escalation of overdue follow-ups, dead-letter alerts, stale review flagging, and biomarker anomaly notifications. each fire writes an `AutomationEvent` row, audits the action, and emits a realtime event. rules are persisted per-org in `AutomationRule` so admins can toggle them; the engine ignores rule rows that don't exist yet (everything ships enabled). the architecture leaves room for a no-code editor later — rule keys are stable identifiers, the actions list is JSON, and the engine doesn't care whether a rule was authored in code or in a UI.

**priority scoring.** `PriorityScore` is recomputed after every prediction; the dashboard's "patients requiring attention now" queue sorts by it. each score carries a list of reasons (risk band, unreviewed-since-last-prediction, overdue follow-up, worsening trajectory, urgent-review status) so the order is defensible. nothing is auto-assigned — the human still picks.

**smart assignment.** `suggestAssignees(orgId, { patientId })` ranks clinicians by workload + critical pressure + follow-up backlog, with a small recency bonus for whoever's been active today. surfaces a one-line reason so the picker can see why a given clinician is recommended.

**anomaly detection.** lightweight and explainable. biomarker spikes use a z-score against the patient's own prior runs (no population stats yet — wouldn't be honest at this size). recurring flags count consecutive non-ok observations per label. workflow gaps cover stale review on critical patients and severely overdue follow-ups. anomalies surface on the patient detail page and feed the automation engine via the `biomarker_anomaly` trigger.

**operational copilot.** three predefined actions — "patients needing urgent review", "summarise unresolved criticals", "generate clinician handoff" — exposed as a small panel on the dashboard. each runs against live caseload data through the orchestrator and returns a structured output (no free-text chat). every run is audited.

**semantic search foundations.** `searchClient.search(q, opts)` is a keyword adapter today, ranked across patient names, notes, and cached summaries with simple scoring. the interface is the seam — when an embeddings provider is wired (the stub is in `services/search`), the same client adds vector retrieval without callers changing. the header search box uses it.

**notification intelligence.** notifications now carry priority (`low | normal | high | critical`), a group key for dedup, and a dismissal field separate from read. createNotification dedups on `(userId, groupKey)` within a configurable window — automation rules use this so the same critical signal doesn't spam the bell. the bell colors the priority rail and surfaces critical counts.

**realtime evolution.** the SSE event map now includes `summary.refreshed`, `automation.fired`, `priority.recomputed`, and `patient.assigned`. the client hook in the app shell invalidates the relevant query keys on each.

**audit + explainability.** automation events, summary refreshes, and copilot queries are all audited with the rule/action/reason captured in metadata. the activity feed renders them inline alongside everything else.

a small operational note: the orchestrator's "live" provider is the internal one until openai/groq keys land. that's a deliberate choice — the internal provider is deterministic, calibrated against rough clinical ranges, and explains itself. swapping to an LLM-backed provider gets fluency but doesn't change the contract or the audit trail.

## the governance layer (phase 6)

phase 6 is where the platform gets ready for a real pilot. nothing flashy — the work was about answering *why*, *when*, *how* and *who* for every meaningful action. the operations team should be able to trust the system, see what it's doing, and override it when needed. that means lineage, approvals, policies, an admin surface, and the operational tooling that sits behind any deployment that lasts.

**decision lineage.** every orchestrator call writes an `AIRun` row — provider, model, prompt id and version, latency, degraded flag, memory fingerprint, a context summary, and a compact output summary. `PatientSummary` and `SummaryRevision` carry `aiRunId`; `AutomationEvent` and the audit trail reference the same run. the "Decision lineage" panel on the patient page walks all of this so a clinician can ask "why was this summary published" and get a real answer. the same data backs the AI usage report in the admin area.

**summary governance.** every regeneration writes a `SummaryRevision`, increments `revision` on `PatientSummary`, and carries `promptId@promptVersion`. when the approval policy says so, fresh summaries land in `pending_review` and an admin signs off via the Publish button. the activity feed and audit log record each transition.

**policy engine.** policies are JSON config keyed by `(organizationId, kind)` over a built-in defaults registry. six kinds today — notification, escalation, retention, assignment, confidence, approval. callers go through one read path (`policyConfig(orgId, kind)`); the admin policy editor edits the JSON directly. each save bumps revision and writes a `policy_change` audit row. policies are deliberately small and authoritative — the rest of the codebase has no business reading raw config.

**confidence governance.** the confidence policy carries `minSummaryConfidence` and `minAutomationConfidence`. summaries below the summary threshold render a "low confidence" badge on the patient page. the automation engine consults the threshold when a rule fires with a `confidence` value on the payload — sub-threshold runs are skipped and counted in `automation_confidence_skipped`. nothing silently overrides a clinician.

**approvals.** the `Approval` table is generic — `(kind, targetType, targetId)` with `pending → approved | rejected | withdrawn` transitions. summary publication, workflow escalations and policy changes all flow through it. duplicate pending requests on the same target are suppressed. each decision is audited with the decider, the reason and the timing.

**administration center.** `/admin` is the operator's front door. overview tile with system status, queue snapshot, pending approvals, last backup. sub-pages for providers, queue, automation, policies, approvals, simulations, backups, and reports. admin-only via the `requireAdmin()` gate on every route and a redirect on the layout. dense tables, tight typography, no consumer fluff.

**queue administration.** the admin queue page shows recent jobs, counts by status, and a retry button for dead-letters. retry resets attempts and reschedules; every manual retry is audited.

**reliability tooling.** three simulations land in `/admin/simulations`: queue burst (enqueue duplicate jobs to drive worker load), provider failure (trip the OpenAI circuit to prove fallback), notification storm (synthesise low-priority notifications under a shared groupKey to exercise dedup). each run is audited with the kind, intensity and a result summary so the team can correlate against metrics.

**disaster recovery foundations.** `BackupSnapshot` rows capture point-in-time JSON digests — patient counts, queue depth, audit volume, AI run volume, automation fires. the admin Backups page lets you trigger a manual capture and lists prior snapshots. the architecture is the seam for real cloud backups; today it's the contract for what we'd capture and the place to read it from.

**compliance readiness.** patients carry `consentResearch`, `consentDataSharing`, and `retentionUntil`. the Consent panel on the patient page edits all three; every change writes a dedicated audit row (`consent_change` or `retention_change`). the retention sweep service archives patients whose `retentionUntil` has passed and prunes audit + summary revisions per the retention policy. nothing claims compliance — the hooks are there for HIPAA/GDPR work to land cleanly.

**multi-tenant evolution.** `OrgMembership` lets a user belong to multiple organizations; the org switcher in the header swaps the active org via a session cookie. the membership role takes over from the home role when the user is acting in a non-home org, so an admin at home can be a clinician elsewhere without code changes. all create paths still funnel through `tenantOf()` so future strict scoping is one line.

**operational reporting.** three CSV reports under `/api/admin/reports/{kind}`: governance (rule status, fire counts, approval totals), ai-usage (runs/latency/confidence by task and provider over the last 7 days), reliability (queue counts by status). each download is audited.

**deployment maturity.** env validation lives in `src/server/env.ts` — zod-parsed at module load, throws with a readable summary on misconfig. boot diagnostics print a redacted snapshot (node version, log level, provider names, worker enabled, db host without credentials) on worker start. `/api/health/ready` is the readiness probe; `/api/health/deep` stays as the detailed health endpoint.

**audit + observability.** new actions: `approval_requested`, `approval_decided`, `policy_change`, `provider_change`, `rule_toggled`, `org_switch`, `simulation_run`, `manual_retry`, `backup_created`, `consent_change`, `retention_change`. new metrics: `orchestration_runs`, `ai_confidence` (histogram), `automation_confidence_skipped`, `automation_awaiting_approval`, `policy_reads`, `policy_writes`, `approvals_requested`, `approvals_decided`, `simulations_run`, `backups_created`, `queue_manual_retries`, `retention_sweeps`. the activity feed renders every new action with the right icon and a one-line label.

## the intelligence warehouse (phase 7)

phase 7 is where the product stopped being a workflow tool with charts on the side and started being a decision-support surface. the live operational tables answer "what is the system doing right now". the warehouse answers "what changed, why, and what's likely next" — without the dashboard paying for it on every render.

**transactional vs analytical separation.** the warehouse stores frozen daily rows (`AnalyticsSnapshot`) per organization. dashboards, reports, forecasts, and the insight engine all read from this surface, never from the live tables. the metric set is defined once in `services/analytics/metrics.ts` so the UI renders any snapshot without hardcoding labels in components. snapshots upsert by `(org, grain, capturedFor)` so re-runs and backfills are safe.

**snapshot engine.** `captureDailySnapshot(orgId)` rolls the day window — patient counts, risk distribution, follow-up backlog, prediction throughput, automation fires, approvals, AI run volume + latency + confidence, clinician load average + peak, recurring-anomaly population — in a handful of grouped queries. duration lands in `metrics.observe('analytics_snapshot_duration_ms')` so the team can watch warehouse cost as the caseload grows.

**cohort intelligence.** eight cohorts at launch — critical-risk, elevated-risk, follow-up overdue, recurring anomalies, high improvement, newly critical, newly stable, unreviewed critical. each has a deterministic query against the live tables; `captureCohortSnapshots()` persists size + delta vs the prior snapshot + a sample of member ids per day. the analytics page renders the grid with friendly/unfriendly colouring (shrinking critical = good, growing follow-up backlog = watch).

**patient trajectory.** `TrajectoryScore` is cached per patient. the score consumes the same `loadPatientMemory()` envelope the orchestrator already uses for summaries — biomarker spikes, recurring observations, workflow gaps, risk-band direction — and produces an explainable direction (improving / stable / deteriorating / volatile) with weighted drivers. the patient detail page renders this in a dedicated card. recompute happens automatically after every prediction.

**forecasting.** `generateForecast(metric, horizonDays)` produces a payload with history, a projected mean line, a low/high confidence band, the method (`moving_average` for short windows, `linear_trend` once there are enough days), and a confidence ratio that grows with sample size. five metrics ship: patient growth, prediction volume, follow-up demand, review backlog, critical caseload. the language is deliberately soft — "expected range", not "tomorrow there will be 42 follow-ups".

**insight engine.** deterministic rules over snapshot history. each rule compares the recent 7d window against the prior 7d window for a watched metric (with metric-appropriate thresholds and friendly/unfriendly direction), or detects multi-snapshot streaks per cohort. output is one-line operator notes ("Follow-ups overdue rose 24% week-over-week", "Critical cohort shrinking for 3 consecutive snapshots") persisted to `OperationalInsight` so the activity log doesn't have to grow each rule's wording.

**clinician analytics.** load index = active + critical×3 + overdue×2. `clinicianMetrics()` returns per-clinician active patients, critical count, overdue follow-ups, reviews in the last 7 days, and the load index. `clinicianInsights()` surfaces overloaded clinicians (>1.4× mean) and underutilised ones (<0.5× mean) for operational planning. the dashboard renders a horizontal load bar — constructive, not a ranking.

**AI effectiveness.** runs, latency, confidence by provider and task; degraded-run rate; summary regeneration count; pending-review vs published summary counts; a confidence histogram in four buckets. answers the only question that matters about the AI surface: is what we ship measurably working?

**automation analytics.** fires per rule, approval acceptance rate, confidence skips, downstream notifications. `automationHealth()` is the page that tells operators whether their rules are still earning their keep.

**reporting engine.** eight kinds — executive overview, cohort overview, clinician workload, AI effectiveness, automation health, governance throughput, anomaly trends, retention outlook. each builder produces a structured summary (persisted to `ReportRun` with timing) and a CSV (downloaded via `/api/analytics/reports/{kind}`). the structured summary surfaces on the Reports admin page; the CSV is what gets emailed.

**warehouse orchestration.** `runWarehouse(orgId)` is the heartbeat — snapshot → cohorts → trajectories → forecasts → insights. each step is independently retryable; errors are logged but don't cascade. the admin Warehouse page triggers it on demand, shows per-step timings, and lets you regenerate just snapshots or just forecasts. wiring this to a cron is a one-line addition.

**operational intelligence dashboard.** the `/analytics` page is now the intelligence surface: insight feed, trajectory distribution + sharpest deteriorating patients, cohort grid with deltas, clinician workload, AI effectiveness, automation health, projected ranges for the five forecast metrics — plus the original distributions and biomarker averages at the bottom. every panel ties back to a decision.

**realtime evolution.** the SSE event map gains `trajectory.recomputed` and `analytics.refreshed`. the client hook invalidates the relevant query keys; the analytics page debounces a `router.refresh()` on warehouse completion so the operator sees fresh data without an explicit reload.

**schema additions.** `AnalyticsSnapshot`, `MetricDefinition`, `CohortSnapshot`, `TrajectoryScore`, `ForecastSnapshot`, `ReportRun`, `OperationalInsight`. enums: `AnalyticsGrain`, `CohortKind`, `TrajectoryDirection`, `ForecastMetric`, `ReportKind`. all org-scoped and indexed on `(organizationId, capturedFor)` or equivalent.

### a quick deployment topology

```
┌──────────────────┐    ┌───────────────┐    ┌──────────────────┐
│ next.js app      │ ─→ │ postgres      │ ←─ │ in-process worker│
│ (server + SSR    │    │ (prisma)      │    │ (queue + retention│
│  components)     │    │               │    │  + automation)   │
└──────────────────┘    └───────────────┘    └──────────────────┘
        │                                            │
        ▼                                            ▼
   /api/events/stream                       periodic sweep hooks
   (SSE broadcast)                          (cron-style today)
```

a real production split lives behind two doors that are already documented: swap the in-process worker for a separate container importing `ensureWorker()` from `server/worker.ts`, and replace the broadcast SSE with per-tenant channels. nothing about the data model needs to move.

### operating it

- `/api/health/ready` for readiness probes; `/api/health/deep` for detailed diagnostics
- `/admin` for the operator surface — providers, queue, automation, policies, approvals, simulations, backups, reports
- `MIRA_DISABLE_WORKER=1` to keep the worker off in any non-app process (already set for seed runs)
- env validation throws on boot; missing or short `SESSION_SECRET` is the first thing it catches

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

# MechaGen — Backend API

> Web-first AI mechanical part generation platform.
> Prompt → Blueprint Analysis → Spec → Geometry Plan → Preview → Solid Build → Export

---

## Quick Start (Local)

### 1. Prerequisites
- Node.js ≥ 18
- Python ≥ 3.10 (for worker)
- An [NVIDIA API key](https://build.nvidia.com) for generation

### 2. Install dependencies
```bash
cd backend && npm install
cd ../frontend && npm install      # if running frontend too
```

### 3. Set up environment
```bash
cd backend
cp .env.example .env.local
# Edit .env.local and set your NVIDIA_API_KEY (minimum requirement)
nano .env.local
```

At minimum, set:
```
NVIDIA_API_KEY=nvapi-your-key-here
```

### 4. Start the backend
```bash
cd backend
npm run dev         # → http://127.0.0.1:3001
```

Verify it's running:
```bash
curl http://127.0.0.1:3001/api/health
# → {"status":"ok","version":"phase5","timestamp":"..."}
```

### 5. Start the frontend
```bash
cd frontend
npm run dev         # → http://localhost:5173
```

### 6. Start the worker (for solid builds)
```bash
cd worker
pip install -r requirements.txt
python cadquery_worker.py   # → http://127.0.0.1:5001
```

---

## Architecture

```
mechagen/
  backend/           ← Node.js HTTP API server (port 3001)
  frontend/          ← Vite + React frontend (port 5173)
  worker/            ← Python CadQuery solid generation worker (port 5001)
  infra/
    sql/schema.sql   ← Full database schema (SQLite / PostgreSQL)
  landing/           ← Static landing page HTML
```

### Backend layers

```
backend/server.js          ← Entrypoint (~45 lines): load config → seed → listen
backend/src/
  app.js                   ← HTTP server factory, route mounting, CORS
  config/index.js          ← Env loading + typed config exports
  errors/
    AppError.js            ← Typed error class with factory shortcuts
    errorCodes.js          ← All error code constants (60+)
  lib/
    response.js            ← Shared API response helpers (ok/error/pageMeta)
  middleware/
    auth.js                ← X-API-Key auth + admin guard
    rateLimiter.js         ← Per-user rate limiting
    planGate.js            ← Plan feature gates
    validate.js            ← Body/query/param validators
    uploadGuard.js         ← File upload type + size guard
  repositories/            ← Persistence layer (JSON-file backed, drop-in SQLite swap)
    generationRepo.js
    blueprintRepo.js
    solidBuildRepo.js
    exportRepo.js
  routes/                  ← Domain route modules (15 files)
    public.js             (health, landing, uploads)
    generation.js         (/api/generate, /api/pipeline/generate, /api/generations/*)
    blueprint.js          (/api/blueprints/*)
    export.js             (/api/generations/*/export/*)
    solidBuild.js         (/api/generations/*/solid/*)
    catalog.js            (/api/catalog/*)
    plan.js               (/api/plans, /api/me/plan)
    usage.js              (/api/me/usage)
    workspace.js          (/api/workspaces/*)
    admin.js              (/api/admin/*)
    onboarding.js         (/api/me/onboarding)
    analytics.js          (/api/analytics/*)
    waitlist.js           (/api/waitlist)
    feedback.js           (/api/feedback)
    demo.js               (/api/demo/*)
  schemas/
    specSchema.js          ← SpecV1 + GeometryPlanV1 JSON validators
    workerContract.js      ← Worker request/response contract
  services/                ← Business logic (27 service files)
  api/                     ← Route handlers (18 handler files)
```

---

## Generation Pipeline

```
POST /api/pipeline/generate
  └─ authMiddleware (optional)
  └─ rateLimitMiddleware
  └─ planGate
  └─ pipelineGenHandler
       └─ orchestration.startGeneration(input)
            └─ repo.set(id, { status: 'queued', ... })   ← persisted immediately
            └─ runPipeline(id, input) [async, non-blocking]
                  1. [optional] analyzeBlueprintById → blueprintAnalysis JSON
                  2. callAiForJson → specJson (SpecV1)
                  3. validateSpecJson → pass/fail
                  4. checkConstraints → constraintReport
                  5. callAiForJson → geometryPlan (GeometryPlanV1)
                  6. validateGeometry → validationReport
                  7. [if invalid] repairGeometryPlan (up to 3 attempts)
                  8. buildPreviewFromPlan → previewParts + stlBase64
                  9. repo.update(id, { status: 'ready', ... })
  └─ respond immediately: { jobId, status: 'queued' }

GET /api/generations/:id
  └─ repo.get(id) → full generation record
```

---

## Worker Integration

```
POST /api/generations/:id/solid/start
  └─ solidBuildService.startSolidBuild(generation)
       └─ cadqueryTranslator.buildScript(geometryPlan) → cadScript
       └─ cadqueryWorkerClient.runSolidBuild({ jobId, cadScript })
            └─ HTTP POST http://127.0.0.1:5001/generate
            └─ validateWorkerRequest → validate before send
            └─ validateWorkerResponse → validate response
            └─ parseWorkerResponse → normalized { success, stlBase64, error }
       └─ solidBuildRepo.update(id, { status: 'done', stlBase64 })
```

---

## Database Schema

Located at `infra/sql/schema.sql`. Covers 15 tables:

| Table | Description |
|---|---|
| `plans` | Subscription plans (free/pro/team) |
| `users` | User accounts |
| `workspaces` | Team workspaces |
| `workspace_members` | Workspace membership |
| `projects` | User projects |
| `blueprints` | Uploaded blueprint images + analysis |
| `generations` | AI generation jobs + full lifecycle |
| `repair_attempts` | Per-generation repair history |
| `solid_builds` | CadQuery solid build results |
| `exports` | Export download records |
| `usage_events` | Usage tracking per user/workspace |
| `onboarding_states` | Per-user onboarding progress |
| `analytics_events` | App analytics events |
| `waitlist_entries` | Launch waitlist |
| `feedback_entries` | User feedback/bug reports |

Current persistence: JSON files in `backend/data/`. Same repo interface — upgrade to SQLite:
```bash
npm install better-sqlite3
# Then swap the I/O in src/repositories/*.js — interfaces are identical
```

---

## Scripts

```bash
# Backend (from backend/)
npm run dev          # Start dev server (port 3001)
npm test             # Run all 230+ tests
npm run test:services  # Phase 1–5 service tests
npm run test:repos     # Repository tests
npm run test:infra     # Config + AppError tests
npm run test:worker    # Worker contract tests
npm run check          # Verify app.js loads
npm run lint           # Syntax check key files
```

---

## Key API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | — | Health check |
| POST | `/api/pipeline/generate` | optional | Start a generation |
| GET | `/api/generations/:id` | — | Poll generation status |
| POST | `/api/generations/:id/repair` | — | Trigger repair |
| POST | `/api/blueprints/upload` | — | Upload blueprint image |
| POST | `/api/blueprints/:id/analyze` | — | Analyze a blueprint |
| GET | `/api/generations/:id/export/obj` | — | Download OBJ |
| GET | `/api/generations/:id/export/glb` | — | Download GLB |
| GET | `/api/generations/:id/export/stl` | — | Download STL |
| POST | `/api/generations/:id/solid/start` | optional | Start solid build |
| GET | `/api/generations/:id/solid/status` | — | Poll solid build |
| GET | `/api/plans` | — | List plans |
| GET | `/api/me/plan` | ✓ | My current plan |
| GET | `/api/me/usage` | ✓ | My usage stats |
| GET/POST | `/api/workspaces` | ✓ | Workspaces |
| GET | `/api/admin/launch` | admin | Launch metrics |
| POST | `/api/waitlist` | — | Join waitlist |
| POST | `/api/feedback` | optional | Submit feedback |
| GET | `/api/demo/project` | — | Demo project data |

---

## Troubleshooting

**503: Worker unavailable**
Make sure `cadquery_worker.py` is running on port 5001. The worker has a 1-retry policy.

**AI features unavailable**
Set `NVIDIA_API_KEY` in `.env.local`. Without it, generation returns an error — the app still starts.

**Port already in use**
Change `PORT=` in `.env.local`, or kill the process: `lsof -ti:3001 | xargs kill`.

**Uploads not found**
Make sure the `backend/uploads/` directory exists (created automatically on first upload).

**Generation stuck in queued**
The pipeline runs async. Poll `GET /api/generations/:id` every 2s. Check backend logs for errors.

---

## Next Steps

- [ ] SQLite migration (`npm install better-sqlite3`, swap repo I/O)
- [ ] Email: transactional emails on waitlist/onboarding (Resend / Postmark)
- [ ] Stripe webhook for billing/subscriptions
- [ ] Supabase Auth for full JWT-based auth
- [ ] STEP export support in `exportService.js`
- [ ] Frontend feature folder restructure (`features/generation/`, `features/billing/`, etc.)

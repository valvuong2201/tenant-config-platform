# Multi-Tenant Configuration Platform

Admin UI and claim-processing runtime for an insurance platform that serves several insurers. Each insurer (tenant) is
described entirely by configuration. Onboarding a new one is a form, not a code change.

Submission for Papaya AI Engineering Challenge 15 (advanced).

- **Live admin UI:** https://tenant-config-platform-bice.vercel.app (Vercel + Neon Postgres; see [Deploy](#deploy-vercel--neon))
- **Demo script:** [DEMO.md](DEMO.md)
- **Design decisions and assumptions:** [DECISIONS.md](DECISIONS.md)

## What it does

| Requirement | Where |
|---|---|
| Tenant config: branding, claim types and documents, approval tiers, notifications, SLA, custom fields | `src/core/dimensions/*` |
| Admin UI: CRUD with validation, preview, side-by-side diff, history with rollback | `src/ui/*`, pages in `src/app/` |
| `processClaim(tenantId, claimData)` | `TenantService.processClaim` in `src/core/service.ts`, also `POST /api/tenants/:id/process` |
| 3 sample tenants (SafeGuard, HealthFirst, GovHealth) | `src/core/seeds.ts` |
| A 4th tenant with zero code changes | `/tenants/new`, covered by `tests/service.test.ts` |
| Adding a config dimension costs almost nothing | [How to add a config dimension](#adding-a-config-dimension) |

## Run it

```bash
npm install
npm run dev          # http://localhost:3000, data persists in ./data/store.json
npm test             # 66 tests
npm run typecheck && npm run lint && npm run build
```

The three sample tenants are created automatically the first time the store is empty.

## Architecture

```
 Browser (React, Tailwind)              Next.js route handlers                 Core (pure TypeScript)
 ┌───────────────────────┐   fetch     ┌────────────────────────┐   calls    ┌──────────────────────────┐
 │ editors per dimension │────────────▶│ /api/tenants[...]      │───────────▶│ TenantService            │
 │ preview, diff, history│             │ /api/preview /validate │            │  validate · version ·    │
 └──────────┬────────────┘             └────────────────────────┘            │  rollback · process      │
            │ same code, imported directly                                    ├──────────────────────────┤
            └────────────────────────────────────────────────────────────────▶│ dimension registry       │
                                                                              │  schema + cross-field    │
                                                                              │  rules + process + diff  │
                                                                              └────────────┬─────────────┘
                                                                                           │ ConfigStore port
                                                                          Neon Postgres · JSON file · in-memory
```

- **One registry, many dimensions.** `src/core/registry.ts` lists the config dimensions. Each one is a module that
  declares its Zod schema, defaults, cross-field validation, its contribution to `processClaim`, and how its arrays
  should be diffed. Validation, the runtime, the diff, the API and the UI all iterate over that list.
- **The browser and the server run the same code.** The editors validate live with `validateConfig`, and the preview
  panel calls the real `evaluateClaim`. A test asserts preview output equals runtime output.
- **History is append-only.** Every save inserts a version row in the same statement that updates the tenant, with
  optimistic concurrency (`expectedVersion`). Rollback saves a new version holding the old config.

## Processing rules

`processClaim` takes `{ claimType, amount, submissionDate (YYYY-MM-DD), customFields, claimId? }` and returns
required and optional documents, approval routing, notifications to send, the SLA deadline with escalation dates and
custom-field validation.

- **Approval:** an amount below `autoApprovalThreshold` is auto-approved. Otherwise it goes to the tier with
  `minAmount <= amount < maxAmount` (lower bound inclusive, upper exclusive, null = no limit). Tiers must start at the
  threshold, be contiguous, and the last must be open-ended. A threshold of 0 means every claim is reviewed.
- **SLA:** business days are Monday to Friday, computed on date-only strings in UTC so the browser and server agree.
  The submission day is never counted (Friday + 1 = Monday). Public holidays are not modelled.
- **Notifications:** `claim_submitted` always fires; `approved` also fires for an auto-approved claim. Other events
  are returned as `deferred` so the preview shows what happens later.
- **Errors are returned, not thrown.** A missing custom field still yields routing, documents and SLA, with the field
  errors alongside (`status: PROCESSED_WITH_ERRORS`). Only a claim the tenant cannot handle at all (invalid input, or a
  claim type it has not enabled) returns `REJECTED` without routing.

## API

| Method and path | Purpose |
|---|---|
| `GET /api/tenants`, `POST /api/tenants` | list, create (`{ config, id?, note? }`) |
| `GET/PUT/DELETE /api/tenants/:id` | read, save new version (`{ config, note?, expectedVersion? }`), delete |
| `GET /api/tenants/:id/versions` | version history |
| `POST /api/tenants/:id/rollback` | `{ version, expectedVersion? }`, creates a new version |
| `POST /api/tenants/:id/process` | the claim as JSON body, returns the processing result |
| `POST /api/preview` | `{ config, claim }`, processes against an unsaved draft |
| `POST /api/validate` | `{ config }` returns `{ ok, issues[] }` |

Status codes: 422 with `issues[]` for invalid config, 404 unknown tenant or version, 409 on a version conflict or
duplicate id, 400 for malformed JSON.

```bash
curl -s -X POST localhost:3000/api/tenants/healthfirst/process -H 'content-type: application/json' \
  -d '{"claimType":"OUTPATIENT","amount":15000,"submissionDate":"2026-10-16"}'
```

## Adding a config dimension

Adding currency settings after everything else was built took one new module and two changed lines in the registry
(plus an optional editor). See commit `193a17f` (`git show 193a17f --stat`) and `76537d7` for the optional editor.

1. Create `src/core/dimensions/<name>.ts` with `defineDimension({ id, label, schema, defaults, validate?, process?, diff? })`.
2. Import it and add it to the `dimensions` array in `src/core/registry.ts`.
3. _(Optional)_ add an editor in `src/ui/editors/` and map it in `editors/index.ts`. Without one, the UI shows a JSON
   editor for the new dimension, and its `process` output appears under "Other" in the result view.

Stored tenants saved before the dimension existed are read with its defaults.

## Deploy (Vercel + Neon)

1. Create a Neon project and copy its connection string.
2. Import this repository into Vercel and set the environment variable `DATABASE_URL` to that string.
3. Deploy. Tables are created on first use and the sample tenants are seeded when the database is empty.

Without `DATABASE_URL` on Vercel the app falls back to per-instance memory, which loses state between requests; use
that only for a quick look.

## Tests

`npm test` runs 66 tests in 7 files: business-day arithmetic, every validation rule, runtime routing (including
boundary amounts), preview equals runtime, key-aware diffing, versioning, rollback and concurrency, the currency
dimension, and the Postgres store's SQL against an in-process Postgres (PGlite).

## Timeline

**Author's estimate:** about 6 hours in total.

What the repository shows (`git log --date=iso`): the first commit is at 23:22 and the last at 23:33 on 2026-10-17
(UTC+7), preceded by roughly 25 minutes of reading the brief, choosing the challenge and scaffolding. The AI assistant
wrote most of the code in that window; the human time spent reviewing, deploying and learning the code is not captured here.

## Known limitations

- The Postgres store is tested against PGlite, not against a live Neon database.
- No authentication or per-user audit identity; the admin UI is open to anyone who can reach it.
- Notification "sending" is modelled as a list of what would fire; nothing is actually delivered.
- Public holidays are not modelled in SLA calculations.

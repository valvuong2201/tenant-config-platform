# Design decisions and assumptions

A running log of choices, the reason for each, and the places where the brief left room.

## Decisions made with the user

1. **Challenge:** advanced #15 (Multi-Tenant Configuration Platform), chosen over #13 (SDK) and #08 (extractor) because it
   is the only advanced option that needs schema design, a runtime, an admin UI and a deployment.
2. **Deploy target:** Vercel with Neon Postgres. Serverless memory would lose tenants between requests, so persistence
   had to be shared.
3. **Git:** local commits per milestone so the history shows the build order. Nothing is pushed.

## Architecture

4. **Dimension registry.** Each config dimension is a self-contained module (schema, defaults, cross-field rules,
   `process`, diff hints), and `registry.ts` is the only list of them. This is what makes "add a new dimension" cheap.
   Cost: the `TenantConfig` type is derived from the registry with a mapped type, and cross-field rules take their
   sibling config as `any`.
5. **Pure core, thin shell.** All logic lives in `src/core` with no framework imports, so the browser and the server run
   identical code and tests need no HTTP.
6. **Preview and runtime are the same function.** The preview calls `evaluateClaim`; a test asserts equality with
   `processClaim`.
7. **Per-dimension validation, reported in one pass.** A bad colour in branding no longer hides a tier gap in approval.
   Found by a test that expected both errors.
8. **Store port with three adapters:** in-memory (tests), JSON file (local dev), Postgres (production). The Postgres
   SQL is covered by tests against PGlite, with the SQL runner injected.
9. **Append-only history, non-destructive rollback.** Rollback saves a new version with the old config and records
   `rolledBackFrom`. Rollback re-validates, since rules may have tightened since that version was saved.
10. **Optimistic concurrency.** Saves and rollbacks send `expectedVersion`; a stale one returns 409.
11. **Missing dimension means defaults.** Old stored versions and tenants load with the defaults of any dimension added
    later (proved with the currency dimension).

## Semantics I had to choose

12. **Approval model.** The brief lists "auto-approve" as a tier in its example but also asks for a separate threshold.
    I kept the threshold as its own field and made tiers cover everything from the threshold upward. Boundaries are lower
    inclusive, upper exclusive. Tiers must be contiguous with an open-ended last tier, so every amount maps to one outcome.
13. **Business days.** Mon–Fri, UTC date-only arithmetic, submission day not counted, no holidays.
14. **Errors are data.** `processClaim` returns routing plus field errors instead of throwing. An "identical claim" sent
    to tenants with different required custom fields would otherwise fail on some of them.
15. **Notifications.** `claim_submitted` always fires and `approved` fires on auto-approval. Later events are returned
    as `deferred` so the preview is informative.
16. **Diff is key-aware.** Tiers are matched by role, custom fields by key, SLA targets by claim type, escalations by
    (days, role). Document and channel lists are sets. Reordering is not a change, and removing a middle tier reports one
    removal, not a cascade.

## Assumptions about the sample tenants

17. SafeGuard enables DENTAL but the brief gives no dental SLA, so I used 5 business days.
18. HealthFirst's tier amounts are not given: assessor 5,000 to 50,000, manager above.
19. Document lists, escalation rules and colours are illustrative.
20. A webhook URL is a tenant-level setting, required when any event uses the webhook channel (the brief mentions the
    channel but not where it points).

# Demo script

Run `npm run dev`, open http://localhost:3000 (or the live URL). The three sample tenants exist already.
Use a Friday as the submission date, for example **2026-10-16**, so the weekend skipping is visible.

## 1. Same claim, three tenants

Open **Preview & run**. Enter: type `OUTPATIENT`, amount `15000`, submission date `2026-10-16`, Employee ID `E-100`,
Department `Health`, Budget Code `B-7`. Click **Process for all tenants**.

| | SafeGuard | HealthFirst | GovHealth |
|---|---|---|---|
| Approval | auto-approved (threshold 20,000) | needs assessor | needs committee (threshold 0) |
| Notifications now | email: submitted + approved | email + SMS: submitted | email + webhook: submitted |
| SLA deadline | 2026-10-23 (5 days) | 2026-10-27 (7 days) | 2026-11-06 (15 days) |
| Custom fields | Employee ID | none | Department, Budget Code |

Clear the custom fields and run again: the claim is still routed, with `PROCESSED WITH ERRORS` and a message per
missing field.

## 2. Create and configure a 4th tenant (no code)

1. **Tenants → New tenant**. Name it "Mekong Mutual". The form validates as you type (company name is required).
2. Enable OPTICAL next to OUTPATIENT and type its required documents separated by commas (each becomes a chip). Set the
   auto-approval threshold to 1,000, click **+ Add tier**, name the new tier "supervisor", then change the first tier's
   upper limit to 10,000: the next tier's lower limit follows, so the ranges stay contiguous.
3. The SLA section lists exactly the enabled claim types. OPTICAL starts empty and blocks saving until you enter days
   (for example 4). Add a custom field: leaving the key blank shows an error; use label "Policy number", key `policyNo`.
4. Try an invalid value: a negative threshold, or SLA of 0. The offending field turns red and **Create tenant** is disabled.
5. Click **Create tenant**, then in the **Preview** panel run a claim: it uses the draft config via the same code as
   production. Then repeat on **Preview & run** with the saved tenant.

## 3. Compare configurations

Open **Compare**, pick SafeGuard and HealthFirst. Differences are grouped by dimension: threshold, tiers added and removed
by role, MATERNITY and OPTICAL added, the Employee ID field removed, SMS added, SLA days changed.

## 4. History and rollback

1. Open HealthFirst, raise the auto-approval threshold to 6,000, add the note "Raise threshold" and **Save new version**.
2. Click **History & rollback**. Version 2 shows exactly two changes. Run the claim again to see the new routing.
3. **Roll back to this** on version 1. A new version 3 appears, marked "rollback of v1", and version 2 is still there.

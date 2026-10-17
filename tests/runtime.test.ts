import { beforeEach, describe, expect, it } from "vitest";
import { claim, newService } from "./helpers";

let service: ReturnType<typeof newService>;
beforeEach(() => {
  service = newService();
});

describe("processClaim: the same claim at three tenants", () => {
  it("routes, notifies and sets the SLA differently per tenant", async () => {
    const [a, b, c] = await Promise.all(["safeguard", "healthfirst", "govhealth"].map((id) => service.processClaim(id, claim())));

    // Approval: 15,000 is under SafeGuard's 20,000 threshold, but over HealthFirst's 5,000 and GovHealth's 0.
    expect(a.approval).toMatchObject({ decision: "AUTO_APPROVED", role: null });
    expect(b.approval).toMatchObject({ decision: "MANUAL_REVIEW", role: "assessor" });
    expect(c.approval).toMatchObject({ decision: "MANUAL_REVIEW", role: "committee" });

    // SLA: Friday + 5 / 7 / 15 business days.
    expect([a.sla?.deadline, b.sla?.deadline, c.sla?.deadline]).toEqual(["2026-10-23", "2026-10-27", "2026-11-06"]);

    // Notifications: auto-approval fires `approved` as well as `claim_submitted`.
    const fired = (r: typeof a) => r.notifications.fired.map((n) => `${n.event}:${n.channel}`);
    expect(fired(a)).toEqual(["claim_submitted:email", "approved:email"]);
    expect(fired(b)).toEqual(["claim_submitted:email", "claim_submitted:sms"]);
    expect(fired(c)).toEqual(["claim_submitted:email", "claim_submitted:webhook"]);
    expect(b.notifications.deferred.map((n) => n.event)).toContain("approved");

    // Documents differ.
    expect(a.requiredDocuments).toEqual(["Medical receipt", "Doctor's note"]);
    expect(b.requiredDocuments).toEqual(["Medical receipt"]);
    expect(c.requiredDocuments).toContain("Referral letter");

    // Custom fields: required set differs.
    expect(a.customFields.required.map((f) => f.key)).toEqual(["employeeId"]);
    expect(b.customFields.required).toEqual([]);
    expect(c.customFields.required.map((f) => f.key)).toEqual(["department", "budgetCode"]);

    expect([a, b, c].map((r) => r.status)).toEqual(["PROCESSED", "PROCESSED", "PROCESSED"]);
  });

  it("renders default templates and uses a custom one when set", async () => {
    const result = await service.processClaim("healthfirst", claim());
    expect(result.notifications.fired[0]).toMatchObject({
      templateSource: "default",
      subject: "Claim CLM-1 received",
    });

    const tenant = await service.get("healthfirst");
    tenant.config.notifications.events.claim_submitted.template = {
      subject: "{{companyName}}: thanks for claim {{claimId}}",
      body: "We have {{amount}} on file.",
    };
    await service.update("healthfirst", { config: tenant.config });
    const custom = await service.processClaim("healthfirst", claim());
    expect(custom.notifications.fired[0]).toMatchObject({
      templateSource: "custom",
      subject: "HealthFirst: thanks for claim CLM-1",
      body: "We have 15000 on file.",
    });
  });
});

describe("processClaim: approval boundaries (lower inclusive, upper exclusive)", () => {
  const route = async (tenant: string, amount: number) =>
    (await service.processClaim(tenant, claim({ amount })))?.approval;

  it("SafeGuard", async () => {
    expect(await route("safeguard", 19999.99)).toMatchObject({ decision: "AUTO_APPROVED" });
    expect(await route("safeguard", 20000)).toMatchObject({ role: "assessor" });
    expect(await route("safeguard", 99999.99)).toMatchObject({ role: "assessor" });
    expect(await route("safeguard", 100000)).toMatchObject({ role: "team_lead" });
    expect(await route("safeguard", 500000)).toMatchObject({ role: "director" });
    expect(await route("safeguard", 5_000_000)).toMatchObject({ role: "director" });
  });

  it("GovHealth never auto-approves, even for 0", async () => {
    expect(await route("govhealth", 0)).toMatchObject({ decision: "MANUAL_REVIEW", role: "committee" });
    expect(await route("govhealth", 1)).toMatchObject({ role: "committee" });
  });

  it("HealthFirst", async () => {
    expect(await route("healthfirst", 4999)).toMatchObject({ decision: "AUTO_APPROVED" });
    expect(await route("healthfirst", 5000)).toMatchObject({ role: "assessor" });
    expect(await route("healthfirst", 50000)).toMatchObject({ role: "manager" });
  });
});

describe("processClaim: errors are returned, not thrown", () => {
  it("still routes the claim but reports missing custom fields", async () => {
    const result = await service.processClaim("govhealth", claim({ customFields: { department: "Health" } }));
    expect(result.status).toBe("PROCESSED_WITH_ERRORS");
    expect(result.errors).toEqual([
      expect.objectContaining({ code: "MISSING_CUSTOM_FIELD", field: "customFields.budgetCode" }),
    ]);
    expect(result.approval?.role).toBe("committee");
    expect(result.sla?.deadline).toBe("2026-11-06");
  });

  it("treats blank and whitespace-only required values as missing", async () => {
    const result = await service.processClaim("safeguard", claim({ customFields: { employeeId: "   " } }));
    expect(result.errors.map((e) => e.code)).toEqual(["MISSING_CUSTOM_FIELD"]);
  });

  it("validates custom field types", async () => {
    const config = (await service.get("safeguard")).config;
    config.customFields.fields.push({ key: "grade", label: "Grade", type: "number", required: true });
    config.customFields.fields.push({ key: "hireDate", label: "Hire date", type: "date", required: false });
    await service.update("safeguard", { config });
    const result = await service.processClaim(
      "safeguard",
      claim({ customFields: { employeeId: "E1", grade: "abc", hireDate: "2026-13-40" } }),
    );
    expect(result.errors.map((e) => e.field).sort()).toEqual(["customFields.grade", "customFields.hireDate"]);
    const ok = await service.processClaim(
      "safeguard",
      claim({ customFields: { employeeId: "E1", grade: "7", hireDate: "2024-02-29" } }),
    );
    expect(ok.errors).toEqual([]);
    expect(ok.customFields.values).toMatchObject({ grade: 7, hireDate: "2024-02-29" });
  });

  it("rejects a claim type the tenant has not enabled", async () => {
    const result = await service.processClaim("govhealth", claim({ claimType: "DENTAL" }));
    expect(result.status).toBe("REJECTED");
    expect(result.errors[0]).toMatchObject({ code: "CLAIM_TYPE_NOT_ENABLED" });
    expect(result.approval).toBeNull();
  });

  it("rejects malformed claim input with field-level errors", async () => {
    const result = await service.processClaim(
      "safeguard",
      claim({ amount: -5, submissionDate: "16/10/2026", claimType: "TRAVEL" }),
    );
    expect(result.status).toBe("REJECTED");
    expect(result.errors.map((e) => e.field).sort()).toEqual(["amount", "claimType", "submissionDate"]);
  });

  it("throws NotFound for an unknown tenant", async () => {
    await expect(service.processClaim("nope", claim())).rejects.toThrow(/not found/);
  });
});

describe("preview and runtime are the same code path", () => {
  it("preview of a saved config equals processClaim", async () => {
    for (const id of ["safeguard", "healthfirst", "govhealth"]) {
      const tenant = await service.get(id);
      const runtime = await service.processClaim(id, claim());
      const preview = service.preview(tenant.config, claim(), id);
      expect({ ...preview, configVersion: null }).toEqual({ ...runtime, configVersion: null });
    }
  });

  it("preview of an unsaved draft reflects the draft, not the stored config", async () => {
    const tenant = await service.get("healthfirst");
    tenant.config.approval.autoApprovalThreshold = 20000;
    tenant.config.approval.tiers[0].minAmount = 20000;
    tenant.config.approval.tiers[0].maxAmount = 50000;
    const preview = service.preview(tenant.config, claim(), "healthfirst");
    expect(preview.approval?.decision).toBe("AUTO_APPROVED");
    expect((await service.processClaim("healthfirst", claim())).approval?.decision).toBe("MANUAL_REVIEW");
  });
});

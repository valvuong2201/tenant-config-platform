import { describe, expect, it } from "vitest";
import { validateConfig } from "@/core/registry";
import { SEED_TENANTS } from "@/core/seeds";
import { seedConfig } from "./helpers";

const issuesFor = (mutate: (c: ReturnType<typeof seedConfig>) => void, id = "safeguard") => {
  const config = seedConfig(id);
  mutate(config);
  const result = validateConfig(config);
  return result.ok ? [] : result.issues;
};
const has = (issues: { path: string; message: string }[], path: string, text?: string) =>
  issues.some((i) => i.path === path && (!text || i.message.includes(text)));

describe("config validation", () => {
  it.each(SEED_TENANTS.map((t) => t.id))("accepts the %s sample tenant", (id) => {
    expect(validateConfig(seedConfig(id)).ok).toBe(true);
  });

  it("rejects a negative auto-approval threshold", () => {
    const issues = issuesFor((c) => (c.approval.autoApprovalThreshold = -1));
    expect(has(issues, "approval.autoApprovalThreshold")).toBe(true);
  });

  it("requires at least one enabled claim type", () => {
    const issues = issuesFor((c) => (c.claimTypes.enabled = []));
    expect(has(issues, "claimTypes.enabled", "at least one")).toBe(true);
  });

  it("requires a positive SLA", () => {
    expect(has(issuesFor((c) => (c.sla.targets[0].businessDays = 0)), "sla.targets.0.businessDays")).toBe(true);
    expect(has(issuesFor((c) => (c.sla.targets[0].businessDays = -3)), "sla.targets.0.businessDays")).toBe(true);
  });

  it("requires an SLA target for every enabled claim type", () => {
    const issues = issuesFor((c) => (c.sla.targets = c.sla.targets.filter((t) => t.claimType !== "DENTAL")));
    expect(has(issues, "sla.targets", "DENTAL")).toBe(true);
  });

  it("requires the first tier to start at the auto-approval threshold", () => {
    const issues = issuesFor((c) => (c.approval.autoApprovalThreshold = 10000));
    expect(has(issues, "approval.tiers.0.minAmount")).toBe(true);
  });

  it("rejects gaps and overlaps between tiers", () => {
    expect(has(issuesFor((c) => (c.approval.tiers[1].minAmount = 120000)), "approval.tiers.1.minAmount")).toBe(true);
    expect(has(issuesFor((c) => (c.approval.tiers[1].minAmount = 90000)), "approval.tiers.1.minAmount")).toBe(true);
  });

  it("requires the last tier to be open-ended", () => {
    const issues = issuesFor((c) => (c.approval.tiers[2].maxAmount = 900000));
    expect(has(issues, "approval.tiers.2.maxAmount", "no upper limit")).toBe(true);
  });

  it("rejects a tier whose maximum is not above its minimum", () => {
    const issues = issuesFor((c) => (c.approval.tiers[0].maxAmount = 20000));
    expect(has(issues, "approval.tiers.0.maxAmount")).toBe(true);
  });

  it("rejects duplicate approver roles", () => {
    const issues = issuesFor((c) => (c.approval.tiers[1].role = "assessor"));
    expect(has(issues, "approval.tiers.1.role")).toBe(true);
  });

  it("requires a webhook URL when a webhook channel is enabled", () => {
    const issues = issuesFor((c) => (c.notifications.webhookUrl = ""), "govhealth");
    expect(has(issues, "notifications.webhookUrl")).toBe(true);
  });

  it("rejects a document that is both required and optional", () => {
    const issues = issuesFor((c) => c.claimTypes.enabled[0].optionalDocuments.push("medical receipt"));
    expect(has(issues, "claimTypes.enabled.0.optionalDocuments")).toBe(true);
  });

  it("rejects duplicate custom field keys and bad colours", () => {
    const issues = issuesFor((c) => {
      c.customFields.fields.push({ key: "EMPLOYEEID", label: "Again", type: "text", required: false });
      c.branding.primaryColor = "blue";
    });
    expect(has(issues, "customFields.fields.1.key")).toBe(true);
    expect(has(issues, "branding.primaryColor")).toBe(true);
  });

  it("fills a missing dimension with its defaults so old versions still load", () => {
    const config = seedConfig("healthfirst") as Partial<ReturnType<typeof seedConfig>>;
    delete config.customFields;
    const result = validateConfig(config);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.config.customFields.fields).toEqual([]);
  });
});

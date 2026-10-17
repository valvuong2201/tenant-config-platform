import { describe, expect, it } from "vitest";
import { diffConfigs } from "@/core/diff";
import { seedConfig } from "./helpers";

const paths = (a: unknown, b: unknown) =>
  diffConfigs(a, b)
    .map((c) => `${c.kind}:${c.path}`)
    .sort();

describe("diffConfigs", () => {
  it("is empty for identical configs", () => {
    expect(diffConfigs(seedConfig("safeguard"), seedConfig("safeguard"))).toEqual([]);
  });

  it("finds every difference between SafeGuard and HealthFirst", () => {
    const changes = paths(seedConfig("safeguard"), seedConfig("healthfirst"));
    expect(changes).toEqual(
      expect.arrayContaining([
        "changed:approval.autoApprovalThreshold",
        "changed:approval.tiers[assessor].minAmount",
        "changed:approval.tiers[assessor].maxAmount",
        "removed:approval.tiers[team_lead]",
        "removed:approval.tiers[director]",
        "added:approval.tiers[manager]",
        "added:claimTypes.enabled[MATERNITY]",
        "added:claimTypes.enabled[OPTICAL]",
        "removed:customFields.fields[employeeId]",
        "added:notifications.events.claim_submitted.channels[sms]",
        "changed:sla.targets[OUTPATIENT].businessDays",
        "changed:sla.targets[INPATIENT].businessDays",
        "changed:branding.companyName",
      ]),
    );
    // Every change belongs to a dimension.
    expect(diffConfigs(seedConfig("safeguard"), seedConfig("healthfirst")).every((c) => c.dimension.length > 0)).toBe(true);
  });

  it("is symmetric: added and removed swap", () => {
    const ab = paths(seedConfig("govhealth"), seedConfig("safeguard"));
    const ba = paths(seedConfig("safeguard"), seedConfig("govhealth"));
    expect(ab.length).toBe(ba.length);
    expect(ab).toContain("added:claimTypes.enabled[DENTAL]");
    expect(ba).toContain("removed:claimTypes.enabled[DENTAL]");
  });

  it("does not report reordering of tiers, custom fields or document lists", () => {
    const a = seedConfig("safeguard");
    const b = seedConfig("safeguard");
    b.approval.tiers.reverse();
    b.claimTypes.enabled.reverse();
    b.claimTypes.enabled[0].requiredDocuments.reverse();
    b.sla.targets.reverse();
    expect(diffConfigs(a, b)).toEqual([]);
  });

  it("reports only the removed tier, not every later tier, when a middle tier is dropped", () => {
    const a = seedConfig("safeguard");
    const b = seedConfig("safeguard");
    b.approval.tiers.splice(1, 1);
    expect(paths(a, b)).toEqual(["removed:approval.tiers[team_lead]"]);
  });

  it("reports document additions and removals per claim type", () => {
    const a = seedConfig("safeguard");
    const b = seedConfig("safeguard");
    b.claimTypes.enabled[0].requiredDocuments.push("Claim form");
    b.claimTypes.enabled[0].optionalDocuments = [];
    expect(paths(a, b)).toEqual([
      "added:claimTypes.enabled[OUTPATIENT].requiredDocuments[Claim form]",
      "removed:claimTypes.enabled[OUTPATIENT].optionalDocuments[Prescription]",
    ]);
  });

  it("detects template and webhook changes", () => {
    const a = seedConfig("govhealth");
    const b = seedConfig("govhealth");
    b.notifications.webhookUrl = "https://other.example/hook";
    b.notifications.events.approved.template = { subject: "s", body: "b" };
    expect(paths(a, b)).toEqual([
      "added:notifications.events.approved.template",
      "changed:notifications.webhookUrl",
    ]);
  });
});

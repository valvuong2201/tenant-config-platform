import { beforeEach, describe, expect, it } from "vitest";
import { defaultConfig } from "@/core/registry";
import { ValidationFailedError } from "@/core/service";
import { ConflictError, NotFoundError } from "@/store/types";
import { claim, newService, seedConfig } from "./helpers";

let service: ReturnType<typeof newService>;
beforeEach(() => {
  service = newService();
});

describe("seeding", () => {
  it("creates the three sample tenants once, even when called concurrently", async () => {
    await Promise.all([service.list(), service.list(), service.ensureSeeded()]);
    const tenants = await service.list();
    expect(tenants.map((t) => t.id).sort()).toEqual(["govhealth", "healthfirst", "safeguard"]);
    expect(tenants.every((t) => t.version === 1)).toBe(true);
  });
});

describe("onboarding a fourth tenant with configuration only", () => {
  it("creates, then processes a claim, without any code change", async () => {
    const config = defaultConfig();
    config.branding.companyName = "Mekong Mutual";
    config.claimTypes.enabled = [
      { type: "OUTPATIENT", requiredDocuments: ["Receipt"], optionalDocuments: [] },
      { type: "OPTICAL", requiredDocuments: ["Receipt", "Prescription"], optionalDocuments: [] },
    ];
    config.approval = {
      autoApprovalThreshold: 1000,
      tiers: [
        { role: "clerk", minAmount: 1000, maxAmount: 10000 },
        { role: "supervisor", minAmount: 10000, maxAmount: null },
      ],
    };
    config.sla.targets = [
      { claimType: "OUTPATIENT", businessDays: 3 },
      { claimType: "OPTICAL", businessDays: 4 },
    ];
    config.customFields.fields = [{ key: "policyNo", label: "Policy number", type: "text", required: true }];

    const tenant = await service.create({ config });
    expect(tenant.id).toBe("mekong-mutual");
    expect(tenant.version).toBe(1);

    const result = await service.processClaim(tenant.id, claim({ amount: 15000, customFields: { policyNo: "P-9" } }));
    expect(result).toMatchObject({
      tenantName: "Mekong Mutual",
      status: "PROCESSED",
      approval: { role: "supervisor" },
      sla: { deadline: "2026-10-21" },
    });
    expect((await service.list()).length).toBe(4);
  });

  it("generates a unique id when the name is taken", async () => {
    const a = await service.create({ config: seedConfig("healthfirst") });
    const b = await service.create({ config: seedConfig("healthfirst") });
    expect([a.id, b.id]).toEqual(["healthfirst-2", "healthfirst-3"]);
  });

  it("rejects an invalid config on the server, not just in the form", async () => {
    const config = seedConfig("healthfirst");
    config.approval.autoApprovalThreshold = -10;
    await expect(service.create({ config })).rejects.toBeInstanceOf(ValidationFailedError);
    await expect(service.create({ config: { branding: 42 } })).rejects.toBeInstanceOf(ValidationFailedError);
    await expect(service.create({ id: "Bad Id!", config: seedConfig("healthfirst") })).rejects.toBeInstanceOf(
      ValidationFailedError,
    );
  });
});

describe("history and rollback", () => {
  it("every save creates a version", async () => {
    const config = (await service.get("healthfirst")).config;
    config.approval.autoApprovalThreshold = 6000;
    config.approval.tiers[0].minAmount = 6000;
    const saved = await service.update("healthfirst", { config, note: "Raise threshold" });
    expect(saved.version).toBe(2);
    const history = await service.history("healthfirst");
    expect(history.map((v) => [v.version, v.note])).toEqual([
      [1, "Initial sample tenant"],
      [2, "Raise threshold"],
    ]);
  });

  it("rollback restores the old config as a new version and keeps history intact", async () => {
    const original = (await service.get("healthfirst")).config;
    const edited = structuredClone(original);
    edited.branding.companyName = "HealthFirst Renamed";
    await service.update("healthfirst", { config: edited });
    const edited2 = structuredClone(edited);
    edited2.sla.targets.forEach((t) => (t.businessDays = 9));
    await service.update("healthfirst", { config: edited2 });

    const rolled = await service.rollback("healthfirst", 1);
    expect(rolled.version).toBe(4);
    expect(rolled.config).toEqual(original);

    const history = await service.history("healthfirst");
    expect(history.map((v) => v.version)).toEqual([1, 2, 3, 4]);
    expect(history[3]).toMatchObject({ note: "Rollback to v1", rolledBackFrom: 1 });
    expect(history[1].config.branding.companyName).toBe("HealthFirst Renamed");
    expect((await service.processClaim("healthfirst", claim())).sla?.targetBusinessDays).toBe(7);
  });

  it("can roll back to the version it just came from (undo a rollback)", async () => {
    const edited = (await service.get("safeguard")).config;
    edited.branding.companyName = "SafeGuard v2";
    await service.update("safeguard", { config: edited });
    await service.rollback("safeguard", 1);
    const undone = await service.rollback("safeguard", 2);
    expect(undone.config.branding.companyName).toBe("SafeGuard v2");
  });

  it("errors on an unknown version or tenant", async () => {
    await expect(service.rollback("safeguard", 99)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.rollback("ghost", 1)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.history("ghost")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("detects concurrent edits via expectedVersion", async () => {
    const config = (await service.get("safeguard")).config;
    await service.update("safeguard", { config, expectedVersion: 1 });
    await expect(service.update("safeguard", { config, expectedVersion: 1 })).rejects.toBeInstanceOf(ConflictError);
    await expect(service.rollback("safeguard", 1, 1)).rejects.toBeInstanceOf(ConflictError);
  });

  it("does not save an invalid update and leaves the version unchanged", async () => {
    const config = (await service.get("safeguard")).config;
    config.sla.targets[0].businessDays = 0;
    await expect(service.update("safeguard", { config })).rejects.toBeInstanceOf(ValidationFailedError);
    expect((await service.get("safeguard")).version).toBe(1);
  });

  it("deletes a tenant", async () => {
    await service.remove("govhealth");
    await expect(service.get("govhealth")).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.remove("govhealth")).rejects.toBeInstanceOf(NotFoundError);
  });
});

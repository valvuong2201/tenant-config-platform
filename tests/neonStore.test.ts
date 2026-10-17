import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { TenantService } from "@/core/service";
import { NeonStore } from "@/store/neonStore";
import { AlreadyExistsError, ConflictError, NotFoundError } from "@/store/types";
import { claim, seedConfig } from "./helpers";

/** Runs the production SQL against an in-process Postgres (PGlite) instead of Neon. */
function freshStore() {
  const db = new PGlite();
  return new NeonStore({ query: async (text, params = []) => (await db.query(text, params)).rows as Record<string, unknown>[] });
}

let store: NeonStore;
beforeEach(() => {
  store = freshStore();
});

describe("NeonStore SQL", () => {
  it("creates a tenant with version 1 and a history row", async () => {
    const tenant = await store.createTenant("a", seedConfig("safeguard"), "first");
    expect(tenant).toMatchObject({ id: "a", version: 1 });
    expect(tenant.config.branding.companyName).toBe("SafeGuard Insurance");
    const versions = await store.listVersions("a");
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ version: 1, note: "first", rolledBackFrom: null });
  });

  it("rejects a duplicate id without touching the existing tenant", async () => {
    await store.createTenant("a", seedConfig("safeguard"));
    await expect(store.createTenant("a", seedConfig("govhealth"))).rejects.toBeInstanceOf(AlreadyExistsError);
    expect((await store.getTenant("a"))?.config.branding.companyName).toBe("SafeGuard Insurance");
    expect(await store.listVersions("a")).toHaveLength(1);
  });

  it("saves atomically: version increments and the history row matches", async () => {
    await store.createTenant("a", seedConfig("safeguard"));
    const edited = seedConfig("safeguard");
    edited.branding.companyName = "Renamed";
    const saved = await store.saveConfig("a", edited, { note: "rename", expectedVersion: 1 });
    expect(saved.version).toBe(2);
    const versions = await store.listVersions("a");
    expect(versions.map((v) => [v.version, v.note, v.config.branding.companyName])).toEqual([
      [1, null, "SafeGuard Insurance"],
      [2, "rename", "Renamed"],
    ]);
  });

  it("detects a stale expectedVersion and writes nothing", async () => {
    await store.createTenant("a", seedConfig("safeguard"));
    await store.saveConfig("a", seedConfig("safeguard"), { expectedVersion: 1 });
    await expect(store.saveConfig("a", seedConfig("govhealth"), { expectedVersion: 1 })).rejects.toBeInstanceOf(ConflictError);
    expect((await store.getTenant("a"))?.version).toBe(2);
    expect(await store.listVersions("a")).toHaveLength(2);
  });

  it("serialises concurrent saves: exactly one wins per version", async () => {
    await store.createTenant("a", seedConfig("safeguard"));
    const results = await Promise.allSettled(
      [1, 2, 3].map(() => store.saveConfig("a", seedConfig("healthfirst"), { expectedVersion: 1 })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await store.listVersions("a")).map((v) => v.version)).toEqual([1, 2]);
  });

  it("reports NotFound for unknown tenants and versions", async () => {
    await expect(store.saveConfig("nope", seedConfig("safeguard"))).rejects.toBeInstanceOf(NotFoundError);
    await expect(store.listVersions("nope")).rejects.toBeInstanceOf(NotFoundError);
    expect(await store.getVersion("nope", 1)).toBeNull();
    expect(await store.deleteTenant("nope")).toBe(false);
  });

  it("deleting a tenant removes its history", async () => {
    await store.createTenant("a", seedConfig("safeguard"));
    await store.saveConfig("a", seedConfig("safeguard"));
    expect(await store.deleteTenant("a")).toBe(true);
    expect(await store.getTenant("a")).toBeNull();
    await store.createTenant("a", seedConfig("govhealth"));
    expect(await store.listVersions("a")).toHaveLength(1);
  });

  it("lists tenants oldest first and keeps timestamps as ISO strings", async () => {
    await store.createTenant("a", seedConfig("safeguard"));
    await store.createTenant("b", seedConfig("healthfirst"));
    const list = await store.listTenants();
    expect(list.map((t) => t.id)).toEqual(["a", "b"]);
    expect(new Date(list[0].createdAt).toISOString()).toBe(list[0].createdAt);
  });

  it("works end to end through TenantService: seed, edit, rollback, process", async () => {
    const service = new TenantService(store);
    await Promise.all([service.list(), service.list()]); // concurrent seeding
    expect((await service.list()).map((t) => t.id).sort()).toEqual(["govhealth", "healthfirst", "safeguard"]);
    const config = (await service.get("healthfirst")).config;
    config.sla.targets.forEach((t) => (t.businessDays = 9));
    await service.update("healthfirst", { config, expectedVersion: 1 });
    await service.rollback("healthfirst", 1);
    const result = await service.processClaim("healthfirst", claim());
    expect(result).toMatchObject({ configVersion: 3, sla: { targetBusinessDays: 7 } });
  });
});

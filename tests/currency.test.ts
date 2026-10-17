import { describe, expect, it } from "vitest";
import { diffConfigs } from "@/core/diff";
import { validateConfig } from "@/core/registry";
import { TenantService } from "@/core/service";
import { MemoryStore } from "@/store/memoryStore";
import { claim, newService, seedConfig } from "./helpers";

/**
 * "Currency settings" was added as a new config dimension after everything else was built:
 * one module plus one line in the registry. These tests show it flows through validation,
 * processing, diff, versioning and rollback with no other code changes.
 */
describe("currency dimension (added without touching core code)", () => {
  it("is part of every config, defaulting to USD", () => {
    expect(seedConfig("safeguard").currency).toEqual({ code: "USD", decimals: 2 });
  });

  it("is validated", () => {
    const config = seedConfig("safeguard");
    config.currency = { code: "XXX" as "USD", decimals: 9 };
    const result = validateConfig(config);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((i) => i.path).sort()).toEqual(["currency.code", "currency.decimals"]);
  });

  it("shapes claim processing", async () => {
    const service = newService();
    const config = (await service.get("govhealth")).config;
    config.currency = { code: "VND", decimals: 0 };
    await service.update("govhealth", { config, note: "Switch to VND" });
    const result = await service.processClaim("govhealth", claim({ amount: 1500000 }));
    expect(result.currency).toEqual({ code: "VND", formattedAmount: "1,500,000 VND" });
  });

  it("appears in diffs and is versioned and rolled back like any dimension", async () => {
    const service = newService();
    const config = (await service.get("healthfirst")).config;
    config.currency = { code: "THB", decimals: 2 };
    await service.update("healthfirst", { config });
    const history = await service.history("healthfirst");
    expect(diffConfigs(history[0].config, history[1].config).map((c) => `${c.kind}:${c.path}`)).toEqual([
      "changed:currency.code",
    ]);
    const rolled = await service.rollback("healthfirst", 1);
    expect(rolled.config.currency.code).toBe("USD");
  });

  it("old stored versions without the dimension still load, with defaults", () => {
    const old = seedConfig("safeguard") as Partial<ReturnType<typeof seedConfig>>;
    delete old.currency;
    const result = validateConfig(old);
    expect(result.ok && result.config.currency).toEqual({ code: "USD", decimals: 2 });
  });
});

describe("tenants stored before a dimension existed", () => {
  it("are read with the new dimension's defaults, in get, list, history and processing", async () => {
    const store = new MemoryStore();
    const service = new TenantService(store);
    await service.ensureSeeded();
    const legacy = seedConfig("healthfirst") as Partial<ReturnType<typeof seedConfig>>;
    delete legacy.currency;
    // Written straight to the store, as an older version of the app would have.
    await store.createTenant("legacy-co", legacy as ReturnType<typeof seedConfig>, "saved before currency existed");

    expect((await service.get("legacy-co")).config.currency).toEqual({ code: "USD", decimals: 2 });
    expect((await service.list()).find((t) => t.id === "legacy-co")?.config.currency.code).toBe("USD");
    expect((await service.history("legacy-co"))[0].config.currency.code).toBe("USD");
    expect((await service.processClaim("legacy-co", claim())).currency).toMatchObject({ code: "USD" });
  });
});

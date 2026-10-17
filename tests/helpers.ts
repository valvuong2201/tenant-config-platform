import { SEED_TENANTS } from "@/core/seeds";
import { TenantService } from "@/core/service";
import { MemoryStore } from "@/store/memoryStore";
import type { TenantConfig } from "@/core/registry";

export const seedConfig = (id: string): TenantConfig =>
  structuredClone(SEED_TENANTS.find((t) => t.id === id)!.config);

export function newService() {
  return new TenantService(new MemoryStore());
}

/** Friday. SLA arithmetic in the tests below depends on this weekday. */
export const FRIDAY = "2026-10-16";

export const claim = (over: Record<string, unknown> = {}) => ({
  claimId: "CLM-1",
  claimType: "OUTPATIENT",
  amount: 15000,
  submissionDate: FRIDAY,
  customFields: { employeeId: "E-100", department: "Health", budgetCode: "B-7" },
  ...over,
});

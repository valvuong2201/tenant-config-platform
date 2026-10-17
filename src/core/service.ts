import { evaluateClaim, validateConfig, type TenantConfig } from "./registry";
import { SEED_TENANTS } from "./seeds";
import type { Issue, ProcessResult } from "./types";
import {
  AlreadyExistsError,
  NotFoundError,
  type ConfigStore,
  type Tenant,
  type TenantVersion,
} from "@/store/types";

export class ValidationFailedError extends Error {
  constructor(readonly issues: Issue[]) {
    super(`Configuration is invalid: ${issues.map((i) => `${i.path}: ${i.message}`).join("; ")}`);
    this.name = "ValidationFailedError";
  }
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function mustBeValid(input: unknown): TenantConfig {
  const result = validateConfig(input);
  if (!result.ok) throw new ValidationFailedError(result.issues);
  return result.config;
}

/** Application layer: validation, versioning and processing on top of a `ConfigStore`. */
export class TenantService {
  private seeding: Promise<void> | null = null;

  constructor(private readonly store: ConfigStore) {}

  /** Seeds the three sample tenants when the store is empty. Safe to call repeatedly and concurrently. */
  ensureSeeded(): Promise<void> {
    this.seeding ??= (async () => {
      if ((await this.store.listTenants()).length > 0) return;
      for (const seed of SEED_TENANTS) {
        try {
          await this.store.createTenant(seed.id, seed.config, "Initial sample tenant");
        } catch (error) {
          if (!(error instanceof AlreadyExistsError)) throw error;
        }
      }
    })().catch((error) => {
      this.seeding = null;
      throw error;
    });
    return this.seeding;
  }

  async list(): Promise<Tenant[]> {
    await this.ensureSeeded();
    return this.store.listTenants();
  }

  async get(id: string): Promise<Tenant> {
    await this.ensureSeeded();
    const tenant = await this.store.getTenant(id);
    if (!tenant) throw new NotFoundError(`Tenant "${id}"`);
    return tenant;
  }

  async create(input: { id?: string; config: unknown; note?: string }): Promise<Tenant> {
    await this.ensureSeeded();
    const config = mustBeValid(input.config);
    const id = input.id ?? (await this.uniqueIdFor(config.branding.companyName));
    if (!ID_PATTERN.test(id)) {
      throw new ValidationFailedError([
        { path: "id", message: "use 2-40 lowercase letters, digits or hyphens, starting with a letter or digit" },
      ]);
    }
    return this.store.createTenant(id, config, input.note ?? "Tenant created");
  }

  async update(id: string, input: { config: unknown; note?: string; expectedVersion?: number }): Promise<Tenant> {
    await this.ensureSeeded();
    const config = mustBeValid(input.config);
    return this.store.saveConfig(id, config, { note: input.note, expectedVersion: input.expectedVersion });
  }

  async history(id: string): Promise<TenantVersion[]> {
    await this.ensureSeeded();
    return this.store.listVersions(id);
  }

  /** Restores an old version by saving a new one with its config, so history is never rewritten. */
  async rollback(id: string, version: number, expectedVersion?: number): Promise<Tenant> {
    await this.ensureSeeded();
    const target = await this.store.getVersion(id, version);
    if (!target) throw new NotFoundError(`Version ${version} of tenant "${id}"`);
    // The rules may have tightened since that version was saved, so validate again.
    const config = mustBeValid(target.config);
    return this.store.saveConfig(id, config, {
      note: `Rollback to v${version}`,
      expectedVersion,
      rolledBackFrom: version,
    });
  }

  async remove(id: string): Promise<void> {
    await this.ensureSeeded();
    if (!(await this.store.deleteTenant(id))) throw new NotFoundError(`Tenant "${id}"`);
  }

  /** The runtime entry point: `processClaim(tenantId, claimData)`. */
  async processClaim(tenantId: string, claim: unknown): Promise<ProcessResult> {
    const tenant = await this.get(tenantId);
    return evaluateClaim(tenant, claim);
  }

  /** Same evaluation as `processClaim`, for a config that has not been saved yet. */
  preview(config: unknown, claim: unknown, tenantId = "draft"): ProcessResult {
    return evaluateClaim({ id: tenantId, version: null, config: mustBeValid(config) }, claim);
  }

  private async uniqueIdFor(name: string): Promise<string> {
    const base = slugify(name) || "tenant";
    let candidate = base;
    for (let n = 2; await this.store.getTenant(candidate); n++) candidate = `${base}-${n}`.slice(0, 40);
    return candidate;
  }
}

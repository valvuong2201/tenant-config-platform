import type { TenantConfig } from "@/core/registry";

export interface Tenant {
  id: string;
  /** Current version number; every save increments it. */
  version: number;
  config: TenantConfig;
  createdAt: string;
  updatedAt: string;
}

export interface TenantVersion {
  tenantId: string;
  version: number;
  config: TenantConfig;
  savedAt: string;
  note: string | null;
  /** Set when this version was created by rolling back to an earlier one. */
  rolledBackFrom: number | null;
}

export interface SaveOptions {
  note?: string;
  /** Reject the save with ConflictError unless the tenant is still at this version. */
  expectedVersion?: number;
  rolledBackFrom?: number;
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

export class AlreadyExistsError extends Error {
  constructor(id: string) {
    super(`Tenant "${id}" already exists`);
    this.name = "AlreadyExistsError";
  }
}

export class ConflictError extends Error {
  constructor(
    readonly expected: number,
    readonly actual: number,
  ) {
    super(`Tenant was changed by someone else (you edited v${expected}, current is v${actual}). Reload and retry.`);
    this.name = "ConflictError";
  }
}

/** Persistence port. History is append-only: versions are never edited or deleted individually. */
export interface ConfigStore {
  listTenants(): Promise<Tenant[]>;
  getTenant(id: string): Promise<Tenant | null>;
  createTenant(id: string, config: TenantConfig, note?: string): Promise<Tenant>;
  saveConfig(id: string, config: TenantConfig, options?: SaveOptions): Promise<Tenant>;
  listVersions(id: string): Promise<TenantVersion[]>;
  getVersion(id: string, version: number): Promise<TenantVersion | null>;
  deleteTenant(id: string): Promise<boolean>;
}

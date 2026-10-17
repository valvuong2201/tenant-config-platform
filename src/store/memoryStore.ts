import type { TenantConfig } from "@/core/registry";
import {
  AlreadyExistsError,
  ConflictError,
  NotFoundError,
  type ConfigStore,
  type SaveOptions,
  type Tenant,
  type TenantVersion,
} from "./types";

export interface StoreState {
  tenants: Record<string, Tenant>;
  versions: Record<string, TenantVersion[]>;
}

const clone = <T>(value: T): T => structuredClone(value);

/** In-memory store; `JsonFileStore` extends it to survive restarts. Used by tests and local dev. */
export class MemoryStore implements ConfigStore {
  protected state: StoreState = { tenants: {}, versions: {} };

  /** Hook for subclasses; called after every mutation. */
  protected persist(): void {}

  async listTenants(): Promise<Tenant[]> {
    return Object.values(this.state.tenants)
      .map(clone)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  async getTenant(id: string): Promise<Tenant | null> {
    const tenant = this.state.tenants[id];
    return tenant ? clone(tenant) : null;
  }

  async createTenant(id: string, config: TenantConfig, note?: string): Promise<Tenant> {
    if (this.state.tenants[id]) throw new AlreadyExistsError(id);
    const now = new Date().toISOString();
    const tenant: Tenant = { id, version: 1, config: clone(config), createdAt: now, updatedAt: now };
    this.state.tenants[id] = tenant;
    this.state.versions[id] = [
      { tenantId: id, version: 1, config: clone(config), savedAt: now, note: note ?? null, rolledBackFrom: null },
    ];
    this.persist();
    return clone(tenant);
  }

  async saveConfig(id: string, config: TenantConfig, options: SaveOptions = {}): Promise<Tenant> {
    const tenant = this.state.tenants[id];
    if (!tenant) throw new NotFoundError(`Tenant "${id}"`);
    if (options.expectedVersion !== undefined && options.expectedVersion !== tenant.version) {
      throw new ConflictError(options.expectedVersion, tenant.version);
    }
    const now = new Date().toISOString();
    tenant.version += 1;
    tenant.config = clone(config);
    tenant.updatedAt = now;
    this.state.versions[id].push({
      tenantId: id,
      version: tenant.version,
      config: clone(config),
      savedAt: now,
      note: options.note ?? null,
      rolledBackFrom: options.rolledBackFrom ?? null,
    });
    this.persist();
    return clone(tenant);
  }

  async listVersions(id: string): Promise<TenantVersion[]> {
    if (!this.state.tenants[id]) throw new NotFoundError(`Tenant "${id}"`);
    return clone(this.state.versions[id]);
  }

  async getVersion(id: string, version: number): Promise<TenantVersion | null> {
    const found = this.state.versions[id]?.find((v) => v.version === version);
    return found ? clone(found) : null;
  }

  async deleteTenant(id: string): Promise<boolean> {
    if (!this.state.tenants[id]) return false;
    delete this.state.tenants[id];
    delete this.state.versions[id];
    this.persist();
    return true;
  }
}

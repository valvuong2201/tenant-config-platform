import { neon } from "@neondatabase/serverless";
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

type Row = Record<string, unknown>;
const iso = (value: unknown) => new Date(value as string | Date).toISOString();

const toTenant = (row: Row): Tenant => ({
  id: row.id as string,
  version: row.current_version as number,
  config: row.config as TenantConfig,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

const toVersion = (row: Row): TenantVersion => ({
  tenantId: row.tenant_id as string,
  version: row.version as number,
  config: row.config as TenantConfig,
  savedAt: iso(row.saved_at),
  note: (row.note as string | null) ?? null,
  rolledBackFrom: (row.rolled_back_from as number | null) ?? null,
});

/** Postgres (Neon) store. Writes are single statements, so a save and its history row are atomic. */
export class NeonStore implements ConfigStore {
  private readonly sql;
  private schemaReady: Promise<void> | null = null;

  constructor(connectionString: string) {
    this.sql = neon(connectionString);
  }

  private async query(text: string, params: unknown[] = []): Promise<Row[]> {
    await this.ensureSchema();
    return (await this.sql.query(text, params)) as Row[];
  }

  private ensureSchema(): Promise<void> {
    this.schemaReady ??= (async () => {
      await this.sql.query(`CREATE TABLE IF NOT EXISTS tenants (
        id text PRIMARY KEY,
        current_version integer NOT NULL,
        config jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
      await this.sql.query(`CREATE TABLE IF NOT EXISTS tenant_versions (
        tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        version integer NOT NULL,
        config jsonb NOT NULL,
        saved_at timestamptz NOT NULL DEFAULT now(),
        note text,
        rolled_back_from integer,
        PRIMARY KEY (tenant_id, version)
      )`);
    })().catch((error) => {
      this.schemaReady = null;
      throw error;
    });
    return this.schemaReady;
  }

  async listTenants(): Promise<Tenant[]> {
    const rows = await this.query("SELECT * FROM tenants ORDER BY created_at, id");
    return rows.map(toTenant);
  }

  async getTenant(id: string): Promise<Tenant | null> {
    const rows = await this.query("SELECT * FROM tenants WHERE id = $1", [id]);
    return rows[0] ? toTenant(rows[0]) : null;
  }

  async createTenant(id: string, config: TenantConfig, note?: string): Promise<Tenant> {
    const rows = await this.query(
      `WITH ins AS (
         INSERT INTO tenants (id, current_version, config) VALUES ($1, 1, $2::jsonb)
         ON CONFLICT (id) DO NOTHING
         RETURNING id, current_version, config, created_at, updated_at
       ), hist AS (
         INSERT INTO tenant_versions (tenant_id, version, config, note)
         SELECT id, 1, config, $3 FROM ins
       )
       SELECT * FROM ins`,
      [id, JSON.stringify(config), note ?? null],
    );
    if (!rows[0]) throw new AlreadyExistsError(id);
    return toTenant(rows[0]);
  }

  async saveConfig(id: string, config: TenantConfig, options: SaveOptions = {}): Promise<Tenant> {
    const rows = await this.query(
      `WITH upd AS (
         UPDATE tenants
         SET current_version = current_version + 1, config = $2::jsonb, updated_at = now()
         WHERE id = $1 AND ($3::int IS NULL OR current_version = $3::int)
         RETURNING id, current_version, config, created_at, updated_at
       ), hist AS (
         INSERT INTO tenant_versions (tenant_id, version, config, note, rolled_back_from)
         SELECT id, current_version, config, $4, $5::int FROM upd
       )
       SELECT * FROM upd`,
      [id, JSON.stringify(config), options.expectedVersion ?? null, options.note ?? null, options.rolledBackFrom ?? null],
    );
    if (rows[0]) return toTenant(rows[0]);
    const current = await this.getTenant(id);
    if (!current) throw new NotFoundError(`Tenant "${id}"`);
    throw new ConflictError(options.expectedVersion ?? current.version, current.version);
  }

  async listVersions(id: string): Promise<TenantVersion[]> {
    if (!(await this.getTenant(id))) throw new NotFoundError(`Tenant "${id}"`);
    const rows = await this.query("SELECT * FROM tenant_versions WHERE tenant_id = $1 ORDER BY version", [id]);
    return rows.map(toVersion);
  }

  async getVersion(id: string, version: number): Promise<TenantVersion | null> {
    const rows = await this.query("SELECT * FROM tenant_versions WHERE tenant_id = $1 AND version = $2", [id, version]);
    return rows[0] ? toVersion(rows[0]) : null;
  }

  async deleteTenant(id: string): Promise<boolean> {
    const rows = await this.query("DELETE FROM tenants WHERE id = $1 RETURNING id", [id]);
    return rows.length > 0;
  }
}

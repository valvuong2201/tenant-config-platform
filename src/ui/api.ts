import type { Change } from "@/core/diff";
import type { TenantConfig } from "@/core/registry";
import type { Issue, ProcessResult } from "@/core/types";
import type { Tenant, TenantVersion } from "@/store/types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues: Issue[] = [],
  ) {
    super(message);
  }
}

async function call<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body === undefined ? undefined : { "content-type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error ?? `Request failed (${response.status})`, response.status, data.issues ?? []);
  return data as T;
}

export type ClaimBody = {
  claimId?: string;
  claimType: string;
  amount: number;
  submissionDate: string;
  customFields: Record<string, unknown>;
};

export const api = {
  listTenants: () => call<Tenant[]>("/api/tenants"),
  getTenant: (id: string) => call<Tenant>(`/api/tenants/${id}`),
  createTenant: (config: TenantConfig, note?: string) => call<Tenant>("/api/tenants", { method: "POST", body: { config, note } }),
  updateTenant: (id: string, config: TenantConfig, note: string | undefined, expectedVersion: number) =>
    call<Tenant>(`/api/tenants/${id}`, { method: "PUT", body: { config, note, expectedVersion } }),
  deleteTenant: (id: string) => call<void>(`/api/tenants/${id}`, { method: "DELETE" }),
  history: (id: string) => call<TenantVersion[]>(`/api/tenants/${id}/versions`),
  rollback: (id: string, version: number, expectedVersion: number) =>
    call<Tenant>(`/api/tenants/${id}/rollback`, { method: "POST", body: { version, expectedVersion } }),
  processClaim: (id: string, claim: ClaimBody) => call<ProcessResult>(`/api/tenants/${id}/process`, { method: "POST", body: claim }),
  previewDraft: (config: TenantConfig, claim: ClaimBody, tenantId?: string) =>
    call<ProcessResult>("/api/preview", { method: "POST", body: { config, claim, tenantId } }),
};

export type { Change };

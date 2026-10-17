import type { z } from "zod";
import { approval } from "./dimensions/approval";
import { branding } from "./dimensions/branding";
import { claimTypes } from "./dimensions/claimTypes";
import { currency } from "./dimensions/currency";
import { customFields } from "./dimensions/customFields";
import { notifications } from "./dimensions/notifications";
import { sla } from "./dimensions/sla";
import {
  claimInputSchema,
  type DiffHints,
  type Dimension,
  type Issue,
  type ProcessError,
  type ProcessResult,
} from "./types";

/**
 * The only place that lists config dimensions. To add one (e.g. currency settings), write a
 * module that calls `defineDimension` and add it here: validation, diff, history, the API and
 * the admin UI's fallback editor/result views pick it up from this list.
 */
export const dimensions = [branding, claimTypes, approval, notifications, sla, customFields, currency] as const;

type AnyDimension = (typeof dimensions)[number];
export type DimensionId = AnyDimension["id"];
export type TenantConfig = { [D in AnyDimension as D["id"]]: z.infer<D["schema"]> };

const dimensionList: readonly Dimension[] = dimensions;

export function defaultConfig(): TenantConfig {
  return Object.fromEntries(dimensionList.map((d) => [d.id, d.defaults()])) as TenantConfig;
}

export type ValidationResult = { ok: true; config: TenantConfig } | { ok: false; issues: Issue[] };

/**
 * Validates each dimension's shape, then its cross-field rules, and reports every problem in
 * one pass: a bad colour in branding does not hide a tier gap in approval. A dimension missing
 * from the input (e.g. an old stored version) falls back to its defaults. The same function runs
 * in the browser and on the server.
 */
export function validateConfig(input: unknown): ValidationResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, issues: [{ path: "", message: "configuration must be an object" }] };
  }
  const raw = input as Record<string, unknown>;
  const issues: Issue[] = [];
  const parsed: Record<string, unknown> = {};

  for (const d of dimensionList) {
    const result = d.schema.safeParse(raw[d.id] === undefined ? d.defaults() : raw[d.id]);
    if (result.success) parsed[d.id] = result.data;
    else {
      for (const issue of result.error.issues) {
        issues.push({ path: [d.id, ...issue.path].join("."), message: issue.message });
      }
    }
  }
  // Cross-field rules only run for dimensions that parsed; they must tolerate absent siblings.
  for (const d of dimensionList) {
    if (!(d.id in parsed)) continue;
    for (const issue of d.validate?.(parsed[d.id], parsed) ?? []) {
      issues.push({ path: issue.path ? `${d.id}.${issue.path}` : d.id, message: issue.message });
    }
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, config: parsed as TenantConfig };
}

export interface ConfigDiffHints {
  keyed: Record<string, string | string[]>;
  sets: Set<string>;
}

export function configDiffHints(): ConfigDiffHints {
  const keyed: ConfigDiffHints["keyed"] = {};
  const sets = new Set<string>();
  for (const d of dimensionList) {
    const hints: DiffHints = d.diff ?? {};
    for (const [path, key] of Object.entries(hints.keyed ?? {})) keyed[`${d.id}.${path}`] = key;
    for (const path of hints.sets ?? []) sets.add(`${d.id}.${path}`);
  }
  return { keyed, sets };
}

export interface TenantSnapshot {
  id: string;
  version?: number | null;
  config: TenantConfig;
}

/**
 * Pure claim evaluation. `config` must already be validated. Input problems and field errors
 * come back in `errors` instead of throwing; only an un-handleable claim (invalid input, disabled
 * claim type) yields status REJECTED and skips the routing output.
 */
export function evaluateClaim(tenant: TenantSnapshot, claimInput: unknown): ProcessResult {
  const base: ProcessResult = {
    tenantId: tenant.id,
    tenantName: tenant.config.branding.companyName,
    configVersion: tenant.version ?? null,
    status: "PROCESSED",
    errors: [],
    claimType: null,
    requiredDocuments: [],
    optionalDocuments: [],
    approval: null,
    notifications: { fired: [], deferred: [] },
    sla: null,
    customFields: { required: [], values: {}, errors: [] },
  };

  const parsedClaim = claimInputSchema.safeParse(claimInput);
  if (!parsedClaim.success) {
    base.status = "REJECTED";
    base.errors = parsedClaim.error.issues.map((i) => ({
      code: "INVALID_CLAIM",
      field: i.path.join(".") || undefined,
      message: i.message,
    }));
    return base;
  }
  const claim = parsedClaim.data;
  base.claimType = claim.claimType;

  const errors: ProcessError[] = [];
  const accumulated: Record<string, unknown> = {};
  for (const d of dimensionList) {
    if (!d.process) continue;
    const slice = d.process((tenant.config as Record<string, unknown>)[d.id], {
      config: tenant.config,
      claim,
      result: accumulated,
    });
    if (!slice) continue;
    if (slice.reject) {
      return { ...base, status: "REJECTED", errors: [slice.reject] };
    }
    Object.assign(accumulated, slice.output);
    errors.push(...(slice.errors ?? []));
  }
  return {
    ...base,
    ...accumulated,
    errors,
    status: errors.length > 0 ? "PROCESSED_WITH_ERRORS" : "PROCESSED",
  };
}

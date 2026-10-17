import { z } from "zod";

export const CLAIM_TYPES = ["OUTPATIENT", "INPATIENT", "DENTAL", "MATERNITY", "OPTICAL"] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

export const NOTIFICATION_EVENTS = ["claim_submitted", "approved", "rejected", "payment_sent"] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export const CHANNELS = ["email", "sms", "webhook"] as const;
export type Channel = (typeof CHANNELS)[number];

/** A validation problem. `path` is dot-notation, e.g. `approval.tiers.1.role`. */
export interface Issue {
  path: string;
  message: string;
}

/** Date-only string (YYYY-MM-DD) that is also a real calendar date. */
export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export const claimInputSchema = z.object({
  claimId: z.string().trim().min(1).optional(),
  claimType: z.enum(CLAIM_TYPES),
  amount: z.number().finite().nonnegative(),
  submissionDate: z.string().refine(isValidDateString, "must be a valid date in YYYY-MM-DD format"),
  customFields: z.record(z.string(), z.unknown()).default({}),
});
export type ClaimInput = z.input<typeof claimInputSchema>;
export type ParsedClaim = z.output<typeof claimInputSchema>;

export interface ProcessError {
  code: string;
  /** Claim field the error refers to, when there is one. */
  field?: string;
  message: string;
}

export interface ApprovalRouting {
  decision: "AUTO_APPROVED" | "MANUAL_REVIEW";
  /** Role that must approve; null when auto-approved. */
  role: string | null;
  tier: { minAmount: number; maxAmount: number | null } | null;
  reason: string;
}

export interface RenderedNotification {
  event: string;
  channel: string;
  templateSource: "default" | "custom";
  subject: string;
  body: string;
}

export interface SlaResult {
  targetBusinessDays: number;
  submissionDate: string;
  deadline: string;
  escalation: { afterBreachDays: number; notifyRole: string; escalateOn: string }[];
}

export interface CustomFieldsResult {
  required: { key: string; label: string; type: string }[];
  values: Record<string, unknown>;
  errors: ProcessError[];
}

export type ProcessStatus = "PROCESSED" | "PROCESSED_WITH_ERRORS" | "REJECTED";

export interface ProcessResult {
  tenantId: string;
  tenantName: string;
  configVersion: number | null;
  status: ProcessStatus;
  errors: ProcessError[];
  claimType: string | null;
  requiredDocuments: string[];
  optionalDocuments: string[];
  approval: ApprovalRouting | null;
  notifications: { fired: RenderedNotification[]; deferred: RenderedNotification[] };
  sla: SlaResult | null;
  customFields: CustomFieldsResult;
  /** Output of dimensions added later; core code never needs to know their keys. */
  [extra: string]: unknown;
}

export interface ProcessContext {
  config: Record<string, any>;
  claim: ParsedClaim;
  /** Output keys produced so far by dimensions earlier in the registry. */
  result: Record<string, any>;
}

export interface ProcessSlice {
  output?: Record<string, unknown>;
  errors?: ProcessError[];
  /** Stops processing; the claim cannot be handled by this tenant at all. */
  reject?: ProcessError;
}

/**
 * How `diffConfigs` should treat arrays under a dimension. Paths are relative to the
 * dimension root, dot-separated, with no indices (e.g. `tiers`, `events.approved.channels`).
 * - `keyed`: array of objects matched by one or more identity fields instead of position.
 * - `sets`: array of primitives compared as an unordered set.
 */
export interface DiffHints {
  keyed?: Record<string, string | string[]>;
  sets?: string[];
}

export interface Dimension<Id extends string = string, S extends z.ZodType = z.ZodType> {
  id: Id;
  label: string;
  schema: S;
  defaults: () => z.infer<S>;
  /** Cross-field checks that a schema can't express. Paths are relative to the dimension. */
  validate?: (value: z.infer<S>, config: any) => Issue[];
  /** Contribution to `processClaim`. */
  process?: (value: z.infer<S>, ctx: ProcessContext) => ProcessSlice | void;
  diff?: DiffHints;
}

/** Identity helper that keeps the literal `id` type for `TenantConfig` inference. */
export function defineDimension<Id extends string, S extends z.ZodType>(
  dimension: Dimension<Id, S>,
): Dimension<Id, S> {
  return dimension;
}

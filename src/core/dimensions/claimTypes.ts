import { z } from "zod";
import { CLAIM_TYPES, defineDimension, type Issue } from "../types";

const docList = z.array(z.string().trim().min(1, "document name cannot be empty"));

export const claimTypesSchema = z.object({
  /** A claim type is enabled exactly when it appears here. */
  enabled: z.array(
    z.object({
      type: z.enum(CLAIM_TYPES),
      requiredDocuments: docList,
      optionalDocuments: docList,
    }),
  ),
});
export type ClaimTypesConfig = z.infer<typeof claimTypesSchema>;

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const v of values) {
    const key = v.toLowerCase();
    if (seen.has(key)) dupes.add(v);
    seen.add(key);
  }
  return [...dupes];
}

export const claimTypes = defineDimension({
  id: "claimTypes",
  label: "Claim types & documents",
  schema: claimTypesSchema,
  defaults: (): ClaimTypesConfig => ({
    enabled: [{ type: "OUTPATIENT", requiredDocuments: ["Medical receipt"], optionalDocuments: [] }],
  }),
  diff: {
    keyed: { enabled: "type" },
    sets: ["enabled.requiredDocuments", "enabled.optionalDocuments"],
  },
  validate(value) {
    const issues: Issue[] = [];
    if (value.enabled.length === 0) {
      issues.push({ path: "enabled", message: "enable at least one claim type" });
    }
    for (const type of duplicates(value.enabled.map((e) => e.type))) {
      issues.push({ path: "enabled", message: `claim type ${type} is enabled more than once` });
    }
    value.enabled.forEach((entry, i) => {
      const overlap = entry.requiredDocuments.filter((d) =>
        entry.optionalDocuments.some((o) => o.toLowerCase() === d.toLowerCase()),
      );
      for (const doc of overlap) {
        issues.push({
          path: `enabled.${i}.optionalDocuments`,
          message: `"${doc}" is listed as both required and optional for ${entry.type}`,
        });
      }
      for (const doc of duplicates(entry.requiredDocuments)) {
        issues.push({ path: `enabled.${i}.requiredDocuments`, message: `"${doc}" is listed twice` });
      }
      for (const doc of duplicates(entry.optionalDocuments)) {
        issues.push({ path: `enabled.${i}.optionalDocuments`, message: `"${doc}" is listed twice` });
      }
    });
    return issues;
  },
  process(value, { claim }) {
    const entry = value.enabled.find((e) => e.type === claim.claimType);
    if (!entry) {
      return {
        reject: {
          code: "CLAIM_TYPE_NOT_ENABLED",
          field: "claimType",
          message: `${claim.claimType} claims are not enabled for this tenant`,
        },
      };
    }
    return {
      output: {
        requiredDocuments: entry.requiredDocuments,
        optionalDocuments: entry.optionalDocuments,
      },
    };
  },
});

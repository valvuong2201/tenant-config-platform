import { z } from "zod";
import { addBusinessDays } from "../businessDays";
import { CLAIM_TYPES, defineDimension, type Issue } from "../types";
import type { ClaimTypesConfig } from "./claimTypes";

export const slaSchema = z.object({
  /** Business days from submission to deadline, per claim type. */
  targets: z.array(
    z.object({
      claimType: z.enum(CLAIM_TYPES),
      businessDays: z.number().int("must be a whole number of days").positive("must be greater than 0"),
    }),
  ),
  /** What happens once the deadline is missed, `afterBreachDays` business days after it. */
  escalation: z.array(
    z.object({
      afterBreachDays: z.number().int("must be a whole number").min(0, "must be 0 or more"),
      notifyRole: z.string().trim().min(1, "role to notify is required"),
    }),
  ),
});
export type SlaConfig = z.infer<typeof slaSchema>;

export const sla = defineDimension({
  id: "sla",
  label: "SLA & escalation",
  schema: slaSchema,
  defaults: (): SlaConfig => ({
    targets: [{ claimType: "OUTPATIENT", businessDays: 5 }],
    escalation: [{ afterBreachDays: 0, notifyRole: "team_lead" }],
  }),
  diff: { keyed: { targets: "claimType", escalation: ["afterBreachDays", "notifyRole"] } },
  validate(value, config: { claimTypes?: ClaimTypesConfig }) {
    const issues: Issue[] = [];
    const seen = new Set<string>();
    value.targets.forEach((t, i) => {
      if (seen.has(t.claimType)) {
        issues.push({ path: `targets.${i}.claimType`, message: `${t.claimType} has more than one SLA target` });
      }
      seen.add(t.claimType);
    });
    for (const { type } of config.claimTypes?.enabled ?? []) {
      if (!seen.has(type)) {
        issues.push({ path: "targets", message: `set an SLA target for ${type}; it is an enabled claim type` });
      }
    }
    return issues;
  },
  process(value, { claim }) {
    const target = value.targets.find((t) => t.claimType === claim.claimType);
    if (!target) {
      return {
        errors: [
          {
            code: "NO_SLA_TARGET",
            field: "claimType",
            message: `No SLA target configured for ${claim.claimType}`,
          },
        ],
      };
    }
    const deadline = addBusinessDays(claim.submissionDate, target.businessDays);
    return {
      output: {
        sla: {
          targetBusinessDays: target.businessDays,
          submissionDate: claim.submissionDate,
          deadline,
          escalation: value.escalation.map((rule) => ({
            afterBreachDays: rule.afterBreachDays,
            notifyRole: rule.notifyRole,
            escalateOn: rule.afterBreachDays === 0 ? deadline : addBusinessDays(deadline, rule.afterBreachDays),
          })),
        },
      },
    };
  },
});

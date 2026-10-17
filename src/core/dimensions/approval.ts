import { z } from "zod";
import { defineDimension, type Issue } from "../types";

/**
 * Routing model: amount < autoApprovalThreshold is approved automatically. Anything at or above
 * the threshold goes to the tier with minAmount <= amount < maxAmount (lower bound inclusive,
 * upper bound exclusive, maxAmount null = no upper limit). Tiers must start at the threshold
 * and leave no gaps or overlaps, so every amount maps to exactly one outcome.
 */
export const approvalSchema = z.object({
  autoApprovalThreshold: z.number().finite().min(0, "must be 0 or more"),
  tiers: z.array(
    z.object({
      role: z.string().trim().min(1, "approver role is required"),
      minAmount: z.number().finite().min(0, "must be 0 or more"),
      maxAmount: z.number().finite().nullable(),
    }),
  ),
});
export type ApprovalConfig = z.infer<typeof approvalSchema>;

export const approval = defineDimension({
  id: "approval",
  label: "Approval rules",
  schema: approvalSchema,
  defaults: (): ApprovalConfig => ({
    autoApprovalThreshold: 0,
    tiers: [{ role: "assessor", minAmount: 0, maxAmount: null }],
  }),
  diff: { keyed: { tiers: "role" } },
  validate(value) {
    const issues: Issue[] = [];
    const { tiers, autoApprovalThreshold } = value;
    if (tiers.length === 0) {
      issues.push({ path: "tiers", message: "add at least one approval tier" });
      return issues;
    }
    if (tiers[0].minAmount !== autoApprovalThreshold) {
      issues.push({
        path: "tiers.0.minAmount",
        message: `the first tier must start at the auto-approval threshold (${autoApprovalThreshold})`,
      });
    }
    const roles = new Set<string>();
    tiers.forEach((tier, i) => {
      const role = tier.role.toLowerCase();
      if (roles.has(role)) {
        issues.push({ path: `tiers.${i}.role`, message: `role "${tier.role}" is used by more than one tier` });
      }
      roles.add(role);
      if (tier.maxAmount !== null && tier.maxAmount <= tier.minAmount) {
        issues.push({ path: `tiers.${i}.maxAmount`, message: "must be greater than the tier's minimum" });
      }
      if (i > 0) {
        const prevMax = tiers[i - 1].maxAmount;
        if (prevMax === null) {
          issues.push({
            path: `tiers.${i - 1}.maxAmount`,
            message: "only the last tier can have no upper limit",
          });
        } else if (tier.minAmount !== prevMax) {
          issues.push({
            path: `tiers.${i}.minAmount`,
            message: `must equal the previous tier's maximum (${prevMax}) so there is no gap or overlap`,
          });
        }
      }
    });
    const last = tiers[tiers.length - 1];
    if (last.maxAmount !== null) {
      issues.push({
        path: `tiers.${tiers.length - 1}.maxAmount`,
        message: "the last tier must have no upper limit so every amount is covered",
      });
    }
    return issues;
  },
  process(value, { claim }) {
    if (claim.amount < value.autoApprovalThreshold) {
      return {
        output: {
          approval: {
            decision: "AUTO_APPROVED",
            role: null,
            tier: null,
            reason: `Amount ${claim.amount} is below the auto-approval threshold of ${value.autoApprovalThreshold}`,
          },
        },
      };
    }
    const tier = value.tiers.find(
      (t) => claim.amount >= t.minAmount && (t.maxAmount === null || claim.amount < t.maxAmount),
    );
    if (!tier) {
      // Unreachable for a validated config; guard so a bad stored config fails loudly.
      return {
        reject: {
          code: "NO_APPROVAL_TIER",
          field: "amount",
          message: `No approval tier covers amount ${claim.amount}`,
        },
      };
    }
    return {
      output: {
        approval: {
          decision: "MANUAL_REVIEW",
          role: tier.role,
          tier: { minAmount: tier.minAmount, maxAmount: tier.maxAmount },
          reason: `Amount ${claim.amount} falls in the ${tier.role} tier (${tier.minAmount} to ${
            tier.maxAmount === null ? "no limit" : tier.maxAmount
          })`,
        },
      },
    };
  },
});

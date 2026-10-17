"use client";

import type { ApprovalConfig } from "@/core/dimensions/approval";
import { Button, Field, NumberInput, TextInput, errorAt } from "../components";
import type { EditorProps } from "./types";

type Tier = ApprovalConfig["tiers"][number];

/**
 * Tier boundaries are linked: changing a tier's upper limit moves the next tier's lower limit, and
 * the threshold is the first tier's lower limit. That keeps the ranges contiguous while editing;
 * the validator still enforces it on the server.
 */
export function ApprovalEditor({ value, onChange, issues }: EditorProps<ApprovalConfig>) {
  const { tiers } = value;

  const setThreshold = (threshold: number) =>
    onChange({
      autoApprovalThreshold: threshold,
      tiers: tiers.map((t, i) => (i === 0 ? { ...t, minAmount: threshold } : t)),
    });

  const patchTier = (index: number, change: Partial<Tier>) =>
    onChange({
      ...value,
      tiers: tiers.map((t, i) => {
        if (i === index) return { ...t, ...change };
        if (i === index + 1 && "maxAmount" in change && change.maxAmount !== null && change.maxAmount !== undefined) {
          return { ...t, minAmount: change.maxAmount };
        }
        return t;
      }),
    });

  const addTier = () => {
    const last = tiers[tiers.length - 1];
    const boundary = last ? (last.maxAmount ?? Math.max(last.minAmount * 2, last.minAmount + 100000)) : value.autoApprovalThreshold;
    const next = tiers.map((t, i) => (i === tiers.length - 1 ? { ...t, maxAmount: boundary } : t));
    onChange({ ...value, tiers: [...next, { role: "", minAmount: boundary, maxAmount: null }] });
  };

  const removeTier = (index: number) => {
    const removed = tiers[index];
    const rest = tiers.filter((_, i) => i !== index).map((t, i, all) => {
      if (index > 0 && i === index - 1) return { ...t, maxAmount: removed.maxAmount };
      if (index === 0 && i === 0) return { ...t, minAmount: removed.minAmount };
      return all[i];
    });
    onChange({ ...value, tiers: rest });
  };

  return (
    <div className="space-y-4">
      <Field
        label="Auto-approval threshold"
        hint="Claims below this amount are approved automatically. Use 0 to require manual review for every claim."
        error={errorAt(issues, "autoApprovalThreshold")}
        className="max-w-sm"
      >
        <NumberInput value={Number.isNaN(value.autoApprovalThreshold) ? null : value.autoApprovalThreshold} onChange={(v) => setThreshold(v ?? Number.NaN)} invalid={!!errorAt(issues, "autoApprovalThreshold")} />
      </Field>

      <div>
        <p className="mb-1 text-xs font-medium text-zinc-700">Approval tiers</p>
        <p className="mb-2 text-xs text-zinc-500">Amounts from the threshold upward, lower limit inclusive, upper limit exclusive. Leave the last upper limit empty.</p>
        {errorAt(issues, "tiers") && <p className="mb-2 text-xs text-red-600">{errorAt(issues, "tiers")}</p>}
        <div className="space-y-2">
          {tiers.map((tier, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-start gap-2">
              <Field label={i === 0 ? "Approver role" : ""} error={errorAt(issues, `tiers.${i}.role`)}>
                <TextInput value={tier.role} placeholder="e.g. team_lead" onChange={(e) => patchTier(i, { role: e.target.value })} invalid={!!errorAt(issues, `tiers.${i}.role`)} />
              </Field>
              <Field label={i === 0 ? "From (inclusive)" : ""} error={errorAt(issues, `tiers.${i}.minAmount`)}>
                <NumberInput value={Number.isNaN(tier.minAmount) ? null : tier.minAmount} onChange={(v) => patchTier(i, { minAmount: v ?? Number.NaN })} invalid={!!errorAt(issues, `tiers.${i}.minAmount`)} disabled={i === 0} />
              </Field>
              <Field label={i === 0 ? "Up to (exclusive)" : ""} error={errorAt(issues, `tiers.${i}.maxAmount`)}>
                <NumberInput allowEmpty value={tier.maxAmount === null || Number.isNaN(tier.maxAmount) ? null : tier.maxAmount} placeholder="no limit" onChange={(v) => patchTier(i, { maxAmount: v })} invalid={!!errorAt(issues, `tiers.${i}.maxAmount`)} />
              </Field>
              <Button small variant="ghost" className={i === 0 ? "mt-[22px]" : "mt-0.5"} onClick={() => removeTier(i)} aria-label={`Remove tier ${i + 1}`}>
                Remove
              </Button>
            </div>
          ))}
        </div>
        <Button small className="mt-3" onClick={addTier}>
          + Add tier
        </Button>
      </div>
    </div>
  );
}

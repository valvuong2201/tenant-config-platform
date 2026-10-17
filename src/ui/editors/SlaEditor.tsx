"use client";

import type { SlaConfig } from "@/core/dimensions/sla";
import type { ClaimType } from "@/core/types";
import { Badge, Button, Field, NumberInput, TextInput, errorAt } from "../components";
import type { EditorProps } from "./types";

export function SlaEditor({ value, onChange, issues, config }: EditorProps<SlaConfig>) {
  const enabled = config.claimTypes.enabled.map((e) => e.type);
  const strays = value.targets.map((t, index) => ({ t, index })).filter(({ t }) => !enabled.includes(t.claimType));

  const setDays = (type: ClaimType, days: number | null) => {
    const exists = value.targets.some((t) => t.claimType === type);
    const businessDays = days ?? Number.NaN;
    onChange({
      ...value,
      targets: exists
        ? value.targets.map((t) => (t.claimType === type ? { ...t, businessDays } : t))
        : [...value.targets, { claimType: type, businessDays }],
    });
  };
  const patchRule = (index: number, change: Partial<SlaConfig["escalation"][number]>) =>
    onChange({ ...value, escalation: value.escalation.map((r, i) => (i === index ? { ...r, ...change } : r)) });

  const targetIndex = (type: ClaimType) => value.targets.findIndex((t) => t.claimType === type);

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-medium text-zinc-700">Target processing time (business days, Mon–Fri)</p>
        {errorAt(issues, "targets") && <p className="mb-2 text-xs text-red-600">{errorAt(issues, "targets")}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          {enabled.map((type) => {
            const i = targetIndex(type);
            const days = i >= 0 ? value.targets[i].businessDays : null;
            const error = i >= 0 ? errorAt(issues, `targets.${i}.businessDays`) : null;
            return (
              <Field key={type} label={type} error={error}>
                <NumberInput value={days === null || Number.isNaN(days) ? null : days} onChange={(v) => setDays(type, v)} invalid={!!error} placeholder="days" />
              </Field>
            );
          })}
        </div>
        {strays.length > 0 && (
          <div className="mt-3 space-y-1 text-xs text-zinc-500">
            {strays.map(({ t, index }) => (
              <div key={t.claimType} className="flex items-center gap-2">
                <Badge tone="amber">not enabled</Badge> {t.claimType}: {t.businessDays} days is ignored.
                <Button small variant="ghost" onClick={() => onChange({ ...value, targets: value.targets.filter((_, i) => i !== index) })}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-zinc-700">Escalation when the SLA is breached</p>
        <p className="mb-2 text-xs text-zinc-500">Notify the role this many business days after the deadline (0 = on the deadline day).</p>
        <div className="space-y-2">
          {value.escalation.map((rule, i) => (
            <div key={i} className="grid grid-cols-[8rem_1fr_auto] items-start gap-2">
              <Field label={i === 0 ? "Days after breach" : ""} error={errorAt(issues, `escalation.${i}.afterBreachDays`)}>
                <NumberInput value={Number.isNaN(rule.afterBreachDays) ? null : rule.afterBreachDays} onChange={(v) => patchRule(i, { afterBreachDays: v ?? Number.NaN })} invalid={!!errorAt(issues, `escalation.${i}.afterBreachDays`)} />
              </Field>
              <Field label={i === 0 ? "Notify role" : ""} error={errorAt(issues, `escalation.${i}.notifyRole`)}>
                <TextInput value={rule.notifyRole} placeholder="e.g. director" onChange={(e) => patchRule(i, { notifyRole: e.target.value })} invalid={!!errorAt(issues, `escalation.${i}.notifyRole`)} />
              </Field>
              <Button small variant="ghost" className={i === 0 ? "mt-[22px]" : "mt-0.5"} onClick={() => onChange({ ...value, escalation: value.escalation.filter((_, j) => j !== i) })}>
                Remove
              </Button>
            </div>
          ))}
        </div>
        <Button small className="mt-3" onClick={() => onChange({ ...value, escalation: [...value.escalation, { afterBreachDays: 0, notifyRole: "" }] })}>
          + Add escalation rule
        </Button>
      </div>
    </div>
  );
}

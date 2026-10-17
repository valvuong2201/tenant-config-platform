"use client";

import type { ClaimTypesConfig } from "@/core/dimensions/claimTypes";
import { CLAIM_TYPES, type ClaimType } from "@/core/types";
import { Field, TagInput, cx, errorAt } from "../components";
import type { EditorProps } from "./types";

export function ClaimTypesEditor({ value, onChange, issues }: EditorProps<ClaimTypesConfig>) {
  const entryOf = (type: ClaimType) => value.enabled.findIndex((e) => e.type === type);

  const toggle = (type: ClaimType, on: boolean) => {
    if (on) {
      const next = [...value.enabled, { type, requiredDocuments: [], optionalDocuments: [] }];
      next.sort((a, b) => CLAIM_TYPES.indexOf(a.type) - CLAIM_TYPES.indexOf(b.type));
      onChange({ enabled: next });
    } else {
      onChange({ enabled: value.enabled.filter((e) => e.type !== type) });
    }
  };
  const patch = (index: number, change: Partial<ClaimTypesConfig["enabled"][number]>) =>
    onChange({ enabled: value.enabled.map((e, i) => (i === index ? { ...e, ...change } : e)) });

  return (
    <div className="space-y-4">
      {errorAt(issues, "enabled") && <p className="text-xs text-red-600">{errorAt(issues, "enabled")}</p>}
      <div className="flex flex-wrap gap-2">
        {CLAIM_TYPES.map((type) => {
          const on = entryOf(type) >= 0;
          return (
            <label
              key={type}
              className={cx(
                "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm",
                on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700",
              )}
            >
              <input type="checkbox" className="sr-only" checked={on} onChange={(e) => toggle(type, e.target.checked)} />
              {type}
            </label>
          );
        })}
      </div>
      {value.enabled.map((entry, i) => (
        <div key={entry.type} className="rounded-lg border border-zinc-200 p-4">
          <h3 className="mb-3 text-sm font-semibold">{entry.type}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Required documents" hint="Press Enter or comma to add" error={errorAt(issues, `enabled.${i}.requiredDocuments`)}>
              <TagInput value={entry.requiredDocuments} onChange={(v) => patch(i, { requiredDocuments: v })} placeholder="e.g. Medical receipt" invalid={!!errorAt(issues, `enabled.${i}.requiredDocuments`)} />
            </Field>
            <Field label="Optional documents" error={errorAt(issues, `enabled.${i}.optionalDocuments`)}>
              <TagInput value={entry.optionalDocuments} onChange={(v) => patch(i, { optionalDocuments: v })} placeholder="e.g. Prescription" invalid={!!errorAt(issues, `enabled.${i}.optionalDocuments`)} />
            </Field>
          </div>
        </div>
      ))}
    </div>
  );
}

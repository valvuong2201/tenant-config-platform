"use client";

import { CLAIM_TYPES } from "@/core/types";
import type { ClaimBody } from "./api";
import { Field, NumberInput, Select, TextInput } from "./components";

export interface FieldDef {
  key: string;
  label: string;
  type: string;
  required: boolean;
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function newClaim(): ClaimBody {
  return { claimId: "CLM-1001", claimType: "OUTPATIENT", amount: 15000, submissionDate: todayIso(), customFields: {} };
}

/** Sample-claim inputs. `fields` are the custom fields to offer (the union across selected tenants). */
export function ClaimForm({ claim, onChange, fields }: { claim: ClaimBody; onChange: (c: ClaimBody) => void; fields: FieldDef[] }) {
  const set = (patch: Partial<ClaimBody>) => onChange({ ...claim, ...patch });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Claim ID">
        <TextInput value={claim.claimId ?? ""} onChange={(e) => set({ claimId: e.target.value })} />
      </Field>
      <Field label="Claim type">
        <Select value={claim.claimType} onChange={(e) => set({ claimType: e.target.value })}>
          {CLAIM_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </Field>
      <Field label="Amount">
        <NumberInput value={Number.isNaN(claim.amount) ? null : claim.amount} onChange={(v) => set({ amount: v ?? Number.NaN })} />
      </Field>
      <Field label="Submission date" hint="Weekdays count; weekends are skipped for SLAs">
        <TextInput type="date" value={claim.submissionDate} onChange={(e) => set({ submissionDate: e.target.value })} />
      </Field>
      {fields.map((f) => (
        <Field key={f.key} label={`${f.label}${f.required ? " *" : ""}`} hint={`customFields.${f.key} (${f.type})`}>
          <TextInput
            type={f.type === "date" ? "date" : "text"}
            value={String(claim.customFields[f.key] ?? "")}
            onChange={(e) => set({ customFields: { ...claim.customFields, [f.key]: e.target.value } })}
          />
        </Field>
      ))}
    </div>
  );
}

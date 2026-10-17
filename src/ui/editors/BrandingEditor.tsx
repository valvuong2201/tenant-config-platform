"use client";

import type { BrandingConfig } from "@/core/dimensions/branding";
import { Field, TextInput, errorAt } from "../components";
import type { EditorProps } from "./types";

function ColorField({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error: string | null }) {
  return (
    <Field label={label} error={error}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-zinc-300 bg-white p-0.5"
        />
        <TextInput value={value} onChange={(e) => onChange(e.target.value)} invalid={!!error} />
      </div>
    </Field>
  );
}

export function BrandingEditor({ value, onChange, issues }: EditorProps<BrandingConfig>) {
  const set = (patch: Partial<BrandingConfig>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Company name" error={errorAt(issues, "companyName")}>
        <TextInput value={value.companyName} onChange={(e) => set({ companyName: e.target.value })} invalid={!!errorAt(issues, "companyName")} />
      </Field>
      <Field label="Logo URL" hint="Optional. Leave empty to show the name only." error={errorAt(issues, "logoUrl")}>
        <TextInput value={value.logoUrl} placeholder="https://…" onChange={(e) => set({ logoUrl: e.target.value })} invalid={!!errorAt(issues, "logoUrl")} />
      </Field>
      <ColorField label="Primary colour" value={value.primaryColor} onChange={(v) => set({ primaryColor: v })} error={errorAt(issues, "primaryColor")} />
      <ColorField label="Secondary colour" value={value.secondaryColor} onChange={(v) => set({ secondaryColor: v })} error={errorAt(issues, "secondaryColor")} />
    </div>
  );
}

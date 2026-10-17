"use client";

import type { CustomFieldsConfig } from "@/core/dimensions/customFields";
import { FIELD_TYPES } from "@/core/dimensions/customFields";
import { Button, Field, Select, TextInput, errorAt } from "../components";
import type { EditorProps } from "./types";

type FieldDef = CustomFieldsConfig["fields"][number];

export function CustomFieldsEditor({ value, onChange, issues }: EditorProps<CustomFieldsConfig>) {
  const patch = (index: number, change: Partial<FieldDef>) =>
    onChange({ fields: value.fields.map((f, i) => (i === index ? { ...f, ...change } : f)) });

  return (
    <div className="space-y-3">
      {value.fields.length === 0 && <p className="text-sm text-zinc-500">No custom fields. Claims need only the standard data.</p>}
      {value.fields.map((field, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_7rem_auto_auto] items-start gap-2">
          <Field label={i === 0 ? "Label" : ""} error={errorAt(issues, `fields.${i}.label`)}>
            <TextInput value={field.label} placeholder="e.g. Employee ID" onChange={(e) => patch(i, { label: e.target.value })} invalid={!!errorAt(issues, `fields.${i}.label`)} />
          </Field>
          <Field label={i === 0 ? "Key" : ""} error={errorAt(issues, `fields.${i}.key`)}>
            <TextInput value={field.key} placeholder="e.g. employeeId" onChange={(e) => patch(i, { key: e.target.value })} invalid={!!errorAt(issues, `fields.${i}.key`)} />
          </Field>
          <Field label={i === 0 ? "Type" : ""}>
            <Select value={field.type} onChange={(e) => patch(i, { type: e.target.value as FieldDef["type"] })}>
              {FIELD_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <label className={`flex items-center gap-1.5 text-xs ${i === 0 ? "mt-[26px]" : "mt-2"}`}>
            <input type="checkbox" checked={field.required} onChange={(e) => patch(i, { required: e.target.checked })} />
            Required
          </label>
          <Button small variant="ghost" className={i === 0 ? "mt-[22px]" : "mt-0.5"} onClick={() => onChange({ fields: value.fields.filter((_, j) => j !== i) })}>
            Remove
          </Button>
        </div>
      ))}
      <Button small onClick={() => onChange({ fields: [...value.fields, { key: "", label: "", type: "text", required: true }] })}>
        + Add field
      </Button>
    </div>
  );
}

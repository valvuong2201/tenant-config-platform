"use client";

import { SUPPORTED_CURRENCIES, type CurrencyConfig } from "@/core/dimensions/currency";
import { Field, NumberInput, Select, errorAt } from "../components";
import type { EditorProps } from "./types";

export function CurrencyEditor({ value, onChange, issues }: EditorProps<CurrencyConfig>) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Currency" error={errorAt(issues, "code")}>
        <Select value={value.code} onChange={(e) => onChange({ ...value, code: e.target.value as CurrencyConfig["code"] })}>
          {SUPPORTED_CURRENCIES.map((code) => (
            <option key={code}>{code}</option>
          ))}
        </Select>
      </Field>
      <Field label="Decimal places" error={errorAt(issues, "decimals")}>
        <NumberInput value={Number.isNaN(value.decimals) ? null : value.decimals} onChange={(v) => onChange({ ...value, decimals: v ?? Number.NaN })} invalid={!!errorAt(issues, "decimals")} />
      </Field>
    </div>
  );
}

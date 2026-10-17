"use client";

import { useState } from "react";
import { Field } from "../components";
import type { EditorProps } from "./types";

/**
 * Fallback for a dimension that has no dedicated editor yet: edit its config as JSON. A new
 * dimension is therefore editable, validated and versioned the moment it is registered.
 */
export function JsonEditor({ value, onChange, issues }: EditorProps<unknown>) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);
  return (
    <Field label="Configuration (JSON)" error={parseError ?? issues[0]?.message ?? null}>
      <textarea
        rows={8}
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            onChange(JSON.parse(e.target.value));
            setParseError(null);
          } catch (error) {
            setParseError(error instanceof Error ? error.message : "Invalid JSON");
          }
        }}
        className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-zinc-300"
      />
    </Field>
  );
}

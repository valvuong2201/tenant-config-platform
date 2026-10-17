import { z } from "zod";
import { defineDimension, isValidDateString, type Issue, type ProcessError } from "../types";

export const FIELD_TYPES = ["text", "number", "date"] as const;

export const customFieldsSchema = z.object({
  /** Extra data a claim must carry at submission, e.g. Employee ID. */
  fields: z.array(
    z.object({
      key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "use letters, digits and underscores, starting with a letter"),
      label: z.string().trim().min(1, "label is required"),
      type: z.enum(FIELD_TYPES),
      required: z.boolean(),
    }),
  ),
});
export type CustomFieldsConfig = z.infer<typeof customFieldsSchema>;

function checkValue(
  field: CustomFieldsConfig["fields"][number],
  raw: unknown,
): { value: unknown; error?: ProcessError } {
  const fieldName = `customFields.${field.key}`;
  const fail = (message: string) => ({
    value: raw,
    error: { code: "INVALID_CUSTOM_FIELD", field: fieldName, message },
  });
  if (field.type === "number") {
    const n = typeof raw === "number" ? raw : Number(String(raw).trim());
    if (!Number.isFinite(n)) return fail(`${field.label} must be a number`);
    return { value: n };
  }
  if (typeof raw !== "string") return fail(`${field.label} must be text`);
  const text = raw.trim();
  if (field.type === "date" && !isValidDateString(text)) {
    return fail(`${field.label} must be a valid date in YYYY-MM-DD format`);
  }
  return { value: text };
}

export const customFields = defineDimension({
  id: "customFields",
  label: "Custom fields",
  schema: customFieldsSchema,
  defaults: (): CustomFieldsConfig => ({ fields: [] }),
  diff: { keyed: { fields: "key" } },
  validate(value) {
    const issues: Issue[] = [];
    const keys = new Set<string>();
    value.fields.forEach((f, i) => {
      if (keys.has(f.key.toLowerCase())) {
        issues.push({ path: `fields.${i}.key`, message: `field key "${f.key}" is used more than once` });
      }
      keys.add(f.key.toLowerCase());
    });
    return issues;
  },
  process(value, { claim }) {
    const errors: ProcessError[] = [];
    const values: Record<string, unknown> = {};
    for (const field of value.fields) {
      const raw = claim.customFields[field.key];
      const missing = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
      if (missing) {
        if (field.required) {
          errors.push({
            code: "MISSING_CUSTOM_FIELD",
            field: `customFields.${field.key}`,
            message: `${field.label} is required`,
          });
        }
        continue;
      }
      const checked = checkValue(field, raw);
      if (checked.error) errors.push(checked.error);
      else values[field.key] = checked.value;
    }
    return {
      output: {
        customFields: {
          required: value.fields
            .filter((f) => f.required)
            .map((f) => ({ key: f.key, label: f.label, type: f.type })),
          values,
          errors,
        },
      },
      errors,
    };
  },
});

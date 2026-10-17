import type { ComponentType } from "react";
import { ApprovalEditor } from "./ApprovalEditor";
import { BrandingEditor } from "./BrandingEditor";
import { ClaimTypesEditor } from "./ClaimTypesEditor";
import { CustomFieldsEditor } from "./CustomFieldsEditor";
import { JsonEditor } from "./JsonEditor";
import { NotificationsEditor } from "./NotificationsEditor";
import { SlaEditor } from "./SlaEditor";
import type { EditorProps } from "./types";

/** Dedicated editors by dimension id. A dimension without one gets the JSON fallback. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each editor is typed for its own dimension
const editors: Record<string, ComponentType<EditorProps<any>>> = {
  branding: BrandingEditor,
  claimTypes: ClaimTypesEditor,
  approval: ApprovalEditor,
  notifications: NotificationsEditor,
  sla: SlaEditor,
  customFields: CustomFieldsEditor,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const editorFor = (dimensionId: string): ComponentType<EditorProps<any>> => editors[dimensionId] ?? JsonEditor;

import type { TenantConfig } from "@/core/registry";
import type { Issue } from "@/core/types";

/** Props shared by every dimension editor. `issues` carry paths relative to the dimension. */
export interface EditorProps<T> {
  value: T;
  onChange: (next: T) => void;
  issues: Issue[];
  /** The whole draft, for editors that depend on other dimensions (SLA needs the enabled claim types). */
  config: TenantConfig;
}
